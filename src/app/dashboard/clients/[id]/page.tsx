'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/components/ui/toast';
import ConfirmDialog from '@/app/components/ConfirmDialog';
import CompileWizardModal from '@/app/components/CompileWizardModal';
import PdfCompileLoadingAnimation from '@/app/components/PdfCompileLoadingAnimation';
import { Building2, ArrowLeft, RefreshCw, Search, Shuffle, UserCheck, UserX, Trash2, Download, CheckCircle2, X, Users, FileSpreadsheet, Upload, Plus } from 'lucide-react';

import CardholderGroupedTables from './components/CardholderGroupedTables';
import { CardholderViewModal } from './components/CardholderViewModal';
import { CardholderEditModal } from './components/CardholderEditModal';
import { BulkReassignModal } from './components/BulkReassignModal';
import { ValidationModal } from './components/ValidationModal';
import { EmptySlotModal } from './components/EmptySlotModal';
import { CardholderAddForm } from './components/CardholderAddForm';
import { BatchCompilePanel } from './components/BatchCompilePanel';
import { SerialAssignmentPanel } from './components/SerialAssignmentPanel';
import { PortalSharesPanel } from './components/PortalSharesPanel';

import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { useClientData } from './hooks/useClientData';
import { useCardholderFilters, getTemplateColumns, getFieldValue } from './hooks/useCardholderFilters';
import { useCSVImport } from './hooks/useCSVImport';
import { useCompileWorkflow } from './hooks/useCompileWorkflow';
import { useBulkOperations } from './hooks/useBulkOperations';
import { getCustomFieldValueCaseInsensitive, getEffectivePhotoUrl } from './components/utils';

export default function ClientDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = Number(params.id);
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'list' | 'add' | 'csv' | 'zip' | 'serials' | 'portal'>('list');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [viewingCardholder, setViewingCardholder] = useState<any | null>(null);
  const [editingCardholder, setEditingCardholder] = useState<any | null>(null);

  const [previewTemplate, setPreviewTemplate] = useState<any | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewSide, setPreviewSide] = useState<'front' | 'back'>('front');

  const [zipping, setZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState('');

  const { confirmOpen, confirmConfig, showConfirm, closeConfirm } = useConfirmDialog();

  const { client, cardholders, setCardholders, clientTemplates, quickTemplates, loading, handleRefresh } = useClientData(clientId);

  const { search, setSearch, searchId, setSearchId, filterTemplate, setFilterTemplate, filteredCardholders, getCardholderWarnings } = useCardholderFilters(cardholders, clientTemplates);

  const { showBulkReassignModal, setShowBulkReassignModal, bulkReassignTemplateId, setBulkReassignTemplateId, bulkOperationLoading, handleBulkDelete, handleBulkStatusToggle, handleBulkReassign } = useBulkOperations({ selectedIds, setSelectedIds, handleRefresh, showConfirm, closeConfirm });

  const compileHooks = useCompileWorkflow({ clientId, cardholders, selectedIds, quickTemplates, setSelectedIds });

  useEffect(() => {
    if (!viewingCardholder) {
      setPreviewTemplate(null);
      return;
    }
    const templateId = viewingCardholder.resolvedTemplateId;
    if (!templateId) {
      setPreviewTemplate(null);
      return;
    }
    setPreviewLoading(true);
    setPreviewSide('front');
    fetch(`/api/templates/${templateId}?_t=${Date.now()}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.template) setPreviewTemplate(data.template);
        else setPreviewTemplate(null);
      })
      .catch(() => setPreviewTemplate(null))
      .finally(() => setPreviewLoading(false));
  }, [viewingCardholder]);

  const handleDeleteCardholder = (id: number) => {
    const cardholder = cardholders.find((c: any) => c.id === id);
    showConfirm({
      title: 'Delete Cardholder',
      message: `Permanently delete ${cardholder?.name || 'this cardholder'}? This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/cardholders/${id}`, { method: 'DELETE' });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to delete cardholder');
          toast('Cardholder deleted permanently.', 'success');
          setSelectedIds(prev => prev.filter(x => x !== id));
          handleRefresh();
        } catch (err: any) {
          toast(err.message || 'Failed to delete cardholder', 'error');
        } finally {
          closeConfirm();
        }
      },
    });
  };

  const downloadCardholderExport = async (
    targetCardholders: any[],
    format: 'xlsx' | 'zip',
    fileName?: string
  ) => {
    if (targetCardholders.length === 0) {
      toast('No cardholders to export.', 'warning');
      return;
    }
    try {
      if (format === 'zip') { setZipping(true); setZipProgress('Preparing ZIP…'); }
      const res = await fetch('/api/cardholders/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardholderIds: targetCardholders.map((c: any) => c.id),
          format,
          fileName,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Export failed (HTTP ${res.status})`);
      }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${(fileName || 'cardholders').replace(/[^a-zA-Z0-9_-]/g, '_')}.${format}`;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch (err: any) {
      toast(err.message || 'Export failed', 'error');
    } finally {
      setZipping(false);
      setZipProgress('');
    }
  };

  const handleExportExcel = (targetCardholders: any[], templateName?: string) =>
    downloadCardholderExport(targetCardholders, 'xlsx', templateName);
  const handleDownloadZip = (targetCardholders: any[], templateName?: string) =>
    downloadCardholderExport(targetCardholders, 'zip', templateName);
  // Fallback
  const handlePurgeClient = () => {};

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '100px 0' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link href="/dashboard/clients" style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '36px', height: '36px', borderRadius: '50%',
            border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.02)', color: '#fff'
          }}>
            <ArrowLeft size={16} />
          </Link>
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--muted)', textTransform: 'uppercase' }}>Clients</span>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '2px', fontSize: '1.75rem' }}>
              <Building2 size={24} color="var(--primary)" /> {client?.name}
            </h1>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button className="btn btn-secondary" style={{ fontSize: '0.85rem', padding: '8px 14px', gap: '6px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399', cursor: 'pointer' }} onClick={handleRefresh} disabled={loading}>
            <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--glass-border)', marginBottom: '32px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {[
            { key: 'list', label: `Cardholders (${cardholders.length})`, icon: Users },
            { key: 'portal', label: 'Portal Links', icon: Building2 },
            { key: 'csv', label: 'Google Form', icon: FileSpreadsheet },
            { key: 'zip', label: 'Batch Import', icon: Upload },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as any)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '7px',
                padding: '12px 18px', background: 'transparent', border: 'none',
                borderBottom: activeTab === key ? '2px solid var(--primary)' : '2px solid transparent',
                color: activeTab === key ? '#fff' : 'var(--muted)', cursor: 'pointer',
                fontWeight: activeTab === key ? '600' : '400', fontSize: '0.9rem',
              }}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn btn-primary"
          style={{ fontSize: '0.85rem', padding: '8px 16px', marginBottom: '8px' }}
          onClick={() => setActiveTab('add')}
        >
          <Plus size={15} /> Add Cardholder
        </button>
      </div>

      {activeTab === 'list' && (
        <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} color="var(--muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input type="text" placeholder="Search name/role..." value={search} onChange={e => setSearch(e.target.value)} style={{ padding: '8px 12px 8px 34px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: '6px', color: '#fff', fontSize: '0.9rem', width: '200px' }} />
              </div>
              <div style={{ position: 'relative' }}>
                <Search size={14} color="var(--muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input type="text" placeholder="Search ID..." value={searchId} onChange={e => setSearchId(e.target.value)} style={{ padding: '8px 12px 8px 34px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: '6px', color: '#fff', fontSize: '0.9rem', width: '150px' }} />
              </div>
              <select value={filterTemplate} onChange={e => setFilterTemplate(e.target.value)} style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: '6px', color: '#fff', fontSize: '0.9rem' }}>
                <option value="">All Templates</option>
                {clientTemplates.map((t: any) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            {selectedIds.length > 0 && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', background: 'rgba(59,130,246,0.1)', padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(59,130,246,0.2)' }}>
                <button className="btn btn-secondary" onClick={() => compileHooks.handleOpenCompileModal()}>Compile ({selectedIds.length})</button>
                <button className="btn btn-secondary" onClick={() => setShowBulkReassignModal(true)}><Shuffle size={14} /> Reassign</button>
                <button className="btn btn-secondary" onClick={() => handleBulkStatusToggle(true)}><UserCheck size={14} /> Activate</button>
                <button className="btn btn-secondary" onClick={() => handleBulkStatusToggle(false)}><UserX size={14} /> Deactivate</button>
                <button className="btn btn-danger" onClick={handleBulkDelete} disabled={bulkOperationLoading}><Trash2 size={14} /> Delete</button>
              </div>
            )}
          </div>

          <CardholderGroupedTables
            filteredCardholders={filteredCardholders}
            clientTemplates={clientTemplates}
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
            filterTemplate={filterTemplate}
            onViewDetails={setViewingCardholder}
            onEdit={setEditingCardholder}
            onDelete={handleDeleteCardholder}
            onCompileTable={compileHooks.handleCompileTable}
            onExportExcel={handleExportExcel}
            onDownloadZip={handleDownloadZip}
            onPurgeClient={handlePurgeClient}
            onCompileIndividual={compileHooks.handleCompileIndividual}
            getTemplateColumns={getTemplateColumns}
            getFieldValue={(ch, colKey) => getFieldValue(ch, colKey, getCustomFieldValueCaseInsensitive, getEffectivePhotoUrl)}
            getCardholderWarnings={getCardholderWarnings}
            getEffectivePhotoUrl={getEffectivePhotoUrl}
            zipping={zipping}
            zipProgress={zipProgress}
          />

          {compileHooks.showCompileModal && (
            <CompileWizardModal
              cardCount={selectedIds.length}
              onClose={() => compileHooks.setShowCompileModal(false)}
              compiling={!!compileHooks.qCompiling}
              onCompile={async (cfg) => {
                await compileHooks.handleQuickCompile(cfg.compileType as any, cfg as any);
                compileHooks.setShowCompileModal(false);
              }}
            />
          )}

          {/* While the job is still running, hold here with live progress rather
              than handing the operator off to the background daemon widget. */}
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
                      ? 'Queued \u2014 waiting for the renderer\u2026'
                      : 'Compiling Print-Ready PDF\u2026'
                  }
                  subMessage={
                    (compileHooks.qJobResult.chunkCount ?? 0) > 1
                      ? `Part ${Math.min((compileHooks.qJobResult.chunks?.length ?? 0) + 1, compileHooks.qJobResult.chunkCount!)} of ${compileHooks.qJobResult.chunkCount}`
                      : `${compileHooks.qJobResult.pdfType === 'PRODUCTION' ? 'Production' : 'Proof'} PDF \u00b7 job #${compileHooks.qJobResult.id}`
                  }
                />

                {compileHooks.qJobResult.pollError && (
                  <div style={{ marginTop: '14px', padding: '10px 12px', borderRadius: '8px', fontSize: '0.78rem', color: '#fca5a5', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
                    {compileHooks.qJobResult.pollError} The PDF may still be compiling \u2014 progress will resume if the
                    connection recovers.
                  </div>
                )}

                <div style={{ marginTop: '18px', textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={() => compileHooks.setQJobResult(null)}
                    style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '0.76rem', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Hide this and keep compiling in the background
                  </button>
                </div>
              </div>
            </div>
          )}

          {compileHooks.qJobResult
            && (compileHooks.qJobResult.status === 'COMPLETED' || compileHooks.qJobResult.status === 'FAILED') && (
            <div style={{ marginTop: '24px', padding: '16px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ margin: '0 0 4px 0' }}>Job Status: {compileHooks.qJobResult.status}</h4>
                  <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                    Progress: {compileHooks.qJobResult.progress}%
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {compileHooks.qJobResult.status === 'COMPLETED' && (
                    <div style={{ color: '#10b981', fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CheckCircle2 size={16} /> PDF Downloaded & Saved to File
                    </div>
                  )}
                  {compileHooks.qJobResult.status === 'FAILED' && (
                    <div style={{ color: '#ef4444', fontSize: '0.85rem' }}>{compileHooks.qJobResult.errorMsg}</div>
                  )}
                  <button
                    onClick={() => compileHooks.setQJobResult(null)}
                    style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '4px' }}
                    title="Dismiss notification"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'add' && <CardholderAddForm clientId={clientId} clientTemplates={clientTemplates} onSuccess={() => { handleRefresh(); setActiveTab('list'); }} onCancel={() => setActiveTab('list')} />}
      {activeTab === 'csv' && (
        <BatchCompilePanel
          source="googleForm"
          clientId={clientId}
          clientName={client?.name}
          clientTemplates={clientTemplates}
          onCancel={() => setActiveTab('list')}
        />
      )}
      {activeTab === 'zip' && <BatchCompilePanel clientId={clientId} clientName={client?.name} clientTemplates={clientTemplates} onCancel={() => setActiveTab('list')} />}
      {activeTab === 'serials' && <SerialAssignmentPanel clientId={clientId} onComplete={handleRefresh} onCancel={() => setActiveTab('list')} />}
      {activeTab === 'portal' && <PortalSharesPanel clientId={clientId} />}

      {viewingCardholder && <CardholderViewModal
        cardholder={viewingCardholder}
        previewTemplate={previewTemplate}
        previewLoading={previewLoading}
        previewSide={previewSide}
        onClose={() => setViewingCardholder(null)}
        onToggleSide={setPreviewSide}
      />}
      
      {editingCardholder && <CardholderEditModal
        cardholder={editingCardholder}
        clientTemplates={clientTemplates}
        onSave={() => { handleRefresh(); setEditingCardholder(null); }}
        onClose={() => setEditingCardholder(null)}
      />}
      
      {showBulkReassignModal && <BulkReassignModal
        onClose={() => setShowBulkReassignModal(false)}
        selectedCount={selectedIds.length}
        templates={clientTemplates}
        templateId={bulkReassignTemplateId}
        onTemplateChange={setBulkReassignTemplateId}
        onConfirm={handleBulkReassign}
        loading={bulkOperationLoading}
      />}
      
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

      <ConfirmDialog 
        open={confirmOpen} 
        title={confirmConfig?.title}
        message={confirmConfig?.message || ''}
        confirmLabel={confirmConfig?.confirmLabel}
        variant={confirmConfig?.variant}
        onConfirm={confirmConfig?.onConfirm || (() => {})}
        onCancel={closeConfirm} 
      />
    </div>
  );
}
