'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
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
  AlertTriangle,
  Edit,
  Zap,
  Activity
} from 'lucide-react';

interface OrderClient {
  id: number;
  name: string;
}

interface OrderInvoice {
  id: number;
  pricePerCard: number;
  taxPercent: number;
  cardCount: number;
  paymentStatus: string;
  paymentMethod?: string;
  notes?: string;
  subtotal?: number;
  taxAmount?: number;
  totalAmount?: number;
}

interface OrderPdfJob {
  id: number;
  pdfType: string;
  status: string;
  progress: number;
  label?: string;
  version: number;
  expiresAt?: string;
  isLocalJob?: boolean;
  downloadUrl?: string;
  errorMsg?: string;
  fileName?: string;
  orderId?: number;
}

interface OrderTemplate {
  id: number;
  name: string;
  cardWidth?: number;
  cardHeight?: number;
  backImageUrl?: string | null;
  backFields?: string | null;
}

interface OrderDetails {
  id: number;
  clientId: number;
  templateId: number;
  status: string;
  client?: OrderClient;
  template?: OrderTemplate;
  invoice?: OrderInvoice;
  pdfJobs?: OrderPdfJob[];
  _count?: {
    cardholders: number;
  };
  cardholders?: any[];
}

interface OrderLog {
  id: number;
  timestamp: string;
  actorName: string;
  action: string;
  note?: string;
}

interface OrderNote {
  id: number;
  createdAt: string;
  authorName: string;
  note: string;
}

export default function OrderDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = Number(params.id);
  const { toast } = useToast();

  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [logs, setLogs] = useState<OrderLog[]>([]);
  const [notes, setNotes] = useState<OrderNote[]>([]);
  const [noteContent, setNoteContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState('OWNER');

  // Fetch role
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/settings/me');
        if (res.ok) { const j = await res.json(); if (j.user?.role) setRole(j.user.role); }
      } catch { /* silent */ }
    })();
  }, []);

  const isOwner = role === 'OWNER';

  // Status transitions
  const [transitioning, setTransitioning] = useState(false);

  // PDF trigger states
  const [pdfLoading, setPdfLoading] = useState<string | null>(null);
  const [previewJob, setPreviewJob] = useState<OrderPdfJob | null>(null);

  // Pre-print Validation Modals
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [showEmptySlotModal, setShowEmptySlotModal] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [emptySlotStrategy, setEmptySlotStrategy] = useState<'LEAVE_BLANK' | 'REPEAT_LAST' | 'REPEAT_FIRST' | 'FILL_CUSTOM'>('LEAVE_BLANK');
  const [pendingCompileType, setPendingCompileType] = useState<string | null>(null);

  // Compile Wizard states
  const [showCompileWizard, setShowCompileWizard] = useState(false);
  const [wizardCompileType, setWizardCompileType] = useState<'APPROVAL' | 'PRODUCTION' | null>(null);
  const [wizardStep, setWizardStep] = useState<1 | 2>(1);
  const [wizardPaperSize, setWizardPaperSize] = useState('A3');
  const [wizardOrientation, setWizardOrientation] = useState<'PORTRAIT' | 'LANDSCAPE'>('PORTRAIT');
  const [wizardStrategy, setWizardStrategy] = useState<'LEAVE_BLANK' | 'REPEAT_LAST' | 'REPEAT_FIRST' | 'FILL_CUSTOM'>('LEAVE_BLANK');

  const [customCards, setCustomCards] = useState<any[]>([]);
  const [selectedCustomCardId, setSelectedCustomCardId] = useState<string>('');
  const [isUploadingCustomCard, setIsUploadingCustomCard] = useState(false);

  const loadCustomCardsList = async () => {
    try {
      const { getCustomCards } = await import('@/lib/clientDb');
      const list = await getCustomCards();
      setCustomCards(list);
      if (list.length > 0 && !selectedCustomCardId) {
        setSelectedCustomCardId(list[0].id);
      }
    } catch (err) {
      console.error('Failed to load custom cards:', err);
    }
  };

  useEffect(() => {
    if (showCompileWizard || showEmptySlotModal) {
      loadCustomCardsList();
    }
  }, [showCompileWizard, showEmptySlotModal]);

  const handleCustomCardUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast('Please upload a PDF file only.', 'error');
      return;
    }
    setIsUploadingCustomCard(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Bytes = (reader.result as string).split(',')[1];
          const { saveCustomCard } = await import('@/lib/clientDb');
          const saved = await saveCustomCard(file.name, base64Bytes);
          toast(`Custom PDF card "${file.name}" saved locally!`, 'success');
          setSelectedCustomCardId(saved.id);
          await loadCustomCardsList();
        } catch (err: any) {
          toast(err.message || 'Failed to save custom card', 'error');
        } finally {
          setIsUploadingCustomCard(false);
        }
      };
      reader.onerror = () => {
        toast('Failed to read PDF file', 'error');
        setIsUploadingCustomCard(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      toast(err.message || 'Failed to upload custom card', 'error');
      setIsUploadingCustomCard(false);
    }
  };

  const handleCustomCardDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this custom PDF card?')) return;
    try {
      const { deleteCustomCard } = await import('@/lib/clientDb');
      await deleteCustomCard(id);
      toast('Custom PDF card deleted.', 'success');
      if (selectedCustomCardId === id) {
        setSelectedCustomCardId('');
      }
      await loadCustomCardsList();
    } catch (err: any) {
      toast(err.message || 'Failed to delete custom card', 'error');
    }
  };

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
    const inv = order.invoice;
    setInvPricePerCard(String(Number(inv.pricePerCard)));
    setInvTaxPercent(String(Number(inv.taxPercent)));
    setInvCardCount(String(inv.cardCount));
    setInvPaymentStatus(inv.paymentStatus);
    setInvPaymentMethod(inv.paymentMethod || 'CASH');
    setInvNotes(inv.notes || '');
    setShowInvoiceEdit(true);
  };

  const handleUpdateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order?.invoice) return;
    const inv = order.invoice;
    setInvSubmitting(true);
    try {
      const res = await fetch('/api/invoices', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: inv.id,
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
      toast(err.message || 'Update failed', 'error');
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

  // Update Status and automate pipeline actions (PDF compilation)
  const handleWorkflowAction = async (newStatus: string) => {
    setTransitioning(true);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update status');

      toast(`Order stage updated to: ${newStatus}`, 'success');

      // Refresh order details first to display status change
      await fetchData();

      // Automate PDF compilation depending on the new status
      if (newStatus === 'APPROVAL_PDF_SENT') {
        openCompileWizard('APPROVAL');
      } else if (newStatus === 'PRINTING') {
        openCompileWizard('PRODUCTION');
      } else if (newStatus === 'DELIVERED' && isOwner) {
        await handleCompilePdf('INVOICE');
      }
    } catch (err: any) {
      toast(err.message || 'Status transition error', 'error');
    } finally {
      setTransitioning(false);
    }
  };

  const proceedWithCompile = async (
    type: string,
    skipValidation = false,
    selectedStrategy: 'LEAVE_BLANK' | 'REPEAT_LAST' | 'REPEAT_FIRST' | 'FILL_CUSTOM' = 'LEAVE_BLANK',
    overridePaperSize?: string,
    overrideOrientation?: string
  ) => {
    setPdfLoading(type);
    try {
      const targetPaperSize = overridePaperSize || layoutPaperSize;
      const targetOrientation = overrideOrientation || layoutOrientation;

      const body: any = {
        orderId,
        pdfType: type,
        paperSize: type === 'INVOICE' ? 'A4' : (targetPaperSize === 'SRA3' || targetPaperSize === '13x19' ? 'CUSTOM' : targetPaperSize),
        orientation: type === 'INVOICE' ? 'PORTRAIT' : targetOrientation,
        emptySlotStrategy: selectedStrategy,
        bypassValidation: skipValidation,
      };

      if (selectedStrategy === 'FILL_CUSTOM') {
        body.emptySlotCustomCardId = selectedCustomCardId;
      }

      if (type !== 'INVOICE') {
        if (targetPaperSize === 'SRA3') {
          body.customWidth = targetOrientation === 'PORTRAIT' ? 907.09 : 1275.59;
          body.customHeight = targetOrientation === 'PORTRAIT' ? 1275.59 : 907.09;
        } else if (targetPaperSize === '13x19') {
          body.customWidth = targetOrientation === 'PORTRAIT' ? 936 : 1368;
          body.customHeight = targetOrientation === 'PORTRAIT' ? 1368 : 936;
        }
      }

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

      const endpoint = '/api/jobs/production-request';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error compiling PDF');
      
      window.dispatchEvent(new Event('refresh-profile'));

      const cardCount = order?._count?.cardholders ?? order?.cardholders?.length ?? 0;
      if (type === 'PRODUCTION') {
        toast(`Production job #${data.jobId} queued! Compiling on Desktop App. Locked ${cardCount} credits.`, 'success');
      } else if (type === 'INVOICE') {
        toast(`Invoice job #${data.jobId} queued! Compiling on Desktop App.`, 'success');
      } else {
        toast(`Approval draft job #${data.jobId} queued! Compiling on Desktop App.`, 'success');
      }
      fetchData();
    } catch (err: any) {
      toast(err.message || 'Error compiling PDF', 'error');
    } finally {
      setPdfLoading(null);
    }
  };

  const openCompileWizard = (type: 'APPROVAL' | 'PRODUCTION') => {
    setWizardCompileType(type);
    setWizardPaperSize(layoutPaperSize);
    setWizardOrientation(layoutOrientation as any);
    setWizardStrategy(emptySlotStrategy);
    setWizardStep(1);
    setShowCompileWizard(true);
  };

  const handleWizardCompile = async () => {
    if (!wizardCompileType || !order) return;

    // 1. Update the layout configs so the compiler uses them
    handleUpdateLayoutConfig('paperSize', wizardPaperSize);
    handleUpdateLayoutConfig('orientation', wizardOrientation);
    setEmptySlotStrategy(wizardStrategy);

    setShowCompileWizard(false);
    setPdfLoading(wizardCompileType);

    try {
      // 1. Fetch template field requirements for validation
      const fieldsRes = await fetch(`/api/templates/${order.templateId}/fields`);
      if (!fieldsRes.ok) throw new Error('Failed to fetch template fields for validation');
      const fieldsData = await fieldsRes.json();
      const templateFields = fieldsData.fields || [];

      // 2. Scan cardholders for missing required fields
      const missingList: { cardholderName: string; missingFields: string[]; cardholderId: number }[] = [];
      const requiredFields = templateFields.filter((f: any) => f.isRequired);

      for (const item of (order.cardholders || [])) {
        const ch = item.cardholder;
        if (!ch) continue;
        const missingFields: string[] = [];
        
        let custom: Record<string, any> = {};
        if (ch.customFields) {
          try {
            custom = typeof ch.customFields === 'string' ? JSON.parse(ch.customFields) : ch.customFields;
          } catch {}
        }
        
        for (const f of requiredFields) {
          let hasValue = false;
          const fieldName = f.field.toLowerCase();
          
          if (fieldName === 'name' || fieldName === 'fullname') {
            hasValue = !!ch.name && ch.name.trim().length > 0;
          } else if (fieldName === 'designation' || fieldName === 'role') {
            hasValue = !!ch.designation && ch.designation.trim().length > 0;
          } else if (fieldName === 'photo' || fieldName === 'photourl' || fieldName === 'avatar' || fieldName === 'profile') {
            hasValue = !!ch.photoUrl && ch.photoUrl.trim().length > 0;
          } else if (fieldName === 'uniquekey' || fieldName === 'id' || f.type === 'id') {
            const idVal = custom.uniqueKey || custom.id || custom.unique_key;
            hasValue = !!idVal && String(idVal).trim().length > 0;
          } else {
            const targetLower = f.field.toLowerCase().trim();
            let val = undefined;
            for (const [key, v] of Object.entries(custom)) {
              if (key.toLowerCase().trim() === targetLower) {
                val = v;
                break;
              }
            }
            hasValue = val !== undefined && val !== null && String(val).trim().length > 0;
          }
          
          if (!hasValue) {
            missingFields.push(f.prefix || f.field);
          }
        }
        
        if (missingFields.length > 0) {
          missingList.push({
            cardholderName: ch.name || `Cardholder #${ch.id}`,
            missingFields,
            cardholderId: ch.id,
          });
        }
      }

      if (missingList.length > 0) {
        setValidationResult({
          missingFields: missingList,
          totalCards: (order.cardholders || []).length,
          totalSlots: 0,
        });
        setPendingCompileType(wizardCompileType);
        setShowValidationModal(true);
        setPdfLoading(null);
      } else {
        await proceedWithCompile(wizardCompileType, false, wizardStrategy, wizardPaperSize, wizardOrientation);
      }
    } catch (err: any) {
      toast(err.message || 'Validation failed', 'error');
      setPdfLoading(null);
    }
  };

  // Compile PDF Job (with pre-print validation checks)
  const handleCompilePdf = async (type: string) => {
    if (type === 'INVOICE') {
      await proceedWithCompile(type);
      return;
    }

    if (!order || !order.cardholders || order.cardholders.length === 0) {
      toast('No cardholders in this order to print.', 'error');
      return;
    }

    setPdfLoading(type);
    try {
      // 1. Fetch template field requirements
      const fieldsRes = await fetch(`/api/templates/${order.templateId}/fields`);
      if (!fieldsRes.ok) throw new Error('Failed to fetch template fields for validation');
      const fieldsData = await fieldsRes.json();
      const templateFields = fieldsData.fields || [];

      // 2. Scan cardholders for missing required fields
      const missingList: { cardholderName: string; missingFields: string[]; cardholderId: number }[] = [];
      const requiredFields = templateFields.filter((f: any) => f.isRequired);

      for (const item of order.cardholders) {
        const ch = item.cardholder;
        if (!ch) continue;
        const missingFields: string[] = [];
        
        let custom: Record<string, any> = {};
        if (ch.customFields) {
          try {
            custom = typeof ch.customFields === 'string' ? JSON.parse(ch.customFields) : ch.customFields;
          } catch {}
        }
        
        for (const f of requiredFields) {
          let hasValue = false;
          const fieldName = f.field.toLowerCase();
          
          if (fieldName === 'name' || fieldName === 'fullname') {
            hasValue = !!ch.name && ch.name.trim().length > 0;
          } else if (fieldName === 'designation' || fieldName === 'role') {
            hasValue = !!ch.designation && ch.designation.trim().length > 0;
          } else if (fieldName === 'photo' || fieldName === 'photourl' || fieldName === 'avatar' || fieldName === 'profile') {
            hasValue = !!ch.photoUrl && ch.photoUrl.trim().length > 0;
          } else if (fieldName === 'uniquekey' || fieldName === 'id' || f.type === 'id') {
            const idVal = custom.uniqueKey || custom.id || custom.unique_key;
            hasValue = !!idVal && String(idVal).trim().length > 0;
          } else {
            // Case-insensitive custom field check
            const targetLower = f.field.toLowerCase().trim();
            let val = undefined;
            for (const [key, v] of Object.entries(custom)) {
              if (key.toLowerCase().trim() === targetLower) {
                val = v;
                break;
              }
            }
            hasValue = val !== undefined && val !== null && String(val).trim().length > 0;
          }
          
          if (!hasValue) {
            missingFields.push(f.prefix || f.field);
          }
        }
        
        if (missingFields.length > 0) {
          missingList.push({
            cardholderName: ch.name || `Cardholder #${ch.id}`,
            missingFields,
            cardholderId: ch.id,
          });
        }
      }

      // 3. Calculate empty slots
      let pageWidth = 841.89; // A3
      let pageHeight = 1190.55;
      if (layoutPaperSize === 'A4') {
        pageWidth = 595.27;
        pageHeight = 841.89;
      }
      
      if (layoutPaperSize === 'SRA3') {
        pageWidth = layoutOrientation === 'PORTRAIT' ? 907.09 : 1275.59;
        pageHeight = layoutOrientation === 'PORTRAIT' ? 1275.59 : 907.09;
      } else if (layoutPaperSize === '13x19') {
        pageWidth = layoutOrientation === 'PORTRAIT' ? 936 : 1368;
        pageHeight = layoutOrientation === 'PORTRAIT' ? 1368 : 936;
      } else if (layoutOrientation === 'LANDSCAPE') {
        const temp = pageWidth;
        pageWidth = pageHeight;
        pageHeight = temp;
      }

      const bleedPt = (layoutBleed || 0) * 2.83464567;
      const isPortraitTemplate = (order.template?.cardWidth || 673) < (order.template?.cardHeight || 1039);
      const cardBaseWidth = isPortraitTemplate ? 153 : 242.6;
      const cardBaseHeight = isPortraitTemplate ? 242.6 : 153;

      const cWidth = cardBaseWidth + bleedPt * 2;
      const cHeight = cardBaseHeight + bleedPt * 2;

      const marginX    = layoutMarginLeft  ?? 40;
      const marginXR   = layoutMarginRight ?? 40;
      const marginY    = layoutMarginTop   ?? 40;
      const marginYB   = layoutMarginBottom ?? 40;
      const colGap     = layoutColGap      ?? 15;
      const rowGap     = layoutRowGap      ?? 15;

      const foldGap = 10;
      const isSingleSided = !order.template?.backImageUrl || (order.template?.backFields === '[]' || !order.template?.backFields);

      const cols = Math.floor((pageWidth - marginX - marginXR + colGap) / (cWidth + colGap)) || 1;

      let cardsPerPage: number;
      let rowsPerPage: number;

      if (isSingleSided) {
        const fullHeight = pageHeight - marginY - marginYB;
        rowsPerPage = Math.floor((fullHeight + rowGap) / (cHeight + rowGap)) || 1;
        cardsPerPage = cols * rowsPerPage;
      } else {
        const centerY = pageHeight / 2;
        const halfHeight = centerY - Math.max(marginY, marginYB);
        const rowsPerHalf = Math.floor((halfHeight - foldGap + rowGap) / (cHeight + rowGap)) || 1;
        rowsPerPage = rowsPerHalf;
        cardsPerPage = cols * rowsPerHalf;
      }

      const totalCards = order.cardholders.length;
      const totalPages = Math.ceil(totalCards / cardsPerPage);
      const totalSlots = totalPages * cardsPerPage;

      const validation = {
        missingFields: missingList,
        totalCards,
        totalSlots,
      };

      setValidationResult(validation);
      setPendingCompileType(type);
      setPdfLoading(null);

      // Trigger modals based on validation
      if (missingList.length > 0) {
        setShowValidationModal(true);
      } else if (totalSlots > totalCards) {
        setShowEmptySlotModal(true);
      } else {
        await proceedWithCompile(type, false, 'LEAVE_BLANK');
      }
    } catch (err: any) {
      toast(err.message || 'Validation failed', 'error');
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
      toast(err.message || 'Error occurred', 'error');
    }
  };

  // Clone Order
  const handleClone = async () => {
    if (!confirm('Are you sure you want to clone this order settings as a new Draft?')) return;
    try {
      const res = await fetch(`/api/orders/${orderId}/clone`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Clone failed');

      toast('Order cloned successfully!', 'success');
      router.push(`/dashboard/orders/${data.order.id}`);
    } catch (err: any) {
      toast(err.message || 'Clone error', 'error');
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
  const cardholderCount = order?._count?.cardholders ?? (order?.cardholders?.length ?? 0);

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
                <div
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
                    boxShadow: isActive ? '0 0 15px var(--primary-glow)' : 'none'
                  }}
                >
                  {step.num}
                </div>
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

      {/* Workflow Action Control */}
      {(() => {
        if (!order) return null;

        let nextActionLabel = '';
        let nextStatus = '';
        let actionDescription = '';

        switch (order.status) {
          case 'DRAFT':
            nextActionLabel = 'Send for Approval';
            nextStatus = 'APPROVAL_PDF_SENT';
            actionDescription = 'This will generate watermarked PDF proofs and transition the order to the "Approval Sent" stage.';
            break;
          case 'APPROVAL_PDF_SENT':
            nextActionLabel = 'Approve Layout';
            nextStatus = 'APPROVED';
            actionDescription = 'The client has approved the layout. Transition the order to the "Approved layout" stage.';
            break;
          case 'APPROVED':
            nextActionLabel = 'Send to Printing Press';
            nextStatus = 'PRINTING';
            actionDescription = 'This will compile the CMYK print grids on A3 layout sheets and lock printing credits.';
            break;
          case 'PRINTING':
            if (isOwner) {
              nextActionLabel = 'Mark as Delivered';
              nextStatus = 'DELIVERED';
              actionDescription = 'The cards have been printed and delivered. This will generate the invoice PDF.';
            }
            // OPERATOR cannot advance to DELIVERED — no nextStatus set
            break;
          case 'DELIVERED':
            break;
        }

        return (
          <div className="glass-panel" style={{ 
            marginBottom: '32px', 
            padding: '24px', 
            border: '1px solid rgba(99, 102, 241, 0.15)', 
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.03) 0%, rgba(0, 0, 0, 0.2) 100%)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Ambient glow accent */}
            <div style={{
              position: 'absolute',
              top: '-30px',
              right: '-30px',
              width: '120px',
              height: '120px',
              background: 'var(--primary)',
              filter: 'blur(60px)',
              opacity: 0.1,
              pointerEvents: 'none'
            }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'rgba(99, 102, 241, 0.1)',
                  border: '1px solid rgba(99, 102, 241, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--primary)'
                }}>
                  <Zap size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '600' }}>
                    Pipeline Workflow Controller
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--muted)', margin: '4px 0 0 0' }}>
                    Current status: <span className="badge badge-info" style={{ textTransform: 'uppercase', fontSize: '0.7rem' }}>{order.status.replace(/_/g, ' ')}</span>
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                {nextStatus ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                    <button
                      className="btn btn-primary"
                      onClick={() => handleWorkflowAction(nextStatus)}
                      disabled={transitioning || pdfLoading !== null}
                      style={{
                        padding: '10px 20px',
                        fontSize: '0.85rem',
                        fontWeight: '600',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 14px 0 rgba(99, 102, 241, 0.25)',
                        background: nextStatus === 'PRINTING' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'var(--primary-gradient)'
                      }}
                    >
                      {transitioning || pdfLoading ? (
                        <>
                          <span className="spinner" style={{ width: '12px', height: '12px', borderWidth: '1px' }}></span>
                          <span>Processing...</span>
                        </>
                      ) : (
                        <>
                          <Zap size={14} />
                          <span>{nextActionLabel}</span>
                        </>
                      )}
                    </button>
                    {actionDescription && (
                      <span style={{ fontSize: '0.72rem', color: 'var(--muted)', textAlign: 'right', maxWidth: '350px' }}>
                        {actionDescription}
                      </span>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderRadius: '6px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)', color: '#10b981', fontSize: '0.8rem', fontWeight: '500' }}>
                    <CheckCircle size={14} /> Order Completed & Delivered
                  </div>
                )}

                <div style={{ height: '36px', width: '1px', background: 'rgba(255,255,255,0.08)', margin: '0 8px' }} />

                {/* Manual Stage override */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>Force Jump Stage</label>
                  <select
                    className="form-input"
                    style={{ padding: '6px 12px', fontSize: '0.78rem', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', color: 'var(--foreground)', borderRadius: '6px', cursor: 'pointer' }}
                    value={order.status}
                    onChange={(e) => handleWorkflowAction(e.target.value)}
                    disabled={transitioning || pdfLoading !== null}
                  >
                    <option value="DRAFT">1. Draft Config</option>
                    <option value="APPROVAL_PDF_SENT">2. Approval Sent</option>
                    <option value="APPROVED">3. Approved layout</option>
                    <option value="PRINTING">4. Printing Press</option>
                    {isOwner && <option value="DELIVERED">5. Delivered</option>}
                  </select>
                </div>
              </div>
            </div>

            {/* Display status indicators for active jobs if compiling */}
            {(getLatestJob('APPROVAL') || getLatestJob('PRODUCTION') || (isOwner && getLatestJob('INVOICE')) || getLatestJob('INDIVIDUAL')) && (
              <div style={{ 
                marginTop: '20px', 
                paddingTop: '20px', 
                borderTop: '1px solid rgba(255,255,255,0.06)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <h4 style={{ fontSize: '0.8rem', margin: 0, fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary)' }}>
                  <Activity size={14} /> Active PDF Compile Queue
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                  {getLatestJob('APPROVAL') && (
                    <div style={{ padding: '12px', background: 'rgba(255,255,255,0.01)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#fff', marginBottom: '4px' }}>Approval Proofs</div>
                      {renderJobStatus('APPROVAL')}
                    </div>
                  )}
                  {getLatestJob('PRODUCTION') && (
                    <div style={{ padding: '12px', background: 'rgba(255,255,255,0.01)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#fff', marginBottom: '4px' }}>Production Grid</div>
                      {renderJobStatus('PRODUCTION')}
                    </div>
                  )}
                  {getLatestJob('INDIVIDUAL') && (
                    <div style={{ padding: '12px', background: 'rgba(255,255,255,0.01)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#fff', marginBottom: '4px' }}>CR-80 Cards</div>
                      {renderJobStatus('INDIVIDUAL')}
                    </div>
                  )}
                  {isOwner && getLatestJob('INVOICE') && (
                    <div style={{ padding: '12px', background: 'rgba(255,255,255,0.01)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#fff', marginBottom: '4px' }}>Invoice Receipt</div>
                      {renderJobStatus('INVOICE')}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Grid panels */}
      <div className="dashboard-grid-32">
        {/* Left Column: Quick actions & Logs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* Print Layout Configuration */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem' }}>
                ⚙ Print Layout Configuration
              </h3>
              <button
                type="button"
                onClick={() => setShowLayoutSettings(v => !v)}
                style={{
                  fontSize: '0.75rem',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--glass-border)',
                  background: showLayoutSettings ? 'rgba(99,102,241,0.15)' : 'transparent',
                  color: showLayoutSettings ? 'var(--primary)' : 'var(--muted)',
                  cursor: 'pointer',
                }}
              >
                {showLayoutSettings ? 'Collapse' : 'Expand'}
              </button>
            </div>

            {showLayoutSettings && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px',
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Paper Size</label>
                    <select
                      className="form-input"
                      style={{ padding: '6px 10px', fontSize: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', color: 'var(--foreground)' }}
                      value={layoutPaperSize}
                      onChange={e => handleUpdateLayoutConfig('paperSize', e.target.value)}
                    >
                      <option value="A3">A3 Sheet</option>
                      <option value="A4">A4 Sheet</option>
                      <option value="SRA3">SRA3 Sheet</option>
                      <option value="13x19">13" x 19" Sheet</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Orientation</label>
                    <select
                      className="form-input"
                      style={{ padding: '6px 10px', fontSize: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', color: 'var(--foreground)' }}
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
                     <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                       <label style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{label}</label>
                       <input
                         type="number"
                         min={0}
                         max={200}
                         className="form-input"
                         style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                         value={value}
                         onChange={e => handleUpdateLayoutConfig(field, Number(e.target.value))}
                       />
                     </div>
                   ))}
                   <div style={{ display: 'flex', alignItems: 'center', gap: '16px', gridColumn: 'span 2', marginTop: '4px' }}>
                     <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--muted)', cursor: 'pointer' }}>
                       <input
                         type="checkbox"
                         checked={layoutCropMarks}
                         onChange={e => handleUpdateLayoutConfig('cropMarks', e.target.checked)}
                         style={{ cursor: 'pointer', accentColor: 'var(--primary)' }}
                       />
                       Crop Marks
                     </label>
                     <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--muted)', cursor: 'pointer' }}>
                       <input
                         type="checkbox"
                         checked={layoutFoldLine}
                         onChange={e => handleUpdateLayoutConfig('foldLine', e.target.checked)}
                         style={{ cursor: 'pointer', accentColor: 'var(--primary)' }}
                       />
                       Fold Lines
                     </label>
                   </div>
                </div>

                <div style={{ fontSize: '0.7rem', color: 'var(--muted)', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px' }}>
                  Default: Margins 40 pt · Col/Row Gap 15 pt · Bleed 0 pt · Values in PDF points (1 pt ≈ 0.35 mm)
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ fontSize: '0.8rem', padding: '10px 14px', flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                      onClick={() => openCompileWizard('PRODUCTION')}
                      disabled={pdfLoading !== null}
                    >
                      <FileText size={14} /> Generate PDF Grid...
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: '0.8rem', padding: '8px 12px', flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                      onClick={() => handleCompilePdf('INDIVIDUAL')}
                      disabled={pdfLoading !== null}
                    >
                      Compile CR-80 Cards
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: '0.8rem', padding: '8px 12px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                      onClick={handleWhatsAppShare}
                    >
                      <Share2 size={12} /> Share Proofs Link
                    </button>
                  </div>
                </div>
              </div>
            )}
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
          {isOwner && (
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
                    <span style={{ fontWeight: '600' }}>{order?.invoice?.cardCount} cards</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--muted)' }}>Price Per Card:</span>
                    <span style={{ fontWeight: '600' }}>Rs. {Number(order?.invoice?.pricePerCard).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <span style={{ color: 'var(--muted)' }}>Subtotal:</span>
                    <span style={{ fontWeight: '600' }}>Rs. {Number(order?.invoice?.subtotal).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--muted)' }}>GST/Tax ({order?.invoice?.taxPercent}%):</span>
                    <span style={{ fontWeight: '600' }}>Rs. {Number(order?.invoice?.taxAmount).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.08)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <span style={{ fontWeight: '600' }}>Total Bill:</span>
                    <span style={{ fontWeight: '700', fontSize: '1.05rem', color: 'var(--info)' }}>Rs. {Number(order?.invoice?.totalAmount).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--muted)' }}>Status:</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {order?.invoice?.paymentStatus === 'PAID' ? (
                        <>
                          <span className="badge badge-success">Paid ({order?.invoice?.paymentMethod})</span>
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
                                toast(err.message || 'Error updating payment status', 'error');
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
                                toast(err.message || 'Error updating payment status', 'error');
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
          )}

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
      {isOwner && showInvoiceEdit && (
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

      {/* ── Pre-Print Missing Field Validation Modal ───────────────────── */}
      {showValidationModal && validationResult && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div style={{
            background: 'rgba(13,16,27,0.98)', border: '1px solid var(--glass-border)', borderTop: '2px solid #f59e0b',
            borderRadius: '16px', padding: '28px', maxWidth: '640px', width: '100%',
            maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: '16px',
            boxShadow: '0 24px 64px rgba(0,0,0,0.6)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertTriangle size={22} color="#f59e0b" />
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#f59e0b', fontWeight: '600' }}>Missing Data Detected</h3>
            </div>
            <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.9rem' }}>
              <strong style={{ color: '#fff' }}>{validationResult.missingFields.length} record(s)</strong>{' '}
              have incomplete required fields. Fix them or skip to proceed.
            </p>
            <div style={{ overflowY: 'auto', maxHeight: '280px', border: '1px solid var(--glass-border)', borderRadius: '8px', background: 'rgba(255,255,255,0.02)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }} className="custom-table">
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid var(--glass-border)', fontWeight: '600' }}>#</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid var(--glass-border)', fontWeight: '600' }}>Cardholder</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid var(--glass-border)', fontWeight: '600' }}>Missing Fields</th>
                  </tr>
                </thead>
                <tbody>
                  {validationResult.missingFields.map((row: any, i: number) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '8px 12px', color: 'var(--muted)' }}>{i + 1}</td>
                      <td style={{ padding: '8px 12px', fontWeight: '500' }}>{row.cardholderName}</td>
                      <td style={{ padding: '8px 12px' }}>
                        {row.missingFields.map((f: string, fi: number) => (
                          <span key={fi} style={{
                            display: 'inline-block', background: 'rgba(239,68,68,0.12)', color: '#f87171',
                            borderRadius: '4px', padding: '2px 7px', fontSize: '0.75rem', marginRight: '4px', marginBottom: '2px',
                            fontWeight: '500'
                          }}>{f}</span>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowValidationModal(false);
                  setPendingCompileType(null);
                  router.push(`/dashboard/clients/${order?.clientId}?tab=list`);
                }}
              >
                Fix Records
              </button>
              <button
                className="btn"
                style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}
                onClick={async () => {
                  setShowValidationModal(false);
                  if (validationResult.totalSlots > validationResult.totalCards) {
                    setShowEmptySlotModal(true);
                  } else {
                    if (pendingCompileType) {
                      await proceedWithCompile(pendingCompileType, true, emptySlotStrategy);
                    }
                  }
                }}
              >
                Skip & Print Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Empty Slot Strategy Modal ────────────────────────────────────── */}
      {showEmptySlotModal && validationResult && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div style={{
            background: 'rgba(13,16,27,0.98)', border: '1px solid var(--glass-border)', borderTop: '2px solid var(--primary)',
            borderRadius: '16px', padding: '28px', maxWidth: '480px', width: '100%',
            display: 'flex', flexDirection: 'column', gap: '16px',
            boxShadow: '0 24px 64px rgba(0,0,0,0.6)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertCircle size={22} color="var(--primary)" />
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '600' }}>Empty Sheet Slots</h3>
            </div>
            <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.9rem' }}>
              Your <strong style={{ color: '#fff' }}>{validationResult.totalCards}</strong> records
              will fill <strong style={{ color: '#fff' }}>{validationResult.totalCards}</strong> of{' '}
              <strong style={{ color: '#fff' }}>{validationResult.totalSlots}</strong> available sheet slots.
              How should the remaining <strong style={{ color: 'var(--primary)' }}>
                {validationResult.totalSlots - validationResult.totalCards}
              </strong> slots be filled?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {([
                { value: 'LEAVE_BLANK', label: 'Leave Blank', desc: 'Empty slots print as white space. Safe for cut-and-stack printing.' },
                { value: 'REPEAT_LAST', label: 'Repeat Last Card', desc: 'Fill remaining slots by repeating the last record.' },
                { value: 'REPEAT_FIRST', label: 'Repeat First Card', desc: 'Fill remaining slots with the first record (useful for calibration).' },
                { value: 'FILL_CUSTOM', label: 'Upload Custom PDF', desc: 'Fill empty slots with a custom PDF card stored locally (cleared after 3 days).' },
              ] as const).map(opt => (
                <label
                  key={opt.value}
                  style={{
                    display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '10px 14px',
                    border: `1px solid ${emptySlotStrategy === opt.value ? 'var(--primary)' : 'var(--glass-border)'}`,
                    borderRadius: '8px', cursor: 'pointer',
                    background: emptySlotStrategy === opt.value ? 'rgba(99,102,241,0.08)' : 'transparent',
                    transition: 'all 0.15s'
                  }}
                >
                  <input type="radio" name="emptySlot" value={opt.value}
                    checked={emptySlotStrategy === opt.value}
                    onChange={() => setEmptySlotStrategy(opt.value)}
                    style={{ marginTop: '4px' }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#fff' }}>{opt.label}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '2px' }}>{opt.desc}</div>
                  </div>
                </label>
              ))}

              {emptySlotStrategy === 'FILL_CUSTOM' && (
                <div style={{
                  marginTop: '10px', padding: '14px', borderRadius: '10px',
                  background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)',
                  display: 'flex', flexDirection: 'column', gap: '12px'
                }}>
                  {customCards.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 500 }}>Select Local Card</span>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <select
                          className="form-input"
                          value={selectedCustomCardId}
                          onChange={(e) => setSelectedCustomCardId(e.target.value)}
                          style={{ flex: 1, background: '#0a0d14', color: '#fff', border: '1px solid var(--glass-border)' }}
                        >
                          {customCards.map(card => (
                            <option key={card.id} value={card.id} style={{ background: '#0a0d14' }}>
                              {card.name} (Uploaded {new Date(card.createdAt).toLocaleDateString()})
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => handleCustomCardDelete(selectedCustomCardId)}
                          style={{
                            padding: '8px 12px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444',
                            border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '6px', cursor: 'pointer'
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.78rem', color: 'var(--muted)', textAlign: 'center', padding: '8px' }}>
                      No local PDF cards uploaded yet.
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 500 }}>
                      {isUploadingCustomCard ? 'Saving file...' : 'Upload New PDF Card'}
                    </span>
                    <input
                      type="file"
                      accept=".pdf"
                      disabled={isUploadingCustomCard}
                      onChange={handleCustomCardUpload}
                      style={{
                        fontSize: '0.78rem', color: '#fff', cursor: 'pointer',
                        padding: '6px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px dashed var(--glass-border)'
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button className="btn btn-secondary" onClick={() => { setShowEmptySlotModal(false); setPendingCompileType(null); }}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={async () => {
                setShowEmptySlotModal(false);
                if (pendingCompileType) {
                  await proceedWithCompile(pendingCompileType, true, emptySlotStrategy);
                }
              }}>
                Confirm & Queue Print
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Compile Wizard Modal ────────────────────────────────────────── */}
      {showCompileWizard && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div style={{
            background: 'rgba(13,16,27,0.98)', border: '1px solid var(--glass-border)', borderTop: '2px solid var(--primary)',
            borderRadius: '16px', padding: '28px', maxWidth: '520px', width: '100%',
            display: 'flex', flexDirection: 'column', gap: '20px',
            boxShadow: '0 24px 64px rgba(0,0,0,0.6)'
          }}>
            {/* Header */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600', color: '#fff' }}>
                  Generate PDF File
                </h3>
                <span style={{ fontSize: '0.75rem', padding: '4px 8px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', color: 'var(--muted)' }}>
                  Step {wizardStep} of 2
                </span>
              </div>
              <p style={{ margin: '4px 0 0 0', color: 'var(--muted)', fontSize: '0.82rem' }}>
                {wizardStep === 1 
                  ? 'Configure the paper size and layout orientation settings.' 
                  : 'Define how extra space on the output sheets should be handled.'}
              </p>
            </div>

            {/* Step 1 Content */}
            {wizardStep === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* File Type Selection */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 500 }}>File Type</span>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setWizardCompileType('APPROVAL')}
                      style={{
                        flex: 1, padding: '12px', borderRadius: '8px', border: `1px solid ${wizardCompileType === 'APPROVAL' ? 'var(--primary)' : 'var(--glass-border)'}`,
                        background: wizardCompileType === 'APPROVAL' ? 'rgba(99,102,241,0.08)' : 'transparent',
                        color: wizardCompileType === 'APPROVAL' ? '#fff' : 'var(--muted)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.15s'
                      }}
                    >
                      Approval File
                    </button>
                    <button
                      type="button"
                      onClick={() => setWizardCompileType('PRODUCTION')}
                      style={{
                        flex: 1, padding: '12px', borderRadius: '8px', border: `1px solid ${wizardCompileType === 'PRODUCTION' ? 'var(--primary)' : 'var(--glass-border)'}`,
                        background: wizardCompileType === 'PRODUCTION' ? 'rgba(99,102,241,0.08)' : 'transparent',
                        color: wizardCompileType === 'PRODUCTION' ? '#fff' : 'var(--muted)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.15s'
                      }}
                    >
                      Production File
                    </button>
                  </div>
                </div>

                {/* Paper Size Selection */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label className="form-label" style={{ margin: 0, fontSize: '0.78rem', color: 'var(--muted)' }}>Paper Size</label>
                  <select
                    className="form-input"
                    value={wizardPaperSize}
                    onChange={(e) => setWizardPaperSize(e.target.value)}
                    style={{ background: 'rgba(255,255,255,0.02)', color: '#fff', border: '1px solid var(--glass-border)' }}
                  >
                    <option value="A4" style={{ background: '#0a0d14' }}>A4 (210 x 297 mm)</option>
                    <option value="A3" style={{ background: '#0a0d14' }}>A3 (297 x 420 mm)</option>
                    <option value="SRA3" style={{ background: '#0a0d14' }}>SRA3 (320 x 450 mm)</option>
                    <option value="13x19" style={{ background: '#0a0d14' }}>13" x 19" (330.2 x 482.6 mm)</option>
                  </select>
                </div>

                {/* Orientation Selection */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 500 }}>Orientation</span>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setWizardOrientation('PORTRAIT')}
                      style={{
                        flex: 1, padding: '10px', borderRadius: '8px', border: `1px solid ${wizardOrientation === 'PORTRAIT' ? 'var(--primary)' : 'var(--glass-border)'}`,
                        background: wizardOrientation === 'PORTRAIT' ? 'rgba(99,102,241,0.08)' : 'transparent',
                        color: wizardOrientation === 'PORTRAIT' ? '#fff' : 'var(--muted)', fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.15s'
                      }}
                    >
                      Portrait
                    </button>
                    <button
                      type="button"
                      onClick={() => setWizardOrientation('LANDSCAPE')}
                      style={{
                        flex: 1, padding: '10px', borderRadius: '8px', border: `1px solid ${wizardOrientation === 'LANDSCAPE' ? 'var(--primary)' : 'var(--glass-border)'}`,
                        background: wizardOrientation === 'LANDSCAPE' ? 'rgba(99,102,241,0.08)' : 'transparent',
                        color: wizardOrientation === 'LANDSCAPE' ? '#fff' : 'var(--muted)', fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.15s'
                      }}
                    >
                      Landscape
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2 Content */}
            {wizardStep === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 500, marginBottom: '4px' }}>
                  What should we do with extra space / empty slots?
                </span>
                {([
                  { value: 'LEAVE_BLANK', label: 'Leave Blank', desc: 'Keep empty slots blank (recommended for cut-and-stack).' },
                  { value: 'REPEAT_LAST', label: 'Repeat Last Card', desc: 'Fill the rest of the sheet by repeating the last card.' },
                  { value: 'REPEAT_FIRST', label: 'Repeat First Card', desc: 'Fill the rest of the sheet by repeating the first card.' },
                  { value: 'FILL_CUSTOM', label: 'Upload Custom PDF', desc: 'Fill empty slots with a custom PDF card stored locally (cleared after 3 days).' },
                ] as const).map(opt => (
                  <label
                    key={opt.value}
                    style={{
                      display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '12px 14px',
                      border: `1px solid ${wizardStrategy === opt.value ? 'var(--primary)' : 'var(--glass-border)'}`,
                      borderRadius: '8px', cursor: 'pointer',
                      background: wizardStrategy === opt.value ? 'rgba(99,102,241,0.08)' : 'transparent',
                      transition: 'all 0.15s'
                    }}
                  >
                    <input type="radio" name="wizardStrategy" value={opt.value}
                      checked={wizardStrategy === opt.value}
                      onChange={() => setWizardStrategy(opt.value)}
                      style={{ marginTop: '4px' }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#fff' }}>{opt.label}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '2px' }}>{opt.desc}</div>
                    </div>
                  </label>
                ))}

                {wizardStrategy === 'FILL_CUSTOM' && (
                  <div style={{
                    marginTop: '10px', padding: '14px', borderRadius: '10px',
                    background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)',
                    display: 'flex', flexDirection: 'column', gap: '12px'
                  }}>
                    {customCards.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 500 }}>Select Local Card</span>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <select
                            className="form-input"
                            value={selectedCustomCardId}
                            onChange={(e) => setSelectedCustomCardId(e.target.value)}
                            style={{ flex: 1, background: '#0a0d14', color: '#fff', border: '1px solid var(--glass-border)' }}
                          >
                            {customCards.map(card => (
                              <option key={card.id} value={card.id} style={{ background: '#0a0d14' }}>
                                {card.name} (Uploaded {new Date(card.createdAt).toLocaleDateString()})
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => handleCustomCardDelete(selectedCustomCardId)}
                            style={{
                              padding: '8px 12px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444',
                              border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '6px', cursor: 'pointer'
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.78rem', color: 'var(--muted)', textAlign: 'center', padding: '8px' }}>
                        No local PDF cards uploaded yet.
                      </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 500 }}>
                        {isUploadingCustomCard ? 'Saving file...' : 'Upload New PDF Card'}
                      </span>
                      <input
                        type="file"
                        accept=".pdf"
                        disabled={isUploadingCustomCard}
                        onChange={handleCustomCardUpload}
                        style={{
                          fontSize: '0.78rem', color: '#fff', cursor: 'pointer',
                          padding: '6px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px dashed var(--glass-border)'
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Footer Buttons */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
              {wizardStep === 1 ? (
                <>
                  <button className="btn btn-secondary" onClick={() => setShowCompileWizard(false)}>
                    Cancel
                  </button>
                  <button 
                    className="btn btn-primary" 
                    onClick={() => {
                      if (!wizardCompileType) {
                        toast('Please select either Approval or Production file type.', 'error');
                        return;
                      }
                      setWizardStep(2);
                    }}
                  >
                    Next
                  </button>
                </>
              ) : (
                <>
                  <button className="btn btn-secondary" onClick={() => setWizardStep(1)}>
                    Back
                  </button>
                  <button className="btn btn-primary" onClick={handleWizardCompile}>
                    Compile PDF
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
