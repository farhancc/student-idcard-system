import React from 'react';

export function PrintJobStatusModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="glass-panel" style={{ padding: '24px', width: '400px', maxWidth: '90%' }}>
        <h3>Print Job Status</h3>
        <p>No active print jobs.</p>
        <button className="btn btn-secondary" onClick={onClose} style={{ marginTop: '16px' }}>Close</button>
      </div>
    </div>
  );
}
