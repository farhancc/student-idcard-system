import React from 'react';

export function OrderPDFCompilerCard({
  handleWhatsAppShare,
}: {
  handleWhatsAppShare: () => void;
}) {
  return (
    <div className="glass-panel" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem' }}>
          Proofs
        </h3>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ fontSize: '0.8rem', padding: '8px 12px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
          onClick={handleWhatsAppShare}
        >
          Share Proofs Link
        </button>
      </div>
    </div>
  );
}
