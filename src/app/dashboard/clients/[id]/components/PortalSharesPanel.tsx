'use client';

import React, { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/toast';
import ConfirmDialog from '@/app/components/ConfirmDialog';
import CompileWizardModal from '@/app/components/CompileWizardModal';
import { AlertTriangle, CheckCircle, Copy, Download, X } from 'lucide-react';
import { autoDownloadJobFile } from '@/lib/downloadHelper';
import { getEffectivePhotoUrl } from './utils';

export function PortalSharesPanel({ clientId }: { clientId: number }) {
  const { toast } = useToast();
  const [shares, setShares] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [creating, setCreating] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [hasClientAssignments, setHasClientAssignments] = useState(false);

  // Confirm dialog state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string; message: string; confirmLabel: string; variant: 'danger' | 'warning'; onConfirm: () => void;
  } | null>(null);
  const showConfirm = (cfg: typeof confirmConfig) => { setConfirmConfig(cfg); setConfirmOpen(true); };
  const closeConfirm = () => { setConfirmOpen(false); setConfirmConfig(null); };

  // Batch Management state
  const [selectedShareForBatch, setSelectedShareForBatch] = useState<any | null>(null);
  const [batchCardholders, setBatchCardholders] = useState<any[]>([]);
  const [selectedCardholderIds, setSelectedCardholderIds] = useState<number[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);

  // Batch Order form state
  const [batchPricePerCard, setBatchPricePerCard] = useState('50');
  const [batchValidTill, setBatchValidTill] = useState('');

  // Wizard modal state for batch compile
  const [showBatchWizard, setShowBatchWizard] = useState(false);

  // Compilation progress state
  const [batchPdfLoading, setBatchPdfLoading] = useState<string | null>(null);
  const [batchJob, setBatchJob] = useState<any | null>(null);
  const [previewJob, setPreviewJob] = useState<any | null>(null);

  const fetchShares = async () => {
    try {
      const res = await fetch(`/api/clients/${clientId}/shares?_t=${Date.now()}`);
      const data = await res.json();
      if (data.success) {
        setShares(data.shares);
        setHasClientAssignments(data.hasClientAssignments || false);
        const sorted = [...data.templates].sort((a, b) => {
          const aIsPdf = a.frontImageUrl?.toLowerCase().endsWith('.pdf') ? 1 : 0;
          const bIsPdf = b.frontImageUrl?.toLowerCase().endsWith('.pdf') ? 1 : 0;
          return bIsPdf - aIsPdf;
        });
        setTemplates(sorted);
        if (sorted.length > 0) {
          setSelectedTemplateId(String(sorted[0].id));
        }
      }
    } catch (e) {
      console.error('Error fetching portal shares:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShares();
  }, [clientId]);

  // Poll for active batch compile job
  useEffect(() => {
    if (!batchJob || batchJob.status === 'COMPLETED' || batchJob.status === 'FAILED') return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${batchJob.id}`);
        const data = await res.json();
        if (data.success && data.job) {
          if (data.job.status === 'COMPLETED' && data.job.downloadUrl && !batchJob.autoDownloaded) {
            if (!data.job.isLocalJob) {
              autoDownloadJobFile(data.job.downloadUrl, data.job.fileName);
            }
          }
          setBatchJob({
            ...data.job,
            autoDownloaded: data.job.status === 'COMPLETED' ? true : batchJob.autoDownloaded
          });
          if (data.job.status === 'COMPLETED') {
            fetchShares();
          }
        }
      } catch (e) {
        console.error('Error polling batch job:', e);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [batchJob]);

  // Keep selectedShareForBatch in sync with shares
  useEffect(() => {
    if (!selectedShareForBatch) return;
    const updated = shares.find(s => s.id === selectedShareForBatch.id);
    if (updated) {
      setSelectedShareForBatch(updated);
    }
  }, [shares]);

  const handleCreateShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplateId) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/shares`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: selectedTemplateId }),
      });
      const data = await res.json();
      if (data.success) {
        fetchShares();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCreating(false);
    }
  };

  const handleDeactivate = (orgToken: string) => {
    showConfirm({
      title: 'Deactivate Portal Link',
      message: 'This will deactivate the portal link. Cardholders enrolled through it will remain, but the link will stop working for new enrollments.',
      confirmLabel: 'Deactivate',
      variant: 'warning',
      onConfirm: async () => {
        closeConfirm();
        try {
          const res = await fetch(`/api/portal/shares/${orgToken}`, { method: 'DELETE' });
          const data = await res.json();
          if (data.success) fetchShares();
        } catch (e) { console.error(e); }
      },
    });
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedToken(id);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const handleOpenBatchManager = async (share: any) => {
    setSelectedShareForBatch(share);
    setBatchLoading(true);
    setBatchJob(null);
    try {
      const res = await fetch(`/api/portal/shares/${share.orgToken}/cardholders`);
      const data = await res.json();
      if (data.success) {
        setBatchCardholders(data.cardholders || []);
        setSelectedCardholderIds((data.cardholders || []).map((c: any) => c.id));
      }
    } catch (e) {
      console.error('Error fetching batch cardholders:', e);
    } finally {
      setBatchLoading(false);
    }
  };

  const toggleCardholderSelection = (id: number) => {
    setSelectedCardholderIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedCardholderIds.length === batchCardholders.length) {
      setSelectedCardholderIds([]);
    } else {
      setSelectedCardholderIds(batchCardholders.map(c => c.id));
    }
  };

  const handleBatchCompile = async (cfg: import('@/app/components/CompileWizardModal').CompileWizardConfig) => {
    if (selectedCardholderIds.length === 0) {
      toast('Please select at least one cardholder to compile.', 'warning');
      return;
    }
    const type = cfg.compileType;
    setBatchPdfLoading(type);
    setBatchJob(null);
    try {
      // 1. Create client order from selected batch cardholders
      const orderRes = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: Number(clientId),
          templateId: Number(selectedShareForBatch.templateId),
          cardholderIds: selectedCardholderIds,
          pricePerCard: Number(batchPricePerCard) || 0,
          validTill: batchValidTill ? new Date(batchValidTill) : null,
          status: type === 'PRODUCTION' ? 'APPROVED' : 'DRAFT',
        }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.error || 'Failed to create order for batch');

      const createdOrderId = orderData.order.id;

      // 2. Queue background compilation PDF Job using all wizard config
      const jobRes = await fetch('/api/jobs/production-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: createdOrderId,
          pdfType: type,
          paperSize: cfg.paperSize,
          orientation: cfg.orientation,
          bleed: cfg.bleed,
          cropMarks: cfg.cropMarks,
          foldLine: cfg.foldLine,
          marginLeft: cfg.marginLeft,
          marginTop: cfg.marginTop,
          marginRight: cfg.marginRight,
          marginBottom: cfg.marginBottom,
          colGap: cfg.colGap,
          rowGap: cfg.rowGap,
          emptySlotStrategy: cfg.emptySlotStrategy,
          customCardId: cfg.customCardId,
        }),
      });
      const jobData = await jobRes.json();
      if (!jobRes.ok) throw new Error(jobData.error || 'Failed to queue PDF job');

      setBatchJob({ id: jobData.jobId, status: 'PENDING', progress: 0, isLocalJob: true });
      window.dispatchEvent(new Event('refresh-profile'));
      setShowBatchWizard(false);

      if (type === 'PRODUCTION') {
        toast(`Production print job #${jobData.jobId} queued successfully!`, 'success');
      } else {
        toast(`Approval draft job #${jobData.jobId} queued successfully!`, 'success');
      }
    } catch (e: any) {
      toast(e.message || 'Error occurred during batch compilation', 'error');
    } finally {
      setBatchPdfLoading(null);
    }
  };

  if (loading) {
    return <div style={{ color: 'var(--muted)' }}>Loading portal shares...</div>;
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '32px' }}>
      
      {/* Creation form */}
      <div className="glass-panel" style={{ maxWidth: '640px' }}>
        <h3 style={{ marginBottom: '16px' }}>Generate Client Portal Share</h3>
        <p style={{ marginBottom: '24px', fontSize: '0.85rem', color: 'var(--muted)' }}>
          Create secure, shareable links mapping a specific ID card template to this organization. The client organization can log in to manage their members, and share the enrollment form with their members to collect profiles and photos.
        </p>

        {templates.length === 0 ? (
          <div style={{ padding: '16px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={16} color="#f59e0b" />
            <div style={{ fontSize: '0.875rem' }}>
              <strong style={{ color: '#f59e0b' }}>No templates available for this client.</strong>
              <span style={{ color: 'var(--muted)', marginLeft: '6px' }}>
                {hasClientAssignments
                  ? 'The assigned templates may have been removed. Please check template assignments in the Templates tab.'
                  : 'Design or upload a template, then assign it to this client from the Templates dashboard.'}
              </span>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {hasClientAssignments && (
              <div style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <CheckCircle size={12} color="var(--success)" />
                Showing {templates.length} template{templates.length !== 1 ? 's' : ''} assigned to this client
              </div>
            )}
            <form onSubmit={handleCreateShare} style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ flex: 1, margin: 0 }}>
                <label className="form-label">Select Template</label>
                <select 
                  className="form-select" 
                  value={selectedTemplateId} 
                  onChange={e => setSelectedTemplateId(e.target.value)}
                >
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <button id="btn-generate-links" type="submit" className="btn btn-primary" disabled={creating} style={{ height: '42px' }}>
                {creating ? 'Generating...' : 'Generate Links'}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Active Shares List */}
      <div>
        <h3 style={{ marginBottom: '16px' }}>Active Share Links</h3>
        {shares.length === 0 ? (
          <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)' }}>
            No portal links generated yet. Use the form above to generate links.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {shares.map(share => {
              const matchedTemplate = templates.find(t => t.id === share.templateId);
              const enrollUrl = `${window.location.origin}/portal/enroll/${share.enrollToken}`;
              const orgUrl = `${window.location.origin}/portal/org/${share.orgToken}`;
              const isSelected = selectedShareForBatch?.id === share.id;

              return (
                <div key={share.id} className="glass-panel" style={{ 
                   padding: '20px', 
                   border: share.active ? (isSelected ? '2px solid var(--primary)' : '1px solid var(--glass-border)') : '1px solid rgba(239, 68, 68, 0.2)',
                   opacity: share.active ? 1 : 0.6,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div>
                      <strong style={{ fontSize: '1rem', color: '#fff' }}>
                        Template: {matchedTemplate?.name || `ID #${share.templateId}`}
                      </strong>
                      <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '4px' }}>
                        Created on {new Date(share.createdAt).toLocaleDateString()} · <strong>Enrolled: {share.enrolledCount ?? 0} members</strong>
                      </div>

                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      {share.active && (
                        <button
                          type="button"
                          className={`btn ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                          onClick={() => isSelected ? setSelectedShareForBatch(null) : handleOpenBatchManager(share)}
                        >
                          {isSelected ? 'Close Batch Manager' : 'Manage Batch & Compile'}
                        </button>
                      )}
                      {share.active ? (
                        <button 
                          type="button"
                          className="btn btn-danger" 
                          style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                          onClick={() => handleDeactivate(share.orgToken)}
                        >
                          Deactivate Links
                        </button>
                      ) : (
                        <span className="badge badge-warning">Deactivated</span>
                      )}
                    </div>
                  </div>

                  {share.active && !isSelected && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      
                      <div style={{ background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.15)', padding: '12px 16px', borderRadius: '6px', fontSize: '0.8rem', color: 'var(--muted)' }}>
                        <strong>Multi-department Workflow:</strong> Copy the Organization Head portal link below and send it to the client's organization head. From that portal, they can create separate department heads and staff data collection links for their respective departments.
                      </div>

                      {/* Organization Management Link */}
                      <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#10b981' }}>
                            Organization Head Portal Link (For Client Managers)
                          </span>
                          <button 
                            type="button"
                            className="btn btn-secondary" 
                            style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                            onClick={() => copyToClipboard(orgUrl, `org-${share.id}`)}
                          >
                            {copiedToken === `org-${share.id}` ? <CheckCircle size={12} style={{ color: 'var(--success)' }} /> : <Copy size={12} />}
                            Copy
                          </button>
                        </div>
                        <code style={{ fontSize: '0.8rem', color: 'var(--muted)', wordBreak: 'break-all' }}>{orgUrl}</code>
                      </div>

                    </div>
                  )}

                  {/* Batch Manager Section */}
                  {isSelected && (
                    <div style={{ 
                      marginTop: '20px', 
                      paddingTop: '20px', 
                      borderTop: '1px dashed var(--glass-border)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '20px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--primary)' }}>Batch Cardholders Manager</h4>
                        <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                          Selected: {selectedCardholderIds.length} of {batchCardholders.length}
                        </span>
                      </div>

                      {batchLoading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
                          <div className="spinner"></div>
                        </div>
                      ) : batchCardholders.length === 0 ? (
                        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--muted)', fontSize: '0.85rem' }}>
                          No cardholders have enrolled through this link yet.
                        </div>
                      ) : (
                        <>
                          {/* Cardholders Checklist */}
                          <div style={{ 
                            maxHeight: '220px', 
                            overflowY: 'auto', 
                            border: '1px solid var(--glass-border)',
                            borderRadius: '6px',
                            background: 'rgba(0,0,0,0.1)'
                          }}>
                            <table className="custom-table" style={{ margin: 0 }}>
                              <thead>
                                <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                                  <th style={{ width: '40px', padding: '10px' }}>
                                    <input 
                                      type="checkbox" 
                                      checked={selectedCardholderIds.length === batchCardholders.length} 
                                      onChange={handleSelectAll} 
                                    />
                                  </th>
                                  <th style={{ padding: '10px' }}>Photo</th>
                                  <th style={{ padding: '10px' }}>Name</th>
                                  <th style={{ padding: '10px' }}>Template Name</th>
                                  <th style={{ padding: '10px' }}>Designation</th>
                                  <th style={{ padding: '10px' }}>Serial / Key</th>
                                </tr>
                              </thead>
                              <tbody>
                                {batchCardholders.map(ch => {
                                  const isChSelected = selectedCardholderIds.includes(ch.id);
                                  const effectivePhoto = getEffectivePhotoUrl(ch);

                                  return (
                                    <tr key={ch.id} style={{ opacity: isChSelected ? 1 : 0.5 }}>
                                      <td style={{ padding: '10px' }}>
                                        <input 
                                          type="checkbox" 
                                          checked={isChSelected} 
                                          onChange={() => toggleCardholderSelection(ch.id)} 
                                        />
                                      </td>
                                      <td style={{ padding: '6px 10px' }}>
                                        {effectivePhoto ? (
                                          <img src={effectivePhoto} alt="" style={{ width: '32px', height: '32px', borderRadius: '6px', objectFit: 'cover', border: '1px solid var(--glass-border)' }} />
                                        ) : (
                                          <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: '0.65rem' }}>None</div>
                                        )}
                                      </td>
                                      <td style={{ padding: '10px', fontWeight: '500' }}>{ch.name}</td>
                                      <td style={{ padding: '10px' }}>{ch.templateName || '—'}</td>
                                      <td style={{ padding: '10px' }}>{ch.designation || '—'}</td>
                                      <td style={{ padding: '10px', fontSize: '0.8rem', color: 'var(--muted)' }}>{ch.cardSerial || '—'}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                          {/* Compile button — opens the same wizard used elsewhere */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: '160px' }}>
                              <label style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Price Per Card (Rs)</label>
                              <input
                                type="number"
                                className="form-input"
                                style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                                value={batchPricePerCard}
                                onChange={e => setBatchPricePerCard(e.target.value)}
                              />
                            </div>
                            <button
                              type="button"
                              className="btn btn-primary"
                              style={{
                                padding: '10px 22px',
                                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                boxShadow: '0 4px 14px rgba(99,102,241,0.3)',
                                display: 'flex', alignItems: 'center', gap: '8px',
                                fontSize: '0.9rem', fontWeight: 600,
                                marginTop: '18px',
                              }}
                              disabled={selectedCardholderIds.length === 0 || batchPdfLoading !== null}
                              onClick={() => setShowBatchWizard(true)}
                            >
                              {batchPdfLoading ? (
                                <><div className="spinner" style={{ width: '15px', height: '15px' }} /> Queueing...</>
                              ) : (
                                <>⚡ Compile PDF ({selectedCardholderIds.length} card{selectedCardholderIds.length !== 1 ? 's' : ''})</>
                              )}
                            </button>
                          </div>

                          {/* Compile Wizard Modal */}
                          {showBatchWizard && (
                            <CompileWizardModal
                              cardCount={selectedCardholderIds.length}
                              onClose={() => setShowBatchWizard(false)}
                              compiling={batchPdfLoading !== null}
                              onCompile={handleBatchCompile}
                            />
                          )}

                          {/* Live compilation progress status */}
                          {batchJob && (
                            <div style={{ 
                              background: 'rgba(255,255,255,0.02)', 
                              border: '1px solid var(--glass-border)', 
                              borderRadius: '8px', 
                              padding: '12px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '8px'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                                <strong>Job #{batchJob.id} Status:</strong>
                                <span>{batchJob.status}</span>
                              </div>
                              <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{ width: `${batchJob.progress ?? 0}%`, height: '100%', background: 'var(--primary-gradient)', transition: 'width 0.3s ease' }}></div>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--muted)' }}>
                                <span>Progress: {batchJob.progress}%</span>
                                {batchJob.status === 'COMPLETED' && (
                                  <span style={{ color: '#10b981', fontWeight: 'bold' }}>✓ PDF Downloaded & Saved to File</span>
                                )}
                                {batchJob.status === 'FAILED' && batchJob.errorMsg && (
                                  <span style={{ color: 'var(--danger)' }}>Error: {batchJob.errorMsg}</span>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Previously compiled files */}
                          {!batchJob && (selectedShareForBatch?.latestApprovalJob || selectedShareForBatch?.latestProductionJob) && (
                            <div style={{ 
                              background: 'rgba(255,255,255,0.02)', 
                              border: '1px solid var(--glass-border)', 
                              borderRadius: '8px', 
                              padding: '12px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '10px'
                            }}>
                              <strong style={{ fontSize: '0.8rem', color: '#fff' }}>Previously Compiled PDFs for this share link:</strong>
                              <div style={{ display: 'flex', gap: '16px' }}>
                                {selectedShareForBatch.latestApprovalJob && (
                                  selectedShareForBatch.latestApprovalJob.isLocalJob ? (
                                    <span style={{ color: 'var(--primary)', fontSize: '0.8rem', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                      📄 Approval Proof (Saved)
                                    </span>
                                  ) : (
                                    <button 
                                      type="button"
                                      onClick={() => setPreviewJob({ id: selectedShareForBatch.latestApprovalJob.id, pdfType: 'APPROVAL', fileName: `Approval_Proof_Share_${selectedShareForBatch.id}.pdf` })}
                                      style={{ background: 'none', border: 'none', padding: 0, color: 'var(--primary)', fontSize: '0.8rem', fontWeight: 'bold', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                                    >
                                      📄 View Approval Proof
                                    </button>
                                  )
                                )}
                                {selectedShareForBatch.latestProductionJob && (
                                  selectedShareForBatch.latestProductionJob.isLocalJob ? (
                                    <span style={{ color: '#10b981', fontSize: '0.8rem', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                      📄 Production PDF (Saved)
                                    </span>
                                  ) : (
                                    <button 
                                      type="button"
                                      onClick={() => setPreviewJob({ id: selectedShareForBatch.latestProductionJob.id, pdfType: 'PRODUCTION', fileName: `Production_Grid_Share_${selectedShareForBatch.id}.pdf` })}
                                      style={{ background: 'none', border: 'none', padding: 0, color: '#10b981', fontSize: '0.8rem', fontWeight: 'bold', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                                    >
                                      📄 View Production PDF
                                    </button>
                                  )
                                )}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
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
                  Type: {previewJob.pdfType} • Job #{previewJob.id}
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

      {/* Global Confirm Dialog */}
      {confirmConfig && (
        <ConfirmDialog
          open={confirmOpen}
          title={confirmConfig.title}
          message={confirmConfig.message}
          confirmLabel={confirmConfig.confirmLabel}
          variant={confirmConfig.variant}
          onConfirm={confirmConfig.onConfirm}
          onCancel={closeConfirm}
        />
      )}
    </div>
  );
}
