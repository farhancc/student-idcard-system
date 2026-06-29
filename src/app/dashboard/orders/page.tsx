'use client';

import React, { useEffect, useState } from 'react';
import { Plus, FileText, Calendar, DollarSign, FolderOpen, RefreshCcw } from 'lucide-react';

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form toggling
  const [showForm, setShowForm] = useState(false);
  const [orderMethod, setOrderMethod] = useState<'standard' | 'batch'>('standard');
  const [clientId, setClientId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [pricePerCard, setPricePerCard] = useState('50'); // default Rs. 50
  const [taxPercent, setTaxPercent] = useState('18'); // default 18% GST
  const [validTill, setValidTill] = useState('');
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fetchData = async () => {
    try {
      const ordersRes = await fetch('/api/orders');
      if (ordersRes.ok) {
        const json = await ordersRes.json();
        setOrders(json.orders || []);
      }

      const clientsRes = await fetch('/api/clients');
      if (clientsRes.ok) {
        const json = await clientsRes.json();
        setClients(json.clients || []);
        if (json.clients?.length > 0) setClientId(String(json.clients[0].id));
      }

      const templatesRes = await fetch('/api/templates');
      if (templatesRes.ok) {
        const json = await templatesRes.json();
        const allTemplates = [
          ...(json.templates || []),
          ...(json.globalTemplates || []).map((t: any) => ({ ...t, name: `⭐ ${t.name} (Starter)` }))
        ];
        setTemplates(allTemplates);
        if (allTemplates.length > 0) setTemplateId(String(allTemplates[0].id));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      if (!clientId || !templateId) throw new Error('Client and Template must be selected');

      // Fetch cardholders for the client first
      const chRes = await fetch(`/api/clients/${clientId}/cardholders`);
      if (!chRes.ok) throw new Error('Failed to fetch cardholders for the selected client');
      const chData = await chRes.json();
      const cardholderIds = (chData.cardholders || []).map((ch: any) => ch.id);

      if (cardholderIds.length === 0) {
        throw new Error('Selected client registry has no cardholders. Please register cardholders for this client first.');
      }

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: Number(clientId),
          templateId: Number(templateId),
          cardholderIds,
          pricePerCard: Number(pricePerCard) || 0,
          taxPercent: Number(taxPercent) || 0,
          validTill: validTill ? new Date(validTill) : null,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create order');

      setShowForm(false);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBatchCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      if (!clientId || !templateId) throw new Error('Client and Template must be selected');
      if (!excelFile) throw new Error('Excel student list file is required');
      if (!zipFile) throw new Error('ZIP photos file is required');

      const formData = new FormData();
      formData.append('clientId', clientId);
      formData.append('templateId', templateId);
      formData.append('pricePerCard', pricePerCard);
      formData.append('taxPercent', taxPercent);
      if (validTill) {
        formData.append('validTill', validTill);
      }
      formData.append('excel', excelFile);
      formData.append('zip', zipFile);

      const res = await fetch('/api/orders/batch-process', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to process batch order');

      setShowForm(false);
      setExcelFile(null);
      setZipFile(null);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Error occurred during batch processing');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT': return <span className="badge badge-primary">Draft</span>;
      case 'APPROVAL_PDF_SENT': return <span className="badge badge-warning">Approval Sent</span>;
      case 'APPROVED': return <span className="badge badge-success">Approved</span>;
      case 'PRINTING': return <span className="badge badge-warning">Printing</span>;
      case 'DELIVERED': return <span className="badge badge-success">Delivered</span>;
      default: return <span className="badge badge-primary">{status}</span>;
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1>Card Orders</h1>
          <p style={{ marginTop: '4px' }}>Draft client orders, manage status flow, and view billing invoices.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          <Plus size={18} /> {showForm ? 'Hide Form' : 'Initialize Order'}
        </button>
      </div>

      {showForm && (
        <div className="glass-panel" style={{ marginBottom: '32px', maxWidth: '640px' }}>
          <h3 style={{ marginBottom: '16px' }}>Initialize Printing Order</h3>
          
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
            <button 
              type="button" 
              className={`btn ${orderMethod === 'standard' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              onClick={() => setOrderMethod('standard')}
            >
              Standard (Existing Registry)
            </button>
            <button 
              type="button" 
              className={`btn ${orderMethod === 'batch' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              onClick={() => setOrderMethod('batch')}
            >
              Batch Upload (Excel + ZIP)
            </button>
          </div>

          {error && (
            <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f77', borderRadius: '6px', marginBottom: '20px', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          <form onSubmit={orderMethod === 'standard' ? handleCreate : handleBatchCreate} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div className="form-group">
              <label className="form-label">Client Registry Folder</label>
              <select className="form-select" value={clientId} onChange={e => setClientId(e.target.value)}>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Card Template</label>
              <select className="form-select" value={templateId} onChange={e => setTemplateId(e.target.value)}>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name} (v{t.version})</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Price Per Card (Rs)</label>
              <input type="number" required className="form-input" value={pricePerCard} onChange={e => setPricePerCard(e.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label">GST / Tax Percent (%)</label>
              <input type="number" required className="form-input" value={taxPercent} onChange={e => setTaxPercent(e.target.value)} />
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Card Expiry Validity Date</label>
              <input 
                type="date" 
                required 
                className="form-input" 
                value={validTill} 
                onChange={e => setValidTill(e.target.value)} 
                onClick={(e) => {
                  try {
                    e.currentTarget.showPicker();
                  } catch (err) {
                    console.warn('showPicker is not supported:', err);
                  }
                }}
              />
            </div>

            {orderMethod === 'batch' && (
              <>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Excel Data Sheet (.xlsx, .csv)</label>
                  <input type="file" required accept=".xlsx,.xls,.csv" className="form-input" onChange={e => setExcelFile(e.target.files?.[0] || null)} />
                  <span style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '4px', display: 'block' }}>
                    First row must contain headers. Unique student ID column will be auto-detected.
                  </span>
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Student Photos ZIP Archive (.zip)</label>
                  <input type="file" required accept=".zip" className="form-input" onChange={e => setZipFile(e.target.files?.[0] || null)} />
                  <span style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '4px', display: 'block' }}>
                    Each photo filename should match the student's unique ID in the excel sheet.
                  </span>
                </div>
              </>
            )}

            <div style={{ gridColumn: 'span 2', display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => {
                setShowForm(false);
                setExcelFile(null);
                setZipFile(null);
              }}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Processing...' : (orderMethod === 'batch' ? 'Upload & Process' : 'Initialize Order')}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '50px 0' }}>
          <div className="spinner"></div>
        </div>
      ) : orders.length === 0 ? (
        <div className="glass-panel" style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--muted)' }}>
          <FileText size={40} style={{ marginBottom: '16px' }} />
          <h3>No Orders Found</h3>
          <p style={{ marginTop: '8px' }}>Create your first order to assemble layout sheets, assign serials, and print.</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Client Registry</th>
                <th>Status</th>
                <th>Template</th>
                <th>Validity till</th>
                <th>Total Cardholders</th>
                <th>Payment</th>
                <th>Invoice total</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((ord: any) => {
                const cardholderCount = ord._count?.cardholders ?? (ord.cardholders?.length ?? 0);
                const totalInvoiceAmount = ord.invoice ? `Rs. ${Number(ord.invoice.totalAmount).toFixed(2)}` : '—';
                const paymentStatus = ord.invoice ? (
                  ord.invoice.paymentStatus === 'PAID' ? (
                    <span className="badge badge-success">Paid</span>
                  ) : (
                    <span className="badge badge-danger">Unpaid</span>
                  )
                ) : '—';

                return (
                  <tr key={ord.id}>
                    <td>#{ord.id}</td>
                    <td style={{ fontWeight: '500' }}>{ord.client?.name}</td>
                    <td>{getStatusBadge(ord.status)}</td>
                    <td>{ord.template?.name} (v{ord.templateVersion})</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--muted)' }}>
                        <Calendar size={12} />
                        <span>{ord.validTill ? new Date(ord.validTill).toLocaleDateString() : '—'}</span>
                      </div>
                    </td>
                    <td>{cardholderCount} cards</td>
                    <td>{paymentStatus}</td>
                    <td>{totalInvoiceAmount}</td>
                    <td>
                      <a href={`/dashboard/orders/${ord.id}`} className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.75rem' }}>
                        <FolderOpen size={12} /> Open Pipeline
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
