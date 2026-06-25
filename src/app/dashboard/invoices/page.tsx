'use client';

import React, { useEffect, useState } from 'react';
import { 
  CreditCard, 
  Search, 
  Filter, 
  Calendar, 
  Edit, 
  CheckCircle, 
  XCircle, 
  Download, 
  RefreshCw, 
  FileText, 
  AlertCircle,
  Eye,
  Check
} from 'lucide-react';

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'UNPAID'>('ALL');
  
  // Edit Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<any>(null);
  const [pricePerCard, setPricePerCard] = useState('50');
  const [cardCount, setCardCount] = useState('0');
  const [taxPercent, setTaxPercent] = useState('18');
  const [paymentStatus, setPaymentStatus] = useState('UNPAID');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // PDF Download / Job compilation state
  const [pdfCompilingId, setPdfCompilingId] = useState<number | null>(null);
  const [pdfJobProgress, setPdfJobProgress] = useState<Record<number, { status: string; progress: number; jobId?: number }>>({});

  const fetchData = async () => {
    try {
      const res = await fetch('/api/invoices');
      if (res.ok) {
        const json = await res.json();
        setInvoices(json.invoices || []);
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

  // Poll for compiling jobs
  useEffect(() => {
    const activeJobs = Object.keys(pdfJobProgress).filter(
      (id) => {
        const state = pdfJobProgress[Number(id)];
        return state.status === 'PENDING' || state.status === 'PROCESSING';
      }
    );

    if (activeJobs.length === 0) return;

    const interval = setInterval(async () => {
      // Poll active jobs
      for (const orderIdStr of activeJobs) {
        const orderId = Number(orderIdStr);
        const state = pdfJobProgress[orderId];
        if (!state.jobId) continue;

        try {
          const res = await fetch('/api/jobs');
          if (res.ok) {
            const data = await res.json();
            const job = data.jobs?.find((j: any) => j.id === state.jobId);
            if (job) {
              if (job.status === 'COMPLETED') {
                setPdfJobProgress(prev => ({
                  ...prev,
                  [orderId]: { status: 'COMPLETED', progress: 100, jobId: job.id, isLocalJob: job.isLocalJob }
                }));
                // Auto open the download link only if not local
                if (!job.isLocalJob) {
                  window.open(`/api/jobs/${job.id}/download`, '_blank');
                }
              } else if (job.status === 'FAILED') {
                setPdfJobProgress(prev => ({
                  ...prev,
                  [orderId]: { status: 'FAILED', progress: 0 }
                }));
                alert(`PDF compilation failed: ${job.errorMsg || 'Unknown error'}`);
              } else {
                setPdfJobProgress(prev => ({
                  ...prev,
                  [orderId]: { status: job.status, progress: job.progress || 0, jobId: job.id, isLocalJob: job.isLocalJob }
                }));
              }
            }
          }
        } catch (e) {
          console.error('Error polling job status:', e);
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [pdfJobProgress]);

  const handleCompilePdf = async (orderId: number) => {
    setPdfCompilingId(orderId);
    setPdfJobProgress(prev => ({
      ...prev,
      [orderId]: { status: 'PENDING', progress: 0 }
    }));

    try {
      const res = await fetch('/api/jobs/production-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          pdfType: 'INVOICE',
          paperSize: 'A4',
          orientation: 'PORTRAIT',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start invoice compilation');

      setPdfJobProgress(prev => ({
        ...prev,
        [orderId]: { status: 'PROCESSING', progress: 0, jobId: data.jobId }
      }));
    } catch (err: any) {
      alert(err.message || 'Error occurred starting PDF generation');
      setPdfJobProgress(prev => {
        const next = { ...prev };
        delete next[orderId];
        return next;
      });
    } finally {
      setPdfCompilingId(null);
    }
  };

  const handleOpenEdit = (inv: any) => {
    setEditingInvoice(inv);
    setPricePerCard(String(Number(inv.pricePerCard)));
    setCardCount(String(inv.cardCount));
    setTaxPercent(String(Number(inv.taxPercent)));
    setPaymentStatus(inv.paymentStatus);
    setPaymentMethod(inv.paymentMethod || 'CASH');
    setNotes(inv.notes || '');
    setError('');
    setShowEditModal(true);
  };

  const handleUpdateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/invoices', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingInvoice.id,
          pricePerCard: Number(pricePerCard),
          cardCount: Number(cardCount),
          taxPercent: Number(taxPercent),
          paymentStatus,
          paymentMethod: paymentStatus === 'PAID' ? paymentMethod : null,
          notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update invoice');

      setShowEditModal(false);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickStatusChange = async (inv: any, newStatus: 'PAID' | 'UNPAID') => {
    try {
      const res = await fetch('/api/invoices', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: inv.id,
          paymentStatus: newStatus,
          paymentMethod: newStatus === 'PAID' ? 'CASH' : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update payment status');
      }

      fetchData();
    } catch (err: any) {
      alert(err.message || 'Error occurred updating payment status');
    }
  };

  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = 
      inv.id.toString().includes(search) ||
      inv.orderId.toString().includes(search) ||
      (inv.order?.client?.name || '').toLowerCase().includes(search.toLowerCase());

    const matchesStatus = 
      statusFilter === 'ALL' || 
      inv.paymentStatus === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1>Invoices</h1>
          <p style={{ marginTop: '4px' }}>Track client billing invoices, update payment status, and compile invoice PDFs.</p>
        </div>
        <button className="btn btn-secondary" onClick={fetchData} style={{ gap: '8px' }}>
          <RefreshCw size={14} /> Refresh List
        </button>
      </div>

      {/* Filters toolbar */}
      <div className="glass-panel" style={{ padding: '16px', marginBottom: '24px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '240px' }}>
          <Search size={18} color="var(--muted)" />
          <input
            type="text"
            className="form-input"
            style={{ background: 'transparent', border: 'none', padding: '4px', flex: 1 }}
            placeholder="Search by Invoice No, Client name, or Order ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Filter size={16} color="var(--muted)" />
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '4px', border: '1px solid var(--glass-border)' }}>
            {(['ALL', 'PAID', 'UNPAID'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '0.8rem',
                  fontWeight: statusFilter === status ? '600' : '400',
                  background: statusFilter === status ? 'var(--primary-gradient)' : 'transparent',
                  color: statusFilter === status ? '#fff' : 'var(--muted)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {status.charAt(0) + status.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Invoices List */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '50px 0' }}>
          <div className="spinner"></div>
        </div>
      ) : filteredInvoices.length === 0 ? (
        <div className="glass-panel" style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--muted)' }}>
          <CreditCard size={40} style={{ marginBottom: '16px', color: 'var(--muted)' }} />
          <h3>No Invoices Found</h3>
          <p style={{ marginTop: '8px' }}>Create production grids from clients or orders to generate invoicing entries.</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Invoice No</th>
                <th>Client Name</th>
                <th>Order ID</th>
                <th>Cards Count</th>
                <th>Unit Price</th>
                <th>Subtotal</th>
                <th>Tax Amt</th>
                <th>Total Bill</th>
                <th>Payment Status</th>
                <th>Payment Method</th>
                <th>Date Generated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map((inv) => {
                const totalInvoiceAmount = `Rs. ${Number(inv.totalAmount).toFixed(2)}`;
                const subtotalAmount = `Rs. ${Number(inv.subtotal).toFixed(2)}`;
                const taxAmount = `Rs. ${Number(inv.taxAmount).toFixed(2)}`;
                const pricePerCard = `Rs. ${Number(inv.pricePerCard).toFixed(2)}`;
                
                const jobState = pdfJobProgress[inv.orderId];

                return (
                  <tr key={inv.id}>
                    <td style={{ fontWeight: '600', color: 'var(--info)' }}>#INV-{inv.id}</td>
                    <td style={{ fontWeight: '500' }}>{inv.order?.client?.name || <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                    <td>
                      <a href={`/dashboard/orders/${inv.orderId}`} style={{ color: 'var(--primary)', textDecoration: 'underline' }}>
                        #{inv.orderId}
                      </a>
                    </td>
                    <td>{inv.cardCount} cards</td>
                    <td>{pricePerCard}</td>
                    <td>{subtotalAmount}</td>
                    <td>{taxAmount} ({Number(inv.taxPercent)}%)</td>
                    <td style={{ fontWeight: '600', color: 'var(--info)' }}>{totalInvoiceAmount}</td>
                    <td>
                      {inv.paymentStatus === 'PAID' ? (
                        <span className="badge badge-success">Paid</span>
                      ) : (
                        <span className="badge badge-danger">Unpaid</span>
                      )}
                    </td>
                    <td>
                      {inv.paymentStatus === 'PAID' ? (
                        <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>{inv.paymentMethod}</span>
                      ) : (
                        <span style={{ color: 'var(--muted)' }}>—</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--muted)' }}>
                        <Calendar size={12} />
                        <span>{new Date(inv.createdAt).toLocaleDateString()}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '6px 10px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          onClick={() => handleOpenEdit(inv)}
                        >
                          <Edit size={12} /> Edit
                        </button>

                        {inv.paymentStatus === 'PAID' ? (
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '6px 10px', fontSize: '0.75rem', borderColor: 'rgba(239, 68, 68, 0.2)', color: 'var(--danger)' }}
                            onClick={() => handleQuickStatusChange(inv, 'UNPAID')}
                          >
                            Mark Unpaid
                          </button>
                        ) : (
                          <button
                            className="btn btn-primary"
                            style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                            onClick={() => handleQuickStatusChange(inv, 'PAID')}
                          >
                            Mark Paid
                          </button>
                        )}

                         {jobState ? (
                           jobState.status === 'PENDING' || jobState.status === 'PROCESSING' ? (
                             <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: 'var(--warning)', padding: '6px 10px' }}>
                               <span className="spinner" style={{ width: '10px', height: '10px', borderWidth: '1px' }}></span>
                               <span>{jobState.progress}%</span>
                             </div>
                           ) : (jobState as any).isLocalJob ? (
                             <span style={{ color: '#10b981', fontWeight: '500', fontSize: '0.75rem', padding: '6px 10px' }}>Saved to Documents</span>
                           ) : (
                             <a
                               href={`/api/jobs/${jobState.jobId}/download`}
                               target="_blank"
                               rel="noreferrer"
                               className="btn btn-primary"
                               style={{ padding: '6px 10px', fontSize: '0.75rem', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                             >
                               <Download size={12} /> Get PDF
                             </a>
                           )
                         ) : (
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '6px 10px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            disabled={pdfCompilingId !== null}
                            onClick={() => handleCompilePdf(inv.orderId)}
                          >
                            <Download size={12} /> Compile PDF
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Invoice Modal */}
      {showEditModal && (
        <div
          onClick={() => setShowEditModal(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9000,
            background: 'rgba(3,4,7,0.75)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'rgba(13,16,27,0.97)',
              border: '1px solid var(--glass-border)',
              borderTop: '2px solid var(--primary)',
              borderRadius: '16px',
              padding: '28px 32px',
              width: '100%', maxWidth: '500px',
              boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Edit size={18} color="var(--primary)" />
                Modify Invoice #INV-{editingInvoice?.id}
              </h3>
              <button onClick={() => setShowEditModal(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}>
                <XCircle size={18} />
              </button>
            </div>

            {error && (
              <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f77', borderRadius: '6px', marginBottom: '20px', fontSize: '0.85rem' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleUpdateInvoice} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Cards Quantity</label>
                  <input 
                    type="number" 
                    required 
                    className="form-input" 
                    value={cardCount} 
                    onChange={e => setCardCount(e.target.value)} 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Price per Card (Rs.)</label>
                  <input 
                    type="number" 
                    required 
                    step="0.01"
                    className="form-input" 
                    value={pricePerCard} 
                    onChange={e => setPricePerCard(e.target.value)} 
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">GST / Tax Percent (%)</label>
                  <input 
                    type="number" 
                    required 
                    step="0.1"
                    className="form-input" 
                    value={taxPercent} 
                    onChange={e => setTaxPercent(e.target.value)} 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Payment Status</label>
                  <select 
                    className="form-select" 
                    value={paymentStatus} 
                    onChange={e => setPaymentStatus(e.target.value)}
                  >
                    <option value="UNPAID">Unpaid</option>
                    <option value="PAID">Paid</option>
                  </select>
                </div>
              </div>

              {paymentStatus === 'PAID' && (
                <div className="form-group">
                  <label className="form-label">Payment Method</label>
                  <select 
                    className="form-select" 
                    value={paymentMethod} 
                    onChange={e => setPaymentMethod(e.target.value)}
                  >
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Billing Remarks / Notes</label>
                <textarea 
                  className="form-input" 
                  style={{ height: '70px', resize: 'vertical' }}
                  value={notes} 
                  onChange={e => setNotes(e.target.value)} 
                  placeholder="e.g. Received partial advance, Cheque clearing pending..."
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Update Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
