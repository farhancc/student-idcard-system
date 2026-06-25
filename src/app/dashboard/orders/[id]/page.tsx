'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  FileText, 
  ArrowLeft, 
  Share2, 
  CheckCircle, 
  FileSpreadsheet, 
  Clock, 
  Copy, 
  CreditCard,
  MessageSquare,
  History,
  Calendar,
  Sparkles,
  RefreshCw,
  Printer,
  Download,
  Eye,
  X,
  AlertCircle,
  Edit
} from 'lucide-react';

export default function OrderDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = Number(params.id);

  const [order, setOrder] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [noteContent, setNoteContent] = useState('');
  const [loading, setLoading] = useState(true);

  // Status transitions
  const [transitioning, setTransitioning] = useState(false);

  // PDF trigger states
  const [pdfLoading, setPdfLoading] = useState<string | null>(null);
  const [previewJob, setPreviewJob] = useState<any | null>(null);

  // Production layout settings
  const [showLayoutSettings, setShowLayoutSettings] = useState(true);
  const [layoutMarginLeft,   setLayoutMarginLeft]   = useState(40);
  const [layoutMarginTop,    setLayoutMarginTop]    = useState(40);
  const [layoutMarginRight,  setLayoutMarginRight]  = useState(40);
  const [layoutMarginBottom, setLayoutMarginBottom] = useState(40);
  const [layoutColGap,       setLayoutColGap]       = useState(15);
  const [layoutRowGap,       setLayoutRowGap]       = useState(15);
  const [layoutBleed,        setLayoutBleed]        = useState(0);
  const [layoutCropMarks,    setLayoutCropMarks]    = useState(true);
  const [layoutFoldLine,     setLayoutFoldLine]     = useState(true);
  const [layoutPaperSize,    setLayoutPaperSize]    = useState('A3');
  const [layoutOrientation,  setLayoutOrientation]  = useState('PORTRAIT');

  // Invoice edit modal state
  const [showInvoiceEdit, setShowInvoiceEdit] = useState(false);
  const [invPricePerCard, setInvPricePerCard] = useState('');
  const [invTaxPercent,   setInvTaxPercent]   = useState('');
  const [invCardCount,    setInvCardCount]    = useState('');
  const [invPaymentStatus, setInvPaymentStatus] = useState('UNPAID');
  const [invPaymentMethod, setInvPaymentMethod] = useState('CASH');
  const [invNotes,        setInvNotes]        = useState('');
  const [invSubmitting,   setInvSubmitting]   = useState(false);

  const handleOpenInvoiceEdit = () => {
    if (!order?.invoice) return;
    setInvPricePerCard(String(Number(order.invoice.pricePerCard)));
    setInvTaxPercent(String(Number(order.invoice.taxPercent)));
    setInvCardCount(String(order.invoice.cardCount));
    setInvPaymentStatus(order.invoice.paymentStatus);
    setInvPaymentMethod(order.invoice.paymentMethod || 'CASH');
    setInvNotes(order.invoice.notes || '');
    setShowInvoiceEdit(true);
  };

  const handleUpdateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setInvSubmitting(true);
    try {
      const res = await fetch('/api/invoices', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: order.invoice.id,
          pricePerCard: Number(invPricePerCard),
          cardCount: Number(invCardCount),
          taxPercent: Number(invTaxPercent),
          paymentStatus: invPaymentStatus,
          paymentMethod: invPaymentStatus === 'PAID' ? invPaymentMethod : null,
          notes: invNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update invoice');
      setShowInvoiceEdit(false);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Update failed');
    } finally {
      setInvSubmitting(false);
    }
  };

  const fetchData = async () => {
    try {
      const orderRes = await fetch(`/api/orders/${orderId}`);
      if (!orderRes.ok) throw new Error('Order not found');
      const orderData = await orderRes.json();
      setOrder(orderData.order);
      setLogs(orderData.logs || []);
      setNotes(orderData.notes || []);
    } catch (err) {
      console.error(err);
      router.push('/dashboard/orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [orderId]);

  // Load layout configurations from localStorage
  useEffect(() => {
    if (!order) return;
    const key = `layout-config-${order.clientId}-${order.templateId}`;
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.marginLeft !== undefined) setLayoutMarginLeft(parsed.marginLeft);
        if (parsed.marginTop !== undefined) setLayoutMarginTop(parsed.marginTop);
        if (parsed.marginRight !== undefined) setLayoutMarginRight(parsed.marginRight);
        if (parsed.marginBottom !== undefined) setLayoutMarginBottom(parsed.marginBottom);
        if (parsed.colGap !== undefined) setLayoutColGap(parsed.colGap);
        if (parsed.rowGap !== undefined) setLayoutRowGap(parsed.rowGap);
        if (parsed.bleed !== undefined) setLayoutBleed(parsed.bleed);
        if (parsed.cropMarks !== undefined) setLayoutCropMarks(parsed.cropMarks);
        if (parsed.foldLine !== undefined) setLayoutFoldLine(parsed.foldLine);
        if (parsed.paperSize !== undefined) setLayoutPaperSize(parsed.paperSize);
        if (parsed.orientation !== undefined) setLayoutOrientation(parsed.orientation);
      } else {
        setLayoutMarginLeft(40);
        setLayoutMarginTop(40);
        setLayoutMarginRight(40);
        setLayoutMarginBottom(40);
        setLayoutColGap(15);
        setLayoutRowGap(15);
        setLayoutBleed(0);
        setLayoutCropMarks(true);
        setLayoutFoldLine(true);
        setLayoutPaperSize('A3');
        setLayoutOrientation('PORTRAIT');
      }
    } catch (e) {
      console.error('Error loading layout config:', e);
    }
  }, [order]);

  const handleUpdateLayoutConfig = (field: string, value: any) => {
    if (!order) return;
    const key = `layout-config-${order.clientId}-${order.templateId}`;
    let current: any = {};
    try {
      const saved = localStorage.getItem(key);
      if (saved) current = JSON.parse(saved);
    } catch (e) {}

    current[field] = value;
    try {
      localStorage.setItem(key, JSON.stringify(current));
    } catch (e) {}

    if (field === 'marginLeft') setLayoutMarginLeft(value);
    if (field === 'marginTop') setLayoutMarginTop(value);
    if (field === 'marginRight') setLayoutMarginRight(value);
    if (field === 'marginBottom') setLayoutMarginBottom(value);
    if (field === 'colGap') setLayoutColGap(value);
    if (field === 'rowGap') setLayoutRowGap(value);
    if (field === 'bleed') setLayoutBleed(value);
    if (field === 'cropMarks') setLayoutCropMarks(value);
    if (field === 'foldLine') setLayoutFoldLine(value);
    if (field === 'paperSize') setLayoutPaperSize(value);
    if (field === 'orientation') setLayoutOrientation(value);
  };

  // Poll every 3 seconds for active PDF jobs
  useEffect(() => {
    if (!order || !order.pdfJobs) return;
    const hasActiveJobs = order.pdfJobs.some((j: any) => j.status === 'PROCESSING' || j.status === 'PENDING');
    if (!hasActiveJobs) return;

    const interval = setInterval(() => {
      fetchData();
    }, 3000);

    return () => clearInterval(interval);
  }, [order]);

  const getLatestJob = (type: string) => {
    if (!order || !order.pdfJobs) return null;
    return order.pdfJobs.find((j: any) => j.pdfType === type);
  };

  const renderJobStatus = (type: string) => {
    const job = getLatestJob(type);
    if (!job) return null;

    const isExpired = job.expiresAt && new Date(job.expiresAt) < new Date();
    
    return (
      <div style={{ 
        marginTop: '12px', 
        paddingTop: '12px', 
        borderTop: '1px solid rgba(255,255,255,0.05)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
          <span style={{ color: 'var(--muted)' }}>Latest: {job.label || `v${job.version}`}</span>
          {job.status === 'COMPLETED' ? (
            isExpired ? (
              <span style={{ color: 'var(--danger)', fontWeight: '600' }}>Expired</span>
            ) : (
              <span style={{ color: '#10b981', fontWeight: '600' }}>Completed</span>
            )
          ) : job.status === 'FAILED' ? (
            <span style={{ color: 'var(--danger)', fontWeight: '600' }}>Failed</span>
          ) : (
            <span style={{ color: 'var(--warning)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span className="spinner" style={{ width: '10px', height: '10px', borderWidth: '1px' }}></span>
              {job.status === 'PROCESSING' ? `Processing (${job.progress}%)` : 'Queued'}
            </span>
          )}
        </div>

        {job.status === 'COMPLETED' && !isExpired && (
          job.isLocalJob ? (
            <div style={{ padding: '8px 12px', fontSize: '0.8rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '6px', color: '#10b981', textAlign: 'center', fontWeight: '500' }}>
              Saved to Documents
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.75rem', flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                onClick={() => setPreviewJob(job)}
              >
                <Eye size={12} /> View
              </button>
              <a 
                href={`/api/jobs/${job.id}/download`} 
                target="_blank" 
                rel="noreferrer"
                className="btn btn-primary" 
                style={{ 
                  padding: '6px 12px', 
                  fontSize: '0.75rem', 
                  flex: 1, 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '4px',
                  background: type === 'PRODUCTION' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'var(--primary-gradient)'
                }}
              >
                <Download size={12} /> Download
              </a>
            </div>
          )
        )}

        {job.status === 'FAILED' && job.errorMsg && (
          <span style={{ fontSize: '0.7rem', color: 'var(--danger)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <AlertCircle size={12} /> Error: {job.errorMsg}
          </span>
        )}
      </div>
    );
  };

  // Update Status
  const handleUpdateStatus = async (newStatus: string) => {
    setTransitioning(true);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update status');

      fetchData();
    } catch (err: any) {
      alert(err.message || 'Status transition error');
    } finally {
      setTransitioning(false);
    }
  };

  // Compile PDF Job
  const handleCompilePdf = async (type: string) => {
    setPdfLoading(type);
    try {
      const body: any = {
        orderId,
        pdfType: type,
        paperSize: type === 'INVOICE' ? 'A4' : layoutPaperSize,
        orientation: type === 'INVOICE' ? 'PORTRAIT' : layoutOrientation,
      };

      // Attach layout settings for compiler jobs
      if (type === 'PRODUCTION' || type === 'APPROVAL' || type === 'INDIVIDUAL') {
        body.marginLeft   = layoutMarginLeft;
        body.marginTop    = layoutMarginTop;
        body.marginRight  = layoutMarginRight;
        body.marginBottom = layoutMarginBottom;
        body.colGap       = layoutColGap;
        body.rowGap       = layoutRowGap;
        body.bleed        = layoutBleed;
        body.cropMarks    = layoutCropMarks;
        body.foldLine     = layoutFoldLine;
      }

      const isProduction = type === 'PRODUCTION';
      const endpoint = '/api/jobs/production-request';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error compiling PDF');
      
      window.dispatchEvent(new Event('refresh-profile'));

      const cardCount = order?.cardholderIds ? JSON.parse(order.cardholderIds).length : 0;
      if (type === 'PRODUCTION') {
        alert(`Production print job #${data.jobId} queued successfully! It will compile on your Desktop App. Locked ${cardCount} credits.`);
      } else if (type === 'INVOICE') {
        alert(`Invoice compilation job #${data.jobId} queued successfully! It will compile on your Desktop App.`);
      } else {
        alert(`Approval draft job #${data.jobId} queued successfully! It will compile on your Desktop App.`);
      }
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Error compiling PDF');
    } finally {
      setPdfLoading(null);
    }
  };

  // WhatsApp share link
  const handleWhatsAppShare = async () => {
    try {
      const res = await fetch(`/api/orders/${orderId}/whatsapp-link`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not construct share link');

      window.open(data.whatsappUrl, '_blank');
    } catch (err: any) {
      alert(err.message || 'Error occurred');
    }
  };

  // Clone Order
  const handleClone = async () => {
    if (!confirm('Are you sure you want to clone this order settings as a new Draft?')) return;
    try {
      const res = await fetch(`/api/orders/${orderId}/clone`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Clone failed');

      alert('Order cloned successfully!');
      router.push(`/dashboard/orders/${data.order.id}`);
    } catch (err: any) {
      alert(err.message || 'Clone error');
    }
  };

  // Add order activity note
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim()) return;

    try {
      const res = await fetch(`/api/orders/${orderId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: noteContent }),
      });
      if (res.ok) {
        setNoteContent('');
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getStatusStep = () => {
    if (!order) return 0;
    switch (order.status) {
      case 'DRAFT': return 1;
      case 'APPROVAL_PDF_SENT': return 2;
      case 'APPROVED': return 3;
      case 'PRINTING': return 4;
      case 'DELIVERED': return 5;
      default: return 1;
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '100px 0' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  const steps = [
    { num: 1, label: 'Draft Config', key: 'DRAFT' },
    { num: 2, label: 'Approval Sent', key: 'APPROVAL_PDF_SENT' },
    { num: 3, label: 'Approved layout', key: 'APPROVED' },
    { num: 4, label: 'Printing Press', key: 'PRINTING' },
    { num: 5, label: 'Delivered', key: 'DELIVERED' }
  ];

  const currentStep = getStatusStep();
  const cardholderCount = JSON.parse(order?.cardholderIds || '[]').length;

  return (
    <div>
      {/* Header back */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <a href="/dashboard/orders" style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            border: '1px solid var(--glass-border)',
            background: 'rgba(255,255,255,0.02)',
            color: '#fff'
          }}>
            <ArrowLeft size={16} />
          </a>
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--muted)', textTransform: 'uppercase' }}>Card Print Pipeline</span>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '2px', fontSize: '1.75rem' }}>
              Order #{order?.id} <span style={{ fontSize: '1.1rem', color: 'var(--muted)', fontWeight: '400' }}>({order?.client?.name})</span>
            </h1>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={handleClone}>
            <Copy size={14} /> Duplicate Order
          </button>
          <button className="btn btn-secondary" onClick={fetchData}>
            <RefreshCw size={14} /> Refresh Logs
          </button>
        </div>
      </div>

      {/* Progress tracker timeline */}
      <div className="glass-panel" style={{ marginBottom: '32px', padding: '30px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', overflowX: 'auto' }}>
          {/* Connector Line */}
          <div style={{
            position: 'absolute',
            top: '20px',
            left: '30px',
            right: '30px',
            height: '4px',
            background: 'rgba(255,255,255,0.08)',
            zIndex: 1
          }}>
            <div style={{
              width: `${((currentStep - 1) / (steps.length - 1)) * 100}%`,
              height: '100%',
              background: 'var(--primary-gradient)'
            }}></div>
          </div>

          {steps.map((step) => {
            const isCompleted = currentStep >= step.num;
            const isActive = currentStep === step.num;

            return (
              <div key={step.num} style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                zIndex: 2,
                flex: 1,
                minWidth: '100px'
              }}>
                <button
                  disabled={transitioning || step.num > currentStep + 1}
                  onClick={() => handleUpdateStatus(step.key)}
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    background: isCompleted ? 'var(--primary-gradient)' : 'var(--secondary)',
                    border: isActive ? '2px solid #fff' : '2px solid rgba(255,255,255,0.08)',
                    color: isCompleted ? '#fff' : 'var(--muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '700',
                    cursor: transitioning ? 'not-allowed' : 'pointer',
                    boxShadow: isActive ? '0 0 15px var(--primary-glow)' : 'none'
                  }}
                >
                  {step.num}
                </button>
                <span style={{
                  marginTop: '12px',
                  fontSize: '0.8rem',
                  fontWeight: isActive ? '600' : '400',
                  color: isActive ? '#fff' : 'var(--muted)',
                  textAlign: 'center'
                }}>{step.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Grid panels */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '32px', alignItems: 'start' }}>
        {/* Left Column: Quick actions & Logs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* Action triggers */}
          <div className="glass-panel">
            <h3 style={{ marginBottom: '20px' }}>PDF Compilation Actions</h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px'
            }}>
              {/* Approval Sheet trigger */}
              <div className="glass-panel" style={{ background: 'rgba(255,255,255,0.01)', padding: '16px' }}>
                <h4 style={{ fontSize: '0.95rem', marginBottom: '8px' }}>1. Layout Approval Proofs</h4>
                <p style={{ fontSize: '0.75rem', marginBottom: '16px' }}>
                  Generates an A4 compilation sheet watermarked for client review.
                </p>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button 
                    className="btn btn-primary" 
                    style={{ fontSize: '0.8rem', padding: '8px 12px', flex: 1 }}
                    onClick={() => handleCompilePdf('APPROVAL')}
                    disabled={pdfLoading !== null}
                  >
                    {pdfLoading === 'APPROVAL' ? 'Queueing...' : 'Compile Proofs'}
                  </button>
                  <button 
                    className="btn btn-secondary" 
                    style={{ padding: '8px' }}
                    onClick={handleWhatsAppShare}
                  >
                    <Share2 size={16} />
                  </button>
                </div>
                {renderJobStatus('APPROVAL')}
              </div>

              {/* Production Layout Sheet trigger */}
              <div className="glass-panel" style={{ background: 'rgba(255,255,255,0.01)', padding: '16px' }}>
                <h4 style={{ fontSize: '0.95rem', marginBottom: '8px' }}>2. Production Layout grid</h4>
                <p style={{ fontSize: '0.75rem', marginBottom: '12px' }}>
                  Generates CMYK PDF/X grids on A3 layout sheets with crop and fold marks.
                </p>

                {/* Layout Settings Toggle */}
                <button
                  type="button"
                  onClick={() => setShowLayoutSettings(v => !v)}
                  style={{
                    fontSize: '0.72rem',
                    padding: '4px 10px',
                    marginBottom: '10px',
                    borderRadius: '6px',
                    border: '1px solid var(--glass-border)',
                    background: showLayoutSettings ? 'rgba(99,102,241,0.15)' : 'transparent',
                    color: showLayoutSettings ? 'var(--primary)' : 'var(--muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  ⚙ Layout Settings {showLayoutSettings ? '▲' : '▼'}
                </button>

                {showLayoutSettings && (
                  <div style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '8px',
                    padding: '12px',
                    marginBottom: '12px',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '10px',
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <label style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>Paper Size</label>
                      <select
                        className="form-input"
                        style={{ padding: '4px 8px', fontSize: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', color: 'var(--foreground)' }}
                        value={layoutPaperSize}
                        onChange={e => handleUpdateLayoutConfig('paperSize', e.target.value)}
                      >
                        <option value="A3">A3 Sheet</option>
                        <option value="A4">A4 Sheet</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <label style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>Orientation</label>
                      <select
                        className="form-input"
                        style={{ padding: '4px 8px', fontSize: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', color: 'var(--foreground)' }}
                        value={layoutOrientation}
                        onChange={e => handleUpdateLayoutConfig('orientation', e.target.value)}
                      >
                        <option value="PORTRAIT">Portrait</option>
                        <option value="LANDSCAPE">Landscape</option>
                      </select>
                    </div>

                     {([
                       { label: 'Left Margin (pt)',   value: layoutMarginLeft,   field: 'marginLeft' },
                       { label: 'Top Margin (pt)',    value: layoutMarginTop,    field: 'marginTop' },
                       { label: 'Right Margin (pt)',  value: layoutMarginRight,  field: 'marginRight' },
                       { label: 'Bottom Margin (pt)', value: layoutMarginBottom, field: 'marginBottom' },
                       { label: 'Col Gap (pt)',       value: layoutColGap,       field: 'colGap' },
                       { label: 'Row Gap (pt)',       value: layoutRowGap,       field: 'rowGap' },
                       { label: 'Bleed (pt)',         value: layoutBleed,        field: 'bleed' },
                     ] as const).map(({ label, value, field }) => (
                       <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                         <label style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>{label}</label>
                         <input
                           type="number"
                           min={0}
                           max={200}
                           className="form-input"
                           style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                           value={value}
                           onChange={e => handleUpdateLayoutConfig(field, Number(e.target.value))}
                         />
                       </div>
                     ))}
                     <div style={{ display: 'flex', alignItems: 'center', gap: '12px', gridColumn: 'span 2', marginTop: '6px' }}>
                       <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--muted)', cursor: 'pointer' }}>
                         <input
                           type="checkbox"
                           checked={layoutCropMarks}
                           onChange={e => handleUpdateLayoutConfig('cropMarks', e.target.checked)}
                           style={{ cursor: 'pointer', accentColor: 'var(--primary)' }}
                         />
                         Crop Marks
                       </label>
                       <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--muted)', cursor: 'pointer' }}>
                         <input
                           type="checkbox"
                           checked={layoutFoldLine}
                           onChange={e => handleUpdateLayoutConfig('foldLine', e.target.checked)}
                           style={{ cursor: 'pointer', accentColor: 'var(--primary)' }}
                         />
                         Fold Lines
                       </label>
                     </div>
                     <div style={{ gridColumn: 'span 2', fontSize: '0.68rem', color: 'var(--muted)', marginTop: '2px' }}>
                       Default: Margins 40 pt · Col/Row Gap 15 pt · Bleed 0 pt · Values in PDF points (1 pt ≈ 0.35 mm)
                     </div>
                  </div>
                )}

                <button
                  className="btn btn-primary"
                  style={{ fontSize: '0.8rem', padding: '8px 12px', width: '100%', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', boxShadow: '0 4px 14px 0 rgba(16,185,129,0.25)' }}
                  onClick={() => handleCompilePdf('PRODUCTION')}
                  disabled={pdfLoading !== null || (order.status !== 'APPROVED' && order.status !== 'PRINTING')}
                >
                  {pdfLoading === 'PRODUCTION' ? 'Queueing...' : 'Compile Production PDF'}
                </button>
                {order.status !== 'APPROVED' && order.status !== 'PRINTING' && (
                  <span style={{ display: 'block', fontSize: '0.65rem', color: '#f87171', marginTop: '6px', textAlign: 'center' }}>
                    * Requires order status set to APPROVED.
                  </span>
                )}
                {renderJobStatus('PRODUCTION')}
              </div>

              {/* Individual ID card PDF trigger */}
              <div className="glass-panel" style={{ background: 'rgba(255,255,255,0.01)', padding: '16px' }}>
                <h4 style={{ fontSize: '0.95rem', marginBottom: '8px' }}>3. CR-80 Individual Cards</h4>
                <p style={{ fontSize: '0.75rem', marginBottom: '16px' }}>
                  Generates individual CR-80 sized card cuts (front + back) for printing.
                </p>
                <button 
                  className="btn btn-secondary" 
                  style={{ fontSize: '0.8rem', padding: '8px 12px', width: '100%' }}
                  onClick={() => handleCompilePdf('INDIVIDUAL')}
                  disabled={pdfLoading !== null}
                >
                  {pdfLoading === 'INDIVIDUAL' ? 'Queueing...' : 'Compile Individual PDF'}
                </button>
                {renderJobStatus('INDIVIDUAL')}
              </div>

              {/* Order Invoice PDF trigger */}
              <div className="glass-panel" style={{ background: 'rgba(255,255,255,0.01)', padding: '16px' }}>
                <h4 style={{ fontSize: '0.95rem', marginBottom: '8px' }}>4. Billing Invoice PDF</h4>
                <p style={{ fontSize: '0.75rem', marginBottom: '16px' }}>
                  Compiles automated invoice bill containing details and tax summary.
                </p>
                <button 
                  className="btn btn-secondary" 
                  style={{ fontSize: '0.8rem', padding: '8px 12px', width: '100%' }}
                  onClick={() => handleCompilePdf('INVOICE')}
                  disabled={pdfLoading !== null}
                >
                  {pdfLoading === 'INVOICE' ? 'Queueing...' : 'Compile Invoice PDF'}
                </button>
                {renderJobStatus('INVOICE')}
              </div>
            </div>
          </div>

          {/* Activity Log Tracker */}
          <div className="glass-panel">
            <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <History size={18} color="var(--primary)" /> Activity Log Timeline
            </h3>
            {logs.length === 0 ? (
              <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>No activities logged for this order yet.</span>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderLeft: '2px solid rgba(255,255,255,0.05)', paddingLeft: '20px', marginLeft: '10px' }}>
                {logs.map((log) => (
                  <div key={log.id} style={{ position: 'relative' }}>
                    <div style={{
                      position: 'absolute',
                      left: '-26px',
                      top: '4px',
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: 'var(--primary)'
                    }}></div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                      {new Date(log.timestamp).toLocaleString()} • {log.actorName}
                    </span>
                    <h5 style={{ fontSize: '0.875rem', marginTop: '2px', fontWeight: '600' }}>{log.action}</h5>
                    {log.note && <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '4px' }}>{log.note}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Billing Invoice & Discussion Notes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* Invoice Summary */}
          <div className="glass-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <CreditCard size={18} color="var(--info)" /> Billing Invoice
              </h3>
              {order?.invoice && (
                <button
                  className="btn btn-secondary"
                  style={{ padding: '5px 12px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  onClick={handleOpenInvoiceEdit}
                >
                  <Edit size={12} /> Edit
                </button>
              )}
            </div>
            {order?.invoice ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.875rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--muted)' }}>Cards Quantity:</span>
                  <span style={{ fontWeight: '600' }}>{order.invoice.cardCount} cards</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--muted)' }}>Price Per Card:</span>
                  <span style={{ fontWeight: '600' }}>Rs. {Number(order.invoice.pricePerCard).toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ color: 'var(--muted)' }}>Subtotal:</span>
                  <span style={{ fontWeight: '600' }}>Rs. {Number(order.invoice.subtotal).toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--muted)' }}>GST/Tax ({order.invoice.taxPercent}%):</span>
                  <span style={{ fontWeight: '600' }}>Rs. {Number(order.invoice.taxAmount).toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.08)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <span style={{ fontWeight: '600' }}>Total Bill:</span>
                  <span style={{ fontWeight: '700', fontSize: '1.05rem', color: 'var(--info)' }}>Rs. {Number(order.invoice.totalAmount).toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--muted)' }}>Status:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {order.invoice.paymentStatus === 'PAID' ? (
                      <>
                        <span className="badge badge-success">Paid ({order.invoice.paymentMethod})</span>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                          disabled={transitioning}
                          onClick={async () => {
                            setTransitioning(true);
                            try {
                              const res = await fetch(`/api/orders/${orderId}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ paymentStatus: 'UNPAID' }),
                              });
                              const data = await res.json();
                              if (!res.ok) throw new Error(data.error || 'Failed to update payment status');
                              fetchData();
                            } catch (err: any) {
                              alert(err.message || 'Error updating payment status');
                            } finally {
                              setTransitioning(false);
                            }
                          }}
                        >
                          Mark Unpaid
                        </button>
                      </>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="badge badge-danger">Unpaid</span>
                        <select
                          id="paymentMethodSelect"
                          className="form-select"
                          style={{ padding: '4px 8px', fontSize: '0.75rem', width: 'auto', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)' }}
                          defaultValue="CASH"
                        >
                          <option value="CASH">Cash</option>
                          <option value="UPI">UPI</option>
                          <option value="BANK_TRANSFER">Bank Transfer</option>
                          <option value="CHEQUE">Cheque</option>
                        </select>
                        <button
                          className="btn btn-primary"
                          style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                          disabled={transitioning}
                          onClick={async () => {
                            const selectEl = document.getElementById('paymentMethodSelect') as HTMLSelectElement;
                            const method = selectEl ? selectEl.value : 'CASH';
                            setTransitioning(true);
                            try {
                              const res = await fetch(`/api/orders/${orderId}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ paymentStatus: 'PAID', paymentMethod: method }),
                              });
                              const data = await res.json();
                              if (!res.ok) throw new Error(data.error || 'Failed to update payment status');
                              fetchData();
                            } catch (err: any) {
                              alert(err.message || 'Error updating payment status');
                            } finally {
                              setTransitioning(false);
                            }
                          }}
                        >
                          Mark Paid
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>No invoice found.</span>
            )}
          </div>

          {/* Notes section */}
          <div className="glass-panel">
            <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MessageSquare size={18} color="var(--warning)" /> Client Discussions
            </h3>
            
            <form onSubmit={handleAddNote} style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              <input
                type="text"
                required
                className="form-input"
                placeholder="Add remark or note..."
                value={noteContent}
                onChange={e => setNoteContent(e.target.value)}
              />
              <button type="submit" className="btn btn-primary" style={{ padding: '10px 14px' }}>Send</button>
            </form>

            {notes.length === 0 ? (
              <span style={{ fontSize: '0.85rem', color: 'var(--muted)', display: 'block', textAlign: 'center', padding: '16px 0' }}>
                No notes in this discussion thread.
              </span>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '300px', overflowY: 'auto' }}>
                {notes.map((n) => (
                  <div key={n.id} className="glass-panel" style={{ background: 'rgba(255,255,255,0.01)', padding: '12px', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--muted)', marginBottom: '6px' }}>
                      <strong style={{ color: '#fff' }}>{n.authorName}</strong>
                      <span>{new Date(n.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{n.note}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* PDF Inline Preview Modal */}
      {previewJob && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(10, 10, 12, 0.85)',
          backdropFilter: 'blur(12px)',
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '24px'
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: '1000px',
            height: '90vh',
            display: 'flex',
            flexDirection: 'column',
            padding: '0',
            overflow: 'hidden',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 24px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              background: 'rgba(255, 255, 255, 0.01)'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600' }}>
                  Preview: {previewJob.fileName}
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                  Order #{previewJob.orderId} • {previewJob.pdfType} ({previewJob.label || `v${previewJob.version || 1}`})
                </span>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <a
                  href={`/api/jobs/${previewJob.id}/download`}
                  className="btn btn-primary"
                  style={{ padding: '6px 12px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Download size={12} /> Download
                </a>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '6px', minWidth: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onClick={() => setPreviewJob(null)}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Modal Content - Embed PDF */}
            <div style={{ flex: 1, background: '#1c1c1e', position: 'relative' }}>
              <iframe
                src={`/api/jobs/${previewJob.id}/download?inline=true`}
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  background: '#1c1c1e'
                }}
                title={previewJob.fileName}
              />
            </div>
          </div>
        </div>
      )}

      {/* Invoice Edit Modal */}
      {showInvoiceEdit && (
        <div
          onClick={() => setShowInvoiceEdit(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(3,4,7,0.8)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: 'rgba(13,16,27,0.97)', border: '1px solid var(--glass-border)', borderTop: '2px solid var(--info)', borderRadius: '16px', padding: '28px 32px', width: '100%', maxWidth: '520px', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
                <CreditCard size={18} color="var(--info)" /> Edit Invoice #INV-{order?.invoice?.id}
              </h3>
              <button onClick={() => setShowInvoiceEdit(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateInvoice} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Price per Card (Rs.)</label>
                  <input type="number" required step="0.01" min="0" className="form-input" value={invPricePerCard} onChange={e => setInvPricePerCard(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">GST / Tax Percent (%)</label>
                  <input type="number" required step="0.1" min="0" max="100" className="form-input" value={invTaxPercent} onChange={e => setInvTaxPercent(e.target.value)} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Cards Quantity</label>
                <input type="number" required min="1" className="form-input" value={invCardCount} onChange={e => setInvCardCount(e.target.value)} />
              </div>

              {/* Live preview of totals */}
              {invPricePerCard && invCardCount && invTaxPercent && (() => {
                const sub = Number(invPricePerCard) * Number(invCardCount);
                const tax = (sub * Number(invTaxPercent)) / 100;
                return (
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.83rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)' }}>
                      <span>Subtotal ({invCardCount} × Rs. {Number(invPricePerCard).toFixed(2)})</span>
                      <span style={{ color: '#fff', fontWeight: '600' }}>Rs. {sub.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)' }}>
                      <span>GST ({invTaxPercent}%)</span>
                      <span style={{ color: '#fff', fontWeight: '600' }}>Rs. {tax.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                      <span style={{ fontWeight: '600' }}>Total</span>
                      <span style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--info)' }}>Rs. {(sub + tax).toFixed(2)}</span>
                    </div>
                  </div>
                );
              })()}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Payment Status</label>
                  <select className="form-select" value={invPaymentStatus} onChange={e => setInvPaymentStatus(e.target.value)}>
                    <option value="UNPAID">Unpaid</option>
                    <option value="PAID">Paid</option>
                  </select>
                </div>
                {invPaymentStatus === 'PAID' && (
                  <div className="form-group">
                    <label className="form-label">Payment Method</label>
                    <select className="form-select" value={invPaymentMethod} onChange={e => setInvPaymentMethod(e.target.value)}>
                      <option value="CASH">Cash</option>
                      <option value="UPI">UPI</option>
                      <option value="BANK_TRANSFER">Bank Transfer</option>
                      <option value="CHEQUE">Cheque</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Notes / Remarks</label>
                <textarea className="form-input" style={{ height: '64px', resize: 'vertical' }} value={invNotes} onChange={e => setInvNotes(e.target.value)} placeholder="e.g. Advance received, balance pending..." />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '4px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowInvoiceEdit(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={invSubmitting}>
                  {invSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
