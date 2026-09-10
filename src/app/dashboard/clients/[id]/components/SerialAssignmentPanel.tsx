'use client';

import React, { useState } from 'react';
import { CheckCircle } from 'lucide-react';

interface SerialResult {
  assignedCount: number;
  lastAllocated: string;
}

export function SerialAssignmentPanel({
  clientId,
  onComplete,
  onCancel,
}: {
  clientId: number;
  onComplete: () => void;
  onCancel: () => void;
}) {
  const [serialPrefix, setSerialPrefix] = useState('STU');
  const [serialStart, setSerialStart] = useState('1');
  const [serialPad, setSerialPad] = useState('4');
  const [serialResult, setSerialResult] = useState<SerialResult | null>(null);
  const [serialError, setSerialError] = useState('');
  const [serialLoading, setSerialLoading] = useState(false);

  const handleAssignSerials = async (e: React.FormEvent) => {
    e.preventDefault();
    setSerialError('');
    setSerialResult(null);
    setSerialLoading(true);

    try {
      const res = await fetch(`/api/clients/${clientId}/assign-serials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prefix: serialPrefix.trim(),
          startSeq: Number(serialStart) || 1,
          padLen: Number(serialPad) || 4,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to assign serials');

      setSerialResult(json);
      onComplete();
    } catch (err: any) {
      setSerialError(err.message || 'Serials assignment failed');
    } finally {
      setSerialLoading(false);
    }
  };

  return (
    <div className="glass-panel" style={{ maxWidth: '640px' }}>
      <h3 style={{ marginBottom: '20px' }}>Sequential Serial Number Allocation</h3>
      <p style={{ marginBottom: '24px', fontSize: '0.85rem' }}>
        Batch assign unique serial numbers to all cardholders who do not have one assigned yet.
      </p>

      {serialError && (
        <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f77', borderRadius: '6px', marginBottom: '20px', fontSize: '0.85rem' }}>
          {serialError}
        </div>
      )}

      {serialResult && (
        <div className="glass-panel" style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', marginBottom: '24px', border: '1px solid var(--success)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--success)', marginBottom: '12px' }}>
            <CheckCircle size={18} />
            <h4 style={{ color: 'var(--success)' }}>Serials Assigned Successfully</h4>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
            Assigned <strong style={{ color: '#fff' }}>{serialResult.assignedCount}</strong> new serials. Last sequential number allocated: <strong style={{ color: '#fff' }}>{serialResult.lastAllocated}</strong>.
          </p>
        </div>
      )}

      <form onSubmit={handleAssignSerials} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div className="form-group">
          <label className="form-label">Serial Prefix</label>
          <input type="text" className="form-input" placeholder="e.g. STU, EMP, VOL" value={serialPrefix} onChange={e => setSerialPrefix(e.target.value)} />
        </div>

        <div className="form-group">
          <label className="form-label">Sequence Starts At</label>
          <input type="number" min="1" className="form-input" value={serialStart} onChange={e => setSerialStart(e.target.value)} />
        </div>

        <div className="form-group" style={{ gridColumn: 'span 2' }}>
          <label className="form-label">Zero Padding Length</label>
          <select className="form-select" value={serialPad} onChange={e => setSerialPad(e.target.value)}>
            <option value="3">3 digits (e.g. STU-001)</option>
            <option value="4">4 digits (e.g. STU-0001)</option>
            <option value="5">5 digits (e.g. STU-00001)</option>
            <option value="6">6 digits (e.g. STU-000001)</option>
          </select>
        </div>

        <div style={{ gridColumn: 'span 2', display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
          <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={serialLoading}>
            {serialLoading ? 'Processing Allocation...' : 'Allocate Serials'}
          </button>
        </div>
      </form>
    </div>
  );
}
