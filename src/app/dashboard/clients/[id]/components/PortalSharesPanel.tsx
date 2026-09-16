'use client';

import React, { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/toast';
import ConfirmDialog from '@/app/components/ConfirmDialog';
import CompileWizardModal from '@/app/components/CompileWizardModal';
import PdfCompileLoadingAnimation from '@/app/components/PdfCompileLoadingAnimation';
import { AlertTriangle, CheckCircle, CheckCircle2, Copy, Download, FileText, Link as LinkIcon, Users, X } from 'lucide-react';
import { getEffectivePhotoUrl } from './utils';
import { useCompileWorkflow } from '../hooks/useCompileWorkflow';
import { ValidationModal } from './ValidationModal';
import { EmptySlotModal } from './EmptySlotModal';

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
  const [previewJob, setPreviewJob] = useState<any | null>(null);

  // Same compile pipeline the Cardholders tab uses — pre-compile field
  // validation, empty-slot handling, credit lock/capture-or-refund via
  // production-request/production-complete, and the same full-screen
  // progress animation. Scoped to this share's cardholders/selection.
  const compileHooks = useCompileWorkflow({
    clientId,
    cardholders: batchCardholders,
    selectedIds: selectedCardholderIds,
    quickTemplates: templates,
    setSelectedIds: setSelectedCardholderIds,
  });

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

  // Refresh the share list once a compile finishes so "Previously Compiled
  // PDFs" picks up the new job.
  useEffect(() => {
    if (compileHooks.qJobResult?.status === 'COMPLETED') fetchShares();
  }, [compileHooks.qJobResult?.status]);

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
    compileHooks.setQJobResult(null);
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

  // Opens the shared compile wizard pre-set to this share's fixed template —
  // Portal Links never has a "mixed template" case the way the Cardholders
  // tab's auto-detect does, since every cardholder here enrolled through one
  // share that already maps to exactly one template.
  const handleOpenBatchCompile = (matchedTemplate: any) => {
    if (selectedCardholderIds.length === 0) {
      toast('Please select at least one cardholder to compile.', 'warning');
      return;
    }
    compileHooks.setQTemplateId(String(selectedShareForBatch.templateId));
    compileHooks.setQDetectedTemplateName(matchedTemplate?.name || null);
    compileHooks.setQTemplateMixed(false);
    compileHooks.setQJobResult(null);
    compileHooks.setWizardStep(1);
    compileHooks.setWizardCompileType(null);
    compileHooks.setWizardPaperSize('A3');
    compileHooks.setWizardOrientation('PORTRAIT');
    compileHooks.setWizardEmptySlotStrategy('LEAVE_BLANK');
    compileHooks.setShowCompileModal(true);
  };

  if (loading) {
    return <div style={{ color: 'var(--muted)' }}>Loading portal shares...</div>;
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '32px' }}>
      
      {/* Creation form */}
      <div className="glass-panel" style={{ maxWidth: '640px' }}>
        <h3 style={{ marginBottom: '6px' }}>Create a Portal Link</h3>
        <p style={{ marginBottom: '20px', fontSize: '0.85rem', color: 'var(--muted)' }}>
          Lets this client manage their own members and collect enrollment photos, tied to one template.
        </p>

        {templates.length === 0 ? (
          <div style={{ padding: '16px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={16} color="#f59e0b" />
            <div style={{ fontSize: '0.875rem' }}>
              <strong style={{ color: '#f59e0b' }}>No templates available.</strong>
              <span style={{ color: 'var(--muted)', marginLeft: '6px' }}>
                {hasClientAssignments
                  ? 'The assigned templates may have been removed — check the Templates tab.'
                  : 'Assign a template to this client from the Templates tab first.'}
              </span>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreateShare} style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 1, margin: 0 }}>
              <label className="form-label">Template</label>
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
              {creating ? 'Creating...' : 'Create Link'}
            </button>
          </form>
        )}
      </div>

      {/* Active Shares List */}
      <div>
        {shares.length > 0 && (
          <h3 style={{ marginBottom: '16px' }}>Portal Links <span style={{ color: 'var(--muted)', fontWeight: 400 }}>({shares.length})</span></h3>
        )}
        {shares.length === 0 ? (
          <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)' }}>
            No portal links yet — create one above to get started.
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <strong style={{ fontSize: '1rem', color: '#fff' }}>
                        {matchedTemplate?.name || `Template #${share.templateId}`}
                      </strong>
                      <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Users size={13} /> {share.enrolledCount ?? 0} enrolled
                        <span style={{ opacity: 0.5 }}>·</span>
                        {new Date(share.createdAt).toLocaleDateString()}
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
                          {isSelected ? 'Close' : 'Manage & Print'}
                        </button>
                      )}
                      {share.active ? (
                        <button
                          type="button"
                          className="btn btn-danger"
                          style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                          onClick={() => handleDeactivate(share.orgToken)}
                        >
                          Deactivate
                        </button>
                      ) : (
                        <span className="badge badge-warning">Deactivated</span>
                      )}
                    </div>
                  </div>

                  {share.active && (
                    <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '6px', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <LinkIcon size={14} color="var(--muted)" style={{ flexShrink: 0 }} />
                      <code style={{ fontSize: '0.78rem', color: 'var(--muted)', wordBreak: 'break-all', flex: 1 }}>{orgUrl}</code>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '4px 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}
                        onClick={() => copyToClipboard(orgUrl, `org-${share.id}`)}
                      >
                        {copiedToken === `org-${share.id}` ? <CheckCircle size={12} style={{ color: 'var(--success)' }} /> : <Copy size={12} />}
                        Copy
                      </button>
                    </div>
                  )}
                  {share.active && !isSelected && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--muted)', margin: '8px 0 0' }}>
                      Send this to the client&rsquo;s admin — they&rsquo;ll manage members and can invite their own departments.
                    </p>
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
                        <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--primary)' }}>Enrolled Members</h4>
                        <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                          {selectedCardholderIds.length} of {batchCardholders.length} selected
                        </span>
                      </div>

                      {batchLoading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
                          <div className="spinner"></div>
                        </div>
                      ) : batchCardholders.length === 0 ? (
                        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--muted)', fontSize: '0.85rem' }}>
                          No one has enrolled through this link yet.
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
                                value={compileHooks.qPricePerCard}
                                onChange={e => compileHooks.setQPricePerCard(e.target.value)}
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
                              disabled={selectedCardholderIds.length === 0 || !!compileHooks.qCompiling}
                              onClick={() => handleOpenBatchCompile(matchedTemplate)}
                            >
                              {compileHooks.qCompiling ? (
                                <><div className="spinner" style={{ width: '15px', height: '15px' }} /> Starting...</>
                              ) : (
                                <>Compile PDF ({selectedCardholderIds.length} card{selectedCardholderIds.length !== 1 ? 's' : ''})</>
                              )}
                            </button>
                          </div>

                          {/* Compile Wizard Modal — same validation, empty-slot
                              handling and credit lock/settle as the Cardholders tab */}
                          {compileHooks.showCompileModal && (
                            <CompileWizardModal
                              cardCount={selectedCardholderIds.length}
                              onClose={() => compileHooks.setShowCompileModal(false)}
                              compiling={!!compileHooks.qCompiling}
                              onCompile={async (cfg) => {
                                await compileHooks.handleQuickCompile(cfg.compileType as any, cfg as any);
                                compileHooks.setShowCompileModal(false);
                              }}
                            />
                          )}

                          {/* Live compilation progress — full-screen while the
                              job is running, same as the Cardholders tab */}
                          {compileHooks.qJobResult
                            && compileHooks.qJobResult.status !== 'COMPLETED'
                            && compileHooks.qJobResult.status !== 'FAILED' && (
                            <div
                              role="dialog"
                              aria-modal="true"
                              aria-label="Compiling PDF"
                              style={{
                                position: 'fixed', inset: 0, zIndex: 1000,
                                background: 'rgba(3,6,15,0.78)', backdropFilter: 'blur(3px)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
                              }}
                            >
                              <div style={{ width: '100%', maxWidth: '520px', background: 'rgba(13,16,27,0.98)', border: '1px solid var(--glass-border)', borderTop: '2px solid var(--primary)', borderRadius: '16px', padding: '26px', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
                                <PdfCompileLoadingAnimation
                                  progress={compileHooks.qJobResult.progress ?? 0}
                                  message={
                                    compileHooks.qJobResult.status === 'PENDING'
                                      ? 'Queued — starting shortly…'
                                      : 'Compiling Print-Ready PDF…'
                                  }
                                  subMessage={
                                    (compileHooks.qJobResult.chunkCount ?? 0) > 1
                                      ? `Part ${Math.min((compileHooks.qJobResult.chunks?.length ?? 0) + 1, compileHooks.qJobResult.chunkCount!)} of ${compileHooks.qJobResult.chunkCount}`
                                      : `${compileHooks.qJobResult.pdfType === 'PRODUCTION' ? 'Production' : 'Proof'} PDF`
                                  }
                                />
                                {compileHooks.qJobResult.pollError && (
                                  <div style={{ marginTop: '14px', padding: '10px 12px', borderRadius: '8px', fontSize: '0.78rem', color: '#fca5a5', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
                                    {compileHooks.qJobResult.pollError} The PDF may still be compiling — progress will resume if the
                                    connection recovers.
                                  </div>
                                )}
                                <div style={{ marginTop: '18px', textAlign: 'center' }}>
                                  <button
                                    type="button"
                                    onClick={() => compileHooks.setQJobResult(null)}
                                    style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '0.76rem', cursor: 'pointer', textDecoration: 'underline' }}
                                  >
                                    Keep compiling in the background
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}

                          {compileHooks.qJobResult
                            && (compileHooks.qJobResult.status === 'COMPLETED' || compileHooks.qJobResult.status === 'FAILED') && (
                            <div style={{
                              background: 'rgba(255,255,255,0.02)',
                              border: '1px solid var(--glass-border)',
                              borderRadius: '8px',
                              padding: '12px',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}>
                              <div>
                                <strong style={{ fontSize: '0.85rem' }}>{compileHooks.qJobResult.status === 'COMPLETED' ? 'Done' : 'Failed'}</strong>
                              </div>
                              {compileHooks.qJobResult.status === 'COMPLETED' && (
                                <div style={{ color: '#10b981', fontWeight: 600, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <CheckCircle2 size={14} /> Saved to your computer
                                </div>
                              )}
                              {compileHooks.qJobResult.status === 'FAILED' && (
                                <div style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>{compileHooks.qJobResult.errorMsg}</div>
                              )}
                              <button
                                type="button"
                                onClick={() => compileHooks.setQJobResult(null)}
                                style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '4px' }}
                                title="Dismiss notification"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          )}

                          {/* Previously compiled files */}
                          {!compileHooks.qJobResult && (selectedShareForBatch?.latestApprovalJob || selectedShareForBatch?.latestProductionJob) && (
                            <div style={{ 
                              background: 'rgba(255,255,255,0.02)', 
                              border: '1px solid var(--glass-border)', 
                              borderRadius: '8px', 
                              padding: '12px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '10px'
                            }}>
                              <strong style={{ fontSize: '0.8rem', color: '#fff' }}>Previous PDFs</strong>
                              <div style={{ display: 'flex', gap: '16px' }}>
                                {selectedShareForBatch.latestApprovalJob && (
                                  selectedShareForBatch.latestApprovalJob.isLocalJob ? (
                                    <span style={{ color: 'var(--primary)', fontSize: '0.8rem', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                      <FileText size={13} /> Approval Proof (saved)
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setPreviewJob({ id: selectedShareForBatch.latestApprovalJob.id, pdfType: 'APPROVAL', fileName: `Approval_Proof_Share_${selectedShareForBatch.id}.pdf` })}
                                      style={{ background: 'none', border: 'none', padding: 0, color: 'var(--primary)', fontSize: '0.8rem', fontWeight: 'bold', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}
                                    >
                                      <FileText size={13} /> Approval Proof
                                    </button>
                                  )
                                )}
                                {selectedShareForBatch.latestProductionJob && (
                                  selectedShareForBatch.latestProductionJob.isLocalJob ? (
                                    <span style={{ color: '#10b981', fontSize: '0.8rem', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                      <FileText size={13} /> Production PDF (saved)
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setPreviewJob({ id: selectedShareForBatch.latestProductionJob.id, pdfType: 'PRODUCTION', fileName: `Production_Grid_Share_${selectedShareForBatch.id}.pdf` })}
                                      style={{ background: 'none', border: 'none', padding: 0, color: '#10b981', fontSize: '0.8rem', fontWeight: 'bold', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}
                                    >
                                      <FileText size={13} /> Production PDF
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
                  {previewJob.pdfType === 'PRODUCTION' ? 'Production PDF' : 'Approval Proof'}
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                  {previewJob.fileName}
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

      {compileHooks.showValidationModal && (
        <ValidationModal
          validationResult={compileHooks.validationResult}
          onFixRecords={() => compileHooks.setShowValidationModal(false)}
          onSkipAndPrint={() => {
            compileHooks.setShowValidationModal(false);
            if (compileHooks.validationResult.totalSlots > compileHooks.validationResult.totalCards) {
              compileHooks.setShowEmptySlotModal(true);
            } else {
              compileHooks.proceedWithQuickCompile(compileHooks.pendingCompileType!, true, compileHooks.emptySlotStrategy, compileHooks.pendingPaperSize, compileHooks.pendingOrientation, compileHooks.pendingLayoutConfig || undefined, compileHooks.pendingCustomCardId);
            }
          }}
        />
      )}

      {compileHooks.showEmptySlotModal && (
        <EmptySlotModal
          validationResult={compileHooks.validationResult}
          emptySlotStrategy={compileHooks.emptySlotStrategy}
          onStrategyChange={compileHooks.setEmptySlotStrategy}
          onCancel={() => compileHooks.setShowEmptySlotModal(false)}
          onConfirm={() => {
            compileHooks.setShowEmptySlotModal(false);
            compileHooks.proceedWithQuickCompile(compileHooks.pendingCompileType!, true, compileHooks.emptySlotStrategy, compileHooks.pendingPaperSize, compileHooks.pendingOrientation, compileHooks.pendingLayoutConfig || undefined, compileHooks.pendingCustomCardId);
          }}
        />
      )}
    </div>
  );
}
