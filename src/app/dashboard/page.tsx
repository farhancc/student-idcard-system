'use client';

import React, { useEffect, useState } from 'react';
import {
  Users, FileText, Layers, TrendingUp, ArrowRight, PlusCircle,
  FileSpreadsheet, Zap, CheckCircle, AlertCircle, Clock, CreditCard,
  Activity, BarChart2, Package, ShoppingCart, RefreshCw
} from 'lucide-react';

function StatCard({ icon, label, value, sub, color, badge }: any) {
  return (
    <div className="glass-panel" style={{
      display: 'flex', alignItems: 'center', gap: '18px',
      padding: '20px 24px', transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      cursor: 'default'
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; }}
    >
      <div style={{
        width: '52px', height: '52px', borderRadius: '14px', flexShrink: 0,
        background: `${color}18`, color, display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: `1px solid ${color}30`
      }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: '600', marginBottom: '4px' }}>{label}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <span style={{ fontSize: '2rem', fontWeight: '700', lineHeight: 1 }}>{value}</span>
          {badge && <span style={{ fontSize: '0.7rem', padding: '2px 7px', borderRadius: '20px', background: `${color}20`, color, fontWeight: '600' }}>{badge}</span>}
        </div>
        {sub && <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '4px' }}>{sub}</div>}
      </div>
    </div>
  );
}

function MiniBarChart({ data }: { data: { month: string; cards: number }[] }) {
  const max = Math.max(...data.map(d => d.cards), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '80px' }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <div style={{
            width: '100%', height: `${Math.max(4, (d.cards / max) * 70)}px`,
            background: i === data.length - 1 ? 'var(--primary-gradient)' : 'rgba(99,102,241,0.25)',
            borderRadius: '4px 4px 0 0', transition: 'height 0.4s ease'
          }} title={`${d.cards} cards`} />
          <span style={{ fontSize: '0.6rem', color: 'var(--muted)' }}>{d.month}</span>
        </div>
      ))}
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    COMPLETED: '#10b981', FAILED: '#ef4444', PENDING: '#f59e0b', PROCESSING: '#6366f1'
  };
  return <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: colors[status] || '#888', display: 'inline-block', flexShrink: 0 }} />;
}

function timeAgo(date: string) {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  async function fetchAnalytics() {
    try {
      setLoading(true);
      const res = await fetch('/api/analytics');
      if (res.ok) {
        const json = await res.json();
        if (json.success) setData(json);
      }
    } catch (err) {
      console.error('Fetch analytics error:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchAnalytics(); }, []);

  // 90-day archive automatic backup logic for Desktop client
  useEffect(() => {
    const runArchiveBackup = async () => {
      // Check if running in desktop Electron client
      const isDesktop = typeof window !== 'undefined' && (window as any).electronAPI?.isDesktop;
      if (!isDesktop) return;

      try {
        const response = await fetch('/api/archive/expired');
        if (!response.ok) return;

        const resData = await response.json();
        if (resData.success && resData.data && resData.data.length > 0) {
          console.log(`[Archive]: Found ${resData.data.length} client groups with expired records (> 90 days).`);
          let totalPurged = 0;

          for (const group of resData.data) {
            if (!group.records || group.records.length === 0) continue;

            // Trigger Electron backup
            const backupResult = await (window as any).electronAPI.runBackup({
              clientName: group.clientName,
              templateName: group.templateName,
              templateFields: group.templateFields,
              records: group.records
            });

            if (backupResult && backupResult.success && backupResult.savedIds && backupResult.savedIds.length > 0) {
              // Send purge request to Next.js API
              const purgeRes = await fetch('/api/archive/purge', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ ids: backupResult.savedIds })
              });

              if (purgeRes.ok) {
                const purgeData = await purgeRes.json();
                if (purgeData.success) {
                  totalPurged += purgeData.deletedCount;
                }
              }
            }
          }

          if (totalPurged > 0) {
            alert(`[IDexo Storage Management]: Automatically backed up and archived ${totalPurged} old records (exceeding 90 days) to your Documents/IDexo_Backups directory. Server storage has been successfully freed up.`);
            fetchAnalytics();
          }
        }
      } catch (err) {
        console.error('Automatic archive backup failed:', err);
      }
    };

    // Run slightly after mount to not block initial page render
    const timer = setTimeout(runArchiveBackup, 3000);
    return () => clearTimeout(timer);
  }, []);

  const s = data?.summary || {};
  const breakdowns = data?.breakdowns || { byType: {}, byStatus: {} };
  const topClients: any[] = data?.topClients || [];
  const recentJobs: any[] = data?.recentJobs || [];
  const recentOrders: any[] = data?.recentOrders || [];
  const monthlyTrend: any[] = data?.monthlyTrend || [];

  const cardChange = s.cardsLastMonth > 0
    ? `${s.cardsGenerated >= s.cardsLastMonth ? '+' : ''}${Math.round(((s.cardsGenerated - s.cardsLastMonth) / s.cardsLastMonth) * 100)}% vs last month`
    : 'No prior month data';

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '100px 0' }}>
      <div className="spinner" />
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ marginBottom: '4px' }}>Press Dashboard</h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {(s.pendingJobs ?? 0) > 0 && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '6px 14px', borderRadius: '20px',
              background: 'rgba(245,158,11,0.15)', color: '#f59e0b',
              fontSize: '0.78rem', fontWeight: '600', border: '1px solid rgba(245,158,11,0.3)'
            }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#f59e0b', animation: 'pulse 1.5s infinite' }} />
              {s.pendingJobs} active job{s.pendingJobs !== 1 ? 's' : ''}
            </span>
          )}
          <button className="btn btn-secondary" style={{ gap: '8px', padding: '8px 16px' }} onClick={fetchAnalytics}>
            <RefreshCw size={14} /> Refresh
          </button>
          <a href="/dashboard/orders" className="btn btn-primary" style={{ gap: '8px', padding: '8px 16px' }}>
            <PlusCircle size={14} /> New Order
          </a>
        </div>
      </div>

      {/* Top KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '28px' }}>
        <StatCard icon={<TrendingUp size={22} />} label="Cards This Month" value={s.cardsGenerated ?? 0} sub={cardChange} color="#10b981" />
        <StatCard icon={<ShoppingCart size={22} />} label="Orders This Month" value={s.ordersThisMonth ?? 0} sub={`${s.totalCardholders ?? 0} total cardholders`} color="#6366f1" />
        <StatCard icon={<Users size={22} />} label="Active Clients" value={s.clientsServed ?? 0} color="#0ea5e9" badge={`${s.pdfsGenerated ?? 0} PDFs`} />
        <StatCard icon={<CreditCard size={22} />} label="Print Credits" value={s.credits ?? 0} sub={s.lockedCredits > 0 ? `${s.lockedCredits} locked` : 'Available'} color="#f59e0b" />
        <StatCard
          icon={<FileText size={22} />}
          label="Revenue (This Month)"
          value={`Rs. ${(s.revenueThisMonth ?? 0).toLocaleString('en-IN')}`}
          sub={s.pendingRevenue > 0 ? `Rs. ${s.pendingRevenue.toLocaleString('en-IN')} pending` : 'All collected'}
          color="#a855f7"
        />
      </div>

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', alignItems: 'start' }}>

        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Monthly production trend */}
          <div className="glass-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <BarChart2 size={18} color="#6366f1" /> Monthly Card Production
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Last 6 months</span>
            </div>
            {monthlyTrend.length > 0
              ? <MiniBarChart data={monthlyTrend} />
              : <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '20px 0', fontSize: '0.85rem' }}>No production data yet.</p>
            }
          </div>

          {/* Recent Jobs */}
          <div className="glass-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Activity size={18} color="#6366f1" /> Recent PDF Jobs
              </h3>
              <a href="/dashboard/pdf-jobs" style={{ fontSize: '0.78rem', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                View all <ArrowRight size={12} />
              </a>
            </div>
            {recentJobs.length === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: '0.85rem', textAlign: 'center', padding: '20px 0' }}>No PDF jobs run yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {recentJobs.map((job: any) => (
                  <div key={job.id} style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '10px 12px', borderRadius: '8px',
                    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)'
                  }}>
                    <StatusDot status={job.status} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: '500', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {job.fileName}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{job.clientName} · {job.pdfType}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{timeAgo(job.generatedAt)}</div>
                    </div>
                    {job.status === 'PROCESSING' && (
                      <div style={{ width: '50px', height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ width: `${job.progress ?? 0}%`, height: '100%', background: 'var(--primary-gradient)', transition: 'width 0.3s' }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Orders */}
          <div className="glass-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Package size={18} color="#6366f1" /> Recent Orders
              </h3>
              <a href="/dashboard/orders" style={{ fontSize: '0.78rem', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                View all <ArrowRight size={12} />
              </a>
            </div>
            {recentOrders.length === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: '0.85rem', textAlign: 'center', padding: '20px 0' }}>No orders created yet.</p>
            ) : (
              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Client</th>
                      <th>Template</th>
                      <th>Cards</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.map((o: any) => (
                      <tr key={o.id}>
                        <td style={{ fontWeight: '500' }}>{o.clientName}</td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{o.templateName}</td>
                        <td>{o.cardCount}</td>
                        <td>
                          <span className={`badge ${o.status === 'APPROVED' ? 'badge-success' : o.status === 'DRAFT' ? 'badge-warning' : 'badge-primary'}`} style={{ fontSize: '0.65rem' }}>
                            {o.status}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{timeAgo(o.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Quick Actions */}
          <div className="glass-panel">
            <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Zap size={18} color="#f59e0b" /> Quick Actions
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { href: '/dashboard/clients', icon: <PlusCircle size={16} color="#6366f1" />, label: 'Add New Client', sub: 'Register a school or org' },
                { href: '/dashboard/templates', icon: <Layers size={16} color="#0ea5e9" />, label: 'Create Template', sub: 'Design card layout' },
                { href: '/dashboard/orders', icon: <FileSpreadsheet size={16} color="#10b981" />, label: 'New Print Order', sub: 'Queue a batch job' },
                { href: '/dashboard/pdf-jobs', icon: <Activity size={16} color="#a855f7" />, label: 'Monitor PDF Jobs', sub: 'View compile queue' },
                { href: '/dashboard/invoices', icon: <CreditCard size={16} color="#f59e0b" />, label: 'View Invoices', sub: 'Billing & payments' },
              ].map(item => (
                <a key={item.href} href={item.href} style={{
                  display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px',
                  borderRadius: '10px', background: 'rgba(255,255,255,0.025)',
                  border: '1px solid rgba(255,255,255,0.06)', textDecoration: 'none',
                  transition: 'background 0.2s ease'
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.08)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
                >
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {item.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: '500', color: '#fff' }}>{item.label}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{item.sub}</div>
                  </div>
                  <ArrowRight size={14} color="var(--muted)" style={{ marginLeft: 'auto' }} />
                </a>
              ))}
            </div>
          </div>

          {/* PDF Breakdown */}
          <div className="glass-panel">
            <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FileText size={18} color="#6366f1" /> PDF Job Breakdown
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
              {Object.entries(breakdowns.byType).map(([type, count]: [string, any]) => {
                const colors: Record<string, string> = { PRODUCTION: '#10b981', APPROVAL: '#6366f1', INDIVIDUAL: '#0ea5e9', INVOICE: '#f59e0b' };
                const total = Object.values(breakdowns.byType).reduce((a: any, b: any) => a + b, 0) || 1;
                return (
                  <div key={type}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{type}</span>
                      <span style={{ fontSize: '0.78rem', fontWeight: '600', color: '#fff' }}>{count}</span>
                    </div>
                    <div style={{ height: '5px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.round((count / (total as number)) * 100)}%`, height: '100%', background: colors[type] || '#888', borderRadius: '3px', transition: 'width 0.5s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '10px', fontWeight: '600' }}>Job Statuses</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {Object.entries(breakdowns.byStatus).map(([status, count]: [string, any]) => {
                  const colors: Record<string, string> = { COMPLETED: '#10b981', FAILED: '#ef4444', PENDING: '#f59e0b', PROCESSING: '#6366f1' };
                  return (
                    <div key={status} style={{ padding: '8px 10px', borderRadius: '8px', background: `${colors[status] || '#888'}12`, border: `1px solid ${colors[status] || '#888'}25` }}>
                      <div style={{ fontSize: '1.1rem', fontWeight: '700', color: colors[status] || '#fff' }}>{count}</div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{status}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Top Clients */}
          <div className="glass-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Users size={18} color="#6366f1" /> Top Clients
              </h3>
              <a href="/dashboard/clients" style={{ fontSize: '0.75rem', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                All <ArrowRight size={12} />
              </a>
            </div>
            {topClients.length === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: '0.82rem', textAlign: 'center', padding: '14px 0' }}>No clients yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {topClients.map((c: any, i: number) => {
                  const maxCards = topClients[0]?.cardCount || 1;
                  return (
                    <a key={c.id} href={`/dashboard/clients/${c.id}`} style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none', padding: '8px', borderRadius: '8px', transition: 'background 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: '700', color: '#6366f1', flexShrink: 0 }}>
                        {i + 1}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: '500', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                        <div style={{ height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', marginTop: '4px' }}>
                          <div style={{ width: `${Math.round((c.cardCount / maxCards) * 100)}%`, height: '100%', background: 'var(--primary-gradient)', borderRadius: '2px' }} />
                        </div>
                      </div>
                      <span style={{ fontSize: '0.78rem', color: 'var(--muted)', flexShrink: 0 }}>{c.cardCount}</span>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
