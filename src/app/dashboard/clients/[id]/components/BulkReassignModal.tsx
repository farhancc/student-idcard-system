'use client';
import React from 'react';
import { X, Shuffle } from 'lucide-react';

export function BulkReassignModal({
  onClose,
  selectedCount,
  templates,
  templateId,
  onTemplateChange,
  onConfirm,
  loading
}: {
  onClose: () => void;
  selectedCount: number;
  templates: any[];
  templateId: string;
  onTemplateChange: (id: string) => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '24px'
    }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '440px', padding: '28px', borderRadius: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shuffle size={18} color="var(--primary)" /> Reassign Template
          </h3>
          <button className="btn btn-secondary" style={{ padding: '6px', minWidth: 'auto' }} onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <p style={{ color: 'var(--muted)', fontSize: '0.88rem', marginBottom: '20px' }}>
          Reassign <strong style={{ color: 'var(--text)' }}>{selectedCount} cardholder(s)</strong> to a new template. Their card assets will be marked as stale and regenerated on next use.
        </p>
        <div className="form-group" style={{ marginBottom: '24px' }}>
          <label className="form-label">Select New Template</label>
          <select className="form-input" value={templateId} onChange={e => onTemplateChange(e.target.value)}>
            <option value="">— Choose a template —</option>
            {templates.map((t: any) => (
              <option key={t.id} value={String(t.id)}>{t.name}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            style={{ flex: 1, gap: '6px' }}
            onClick={onConfirm}
            disabled={!templateId || loading}
          >
            {loading ? <div className="spinner" style={{ width: '16px', height: '16px' }} /> : <Shuffle size={14} />}
            {loading ? 'Reassigning...' : `Reassign ${selectedCount} Records`}
          </button>
        </div>
      </div>
    </div>
  );
}
