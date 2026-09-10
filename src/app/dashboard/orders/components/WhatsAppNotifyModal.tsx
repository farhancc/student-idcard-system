import React from 'react';

export function WhatsAppNotifyModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="glass-panel" style={{ padding: '24px', width: '400px', maxWidth: '90%' }}>
        <h3>Notify via WhatsApp</h3>
        <p>WhatsApp integration pending configuration.</p>
        <button className="btn btn-secondary" onClick={onClose} style={{ marginTop: '16px' }}>Close</button>
      </div>
    </div>
  );
}
