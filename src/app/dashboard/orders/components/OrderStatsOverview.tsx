import React from 'react';

export function OrderStatsOverview() {
  return (
    <div className="glass-panel" style={{ padding: '16px', marginBottom: '24px', display: 'flex', gap: '20px' }}>
      <div>
        <h4 style={{ margin: 0, color: 'var(--muted)' }}>Total Orders</h4>
        <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>-</p>
      </div>
      <div>
        <h4 style={{ margin: 0, color: 'var(--muted)' }}>Pending Printing</h4>
        <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>-</p>
      </div>
    </div>
  );
}
