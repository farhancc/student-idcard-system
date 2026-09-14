import React from 'react';
import { Package, Clock } from 'lucide-react';

interface OrderStatsOverviewProps {
  totalOrders?: number;
  pendingPrinting?: number;
}

export function OrderStatsOverview({ totalOrders = 0, pendingPrinting = 0 }: OrderStatsOverviewProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
      <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{
          width: '46px', height: '46px', borderRadius: '12px',
          background: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8', flexShrink: 0
        }}>
          <Package size={22} />
        </div>
        <div>
          <h4 style={{ margin: 0, color: 'var(--muted)', fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Orders</h4>
          <p style={{ margin: '2px 0 0 0', fontSize: '1.6rem', fontWeight: 700, color: '#ffffff', lineHeight: 1.1 }}>
            {totalOrders}
          </p>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{
          width: '46px', height: '46px', borderRadius: '12px',
          background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fbbf24', flexShrink: 0
        }}>
          <Clock size={22} />
        </div>
        <div>
          <h4 style={{ margin: 0, color: 'var(--muted)', fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Pending Printing</h4>
          <p style={{ margin: '2px 0 0 0', fontSize: '1.6rem', fontWeight: 700, color: '#fbbf24', lineHeight: 1.1 }}>
            {pendingPrinting}
          </p>
        </div>
      </div>
    </div>
  );
}
