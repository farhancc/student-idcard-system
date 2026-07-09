'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2, Users, CreditCard, TrendingUp, Activity,
  Shield, CheckCircle, XCircle, Clock, Zap, Award,
  BarChart3, DollarSign, RefreshCw, ArrowUpRight, ArrowDownRight,
  Printer, FileText, Type, Package, AlertTriangle, Info
} from 'lucide-react';
import PressAnalyticsTable from './PressAnalyticsTable';

interface PressStat {
  id: number; name: string; plan: string; isActive: boolean;
  currentCredits: number; creditsUsed: number;
  cards: number; revenue: number;
  monthlyCredits: Record<string, number>;
  monthlyCards: Record<string, number>;
  monthlyRevenue: Record<string, number>;
}

interface DashboardData {
  kpis: {
    totalPresses: number;
    activePresses: number;
    suspendedPresses: number;
    totalClients: number;
    totalOrders: number;
    totalJobs: number;
    totalUsers: number;
    totalTemplates: number;
    totalFonts: number;
    pendingCreditRequests: number;
    totalRevenue: number;
    totalCardholders: number;
    totalCreditsInSystem: number;
    totalCreditsUsed: number;
    newPressesThisMonth: number;
    newOrdersThisMonth: number;
  };
  monthKeys: string[];
  monthlyRevenue: Record<string, number>;
  monthlyCards: Record<string, number>;
  monthlyCredits: Record<string, number>;
  topPresses: PressStat[];
  pressStats: PressStat[];
  recentLogs: Array<{
    id: number; action: string; category: string;
    severity: string; createdAt: string; description: string; actorName: string;
  }>;
  recentCreditRequests: Array<{
    id: number; status: string; amount: number; createdAt: string;
    press: { name: string; credits: number };
  }>;
}

// ── Mini SVG sparkline ──────────────────────────────────────────────
function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (!values.length) return null;
  const max = Math.max(...values, 1);
  const W = 80; const H = 28;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = H - (v / max) * H;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
      <polyline
        points={`0,${H} ${pts} ${W},${H}`}
        fill={color} opacity="0.1" stroke="none"
      />
    </svg>
  );
}

// ── Inline bar chart (SVG) ──────────────────────────────────────────
function BarChart({ data, color, label }: {
  data: Record<string, number>; color: string; label: string;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const entries = Object.entries(data);
  const max = Math.max(...entries.map(([, v]) => v), 1);
  const isRevenue = label.toLowerCase().includes('revenue') || label.toLowerCase().includes('rs.');

  return (
    <div style={{ width: '100%' }}>
      <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 60 }}>
        {entries.map(([month, val], idx) => {
          const barHeight = Math.max((val / max) * 40, 3); // Max bar height of 40px, min 3px
          const [, m] = month.split('-');
          const monthName = new Date(0, parseInt(m) - 1).toLocaleString('default', { month: 'short' });
          const isHovered = hoveredIdx === idx;

          return (
            <div 
              key={month} 
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{ 
                flex: 1, 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'flex-end', 
                height: '100%',
                position: 'relative',
                cursor: 'pointer'
              }}
            >
              {isHovered && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: `${barHeight + 20}px`,
                    background: '#0f172a',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    fontSize: '0.65rem',
                    color: '#f1f5f9',
                    whiteSpace: 'nowrap',
                    zIndex: 10,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    pointerEvents: 'none',
                    fontWeight: 700
                  }}
                >
                  {monthName}: {isRevenue ? `Rs. ${val.toLocaleString()}` : val.toLocaleString()}
                </div>
              )}
              <div
                style={{
                  width: '100%', background: color, borderRadius: '3px 3px 0 0',
                  height: `${barHeight}px`, opacity: isHovered ? 0.95 : 0.75,
                  transition: 'height 0.6s ease, opacity 0.15s ease',
                  boxShadow: val > 0 ? (isHovered ? `0 0 10px ${color}` : `0 0 6px ${color}55`) : 'none'
                }}
              />
              <span style={{ fontSize: '0.55rem', color: isHovered ? '#cbd5e1' : '#475569', marginTop: 4, display: 'block', lineHeight: 1, fontWeight: isHovered ? 600 : 400 }}>{monthName}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── KPI Card ────────────────────────────────────────────────────────
function KpiCard({
  icon, label, value, sub, color, bg, trend, sparkValues
}: {
  icon: React.ReactNode; label: string; value: string | number;
  sub?: string; color: string; bg: string;
  trend?: { value: string; up: boolean } | null;
  sparkValues?: number[];
}) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: `1px solid rgba(255,255,255,0.07)`,
      borderTop: `2px solid ${color}`,
      borderRadius: 14, padding: '18px 20px',
      position: 'relative', overflow: 'hidden',
      transition: 'transform 0.2s, box-shadow 0.2s',
    }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 30px rgba(0,0,0,0.3)`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.transform = '';
        (e.currentTarget as HTMLDivElement).style.boxShadow = '';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
          {icon}
        </div>
        {sparkValues && <Sparkline values={sparkValues} color={color} />}
      </div>
      <div style={{ fontSize: '0.68rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.03em', lineHeight: 1 }}>{value}</div>
      {(sub || trend) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
          {trend && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: '0.72rem', color: trend.up ? '#10b981' : '#ef4444', fontWeight: 600 }}>
              {trend.up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {trend.value}
            </span>
          )}
          {sub && <span style={{ fontSize: '0.72rem', color: '#475569' }}>{sub}</span>}
        </div>
      )}
    </div>
  );
}

// ── Severity icon/color ─────────────────────────────────────────────
const SEV: Record<string, { bg: string; color: string; icon: React.ReactNode }> = {
  INFO:     { bg: 'rgba(59,130,246,0.12)',  color: '#60a5fa', icon: <Info size={11} /> },
  WARN:     { bg: 'rgba(234,179,8,0.15)',   color: '#fbbf24', icon: <AlertTriangle size={11} /> },
  CRITICAL: { bg: 'rgba(239,68,68,0.18)',   color: '#f87171', icon: <Zap size={11} /> },
};

export default function DashboardOverview() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/superadmin/dashboard');
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setLastRefresh(new Date());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading && !data) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400, flexDirection: 'column', gap: 16 }}>
      <div style={{ width: 40, height: 40, border: '3px solid rgba(99,102,241,0.3)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Loading platform analytics…</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  const k = data?.kpis;
  const revValues = data ? Object.values(data.monthlyRevenue) : [];
  const cardValues = data ? Object.values(data.monthlyCards) : [];
  const credValues = data ? Object.values(data.monthlyCredits) : [];
  const planColor: Record<string, string> = { ENTERPRISE: '#818cf8', PRO: '#34d399', BASIC: '#60a5fa', TRIAL: '#fbbf24' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Topbar row ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={18} color="#6366f1" /> Platform Overview
          </h2>
          <p style={{ fontSize: '0.75rem', color: '#475569', marginTop: 2 }}>
            Last refreshed: {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 8, color: '#818cf8', fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.15s' }}
        >
          <RefreshCw size={13} style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {/* ── KPI Grid Row 1 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
        <KpiCard icon={<Building2 size={18} />} label="Total Presses" value={k?.totalPresses ?? '—'}
          color="#6366f1" bg="rgba(99,102,241,0.15)"
          trend={{ value: `+${k?.newPressesThisMonth ?? 0} this month`, up: true }}
          sparkValues={[2, 3, 3, 5, 4, k?.totalPresses ?? 0]}
        />
        <KpiCard icon={<CheckCircle size={18} />} label="Active Tenants" value={k?.activePresses ?? '—'}
          color="#10b981" bg="rgba(16,185,129,0.15)"
          sub={`${k ? Math.round((k.activePresses / Math.max(k.totalPresses, 1)) * 100) : 0}% uptime`}
        />
        <KpiCard icon={<XCircle size={18} />} label="Suspended" value={k?.suspendedPresses ?? '—'}
          color="#ef4444" bg="rgba(239,68,68,0.15)"
          trend={k?.suspendedPresses ? { value: 'Needs attention', up: false } : null}
        />
        <KpiCard icon={<Users size={18} />} label="Total Clients" value={k?.totalClients ?? '—'}
          color="#60a5fa" bg="rgba(59,130,246,0.15)"
        />
        <KpiCard icon={<Printer size={18} />} label="Cards Printed" value={k?.totalCardholders?.toLocaleString() ?? '—'}
          color="#8b5cf6" bg="rgba(139,92,246,0.15)"
          sparkValues={cardValues}
        />
        <KpiCard icon={<DollarSign size={18} />} label="Total Revenue" value={`Rs. ${k?.totalRevenue?.toLocaleString(undefined, { maximumFractionDigits: 0 }) ?? '0'}`}
          color="#f59e0b" bg="rgba(245,158,11,0.15)"
          sparkValues={revValues}
        />
        <KpiCard icon={<Package size={18} />} label="Total Orders" value={k?.totalOrders ?? '—'}
          color="#34d399" bg="rgba(52,211,153,0.15)"
          trend={{ value: `+${k?.newOrdersThisMonth ?? 0} this month`, up: true }}
        />
        <KpiCard icon={<CreditCard size={18} />} label="Credits in System" value={k?.totalCreditsInSystem?.toLocaleString() ?? '—'}
          color="#a78bfa" bg="rgba(167,139,250,0.15)"
          sub={`${k?.pendingCreditRequests ?? 0} pending requests`}
        />
        <KpiCard icon={<Zap size={18} />} label="Credits Used (Total)" value={k?.totalCreditsUsed?.toLocaleString() ?? '—'}
          color="#f87171" bg="rgba(239,68,68,0.12)"
          sparkValues={credValues}
          sub="all PDF jobs"
        />
      </div>

      {/* ── Secondary KPIs ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
        {[
          { icon: <Users size={15} />, label: 'Staff Users', value: k?.totalUsers ?? '—', color: '#94a3b8' },
          { icon: <FileText size={15} />, label: 'Templates', value: k?.totalTemplates ?? '—', color: '#818cf8' },
          { icon: <Type size={15} />, label: 'Global Fonts', value: k?.totalFonts ?? '—', color: '#67e8f9' },
          { icon: <BarChart3 size={15} />, label: 'PDF Jobs', value: k?.totalJobs ?? '—', color: '#fb923c' },
        ].map(item => (
          <div key={item.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: item.color }}>{item.icon}</span>
            <div>
              <div style={{ fontSize: '0.65rem', color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f1f5f9' }}>{item.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Charts row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20 }}>
          <BarChart data={data?.monthlyRevenue ?? {}} color="#f59e0b" label="Revenue (last 6 months) · Rs." />
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20 }}>
          <BarChart data={data?.monthlyCards ?? {}} color="#8b5cf6" label="Cards Printed (last 6 months)" />
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20 }}>
          <BarChart data={data?.monthlyCredits ?? {}} color="#f87171" label="Credits Used (last 6 months)" />
        </div>
      </div>

      {/* ── Platform health gauge ── */}
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20 }}>
        <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Platform Health</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
          {[
            { label: 'Tenant Uptime', pct: k ? Math.round((k.activePresses / Math.max(k.totalPresses, 1)) * 100) : 0, color: '#10b981' },
            { label: 'Credit Liquidity', pct: k ? Math.min(100, Math.round((k.totalCreditsInSystem / Math.max(k.totalClients * 50, 1)) * 100)) : 0, color: '#6366f1' },
            { label: 'Order Throughput', pct: k ? Math.min(100, Math.round((k.newOrdersThisMonth / Math.max(k.totalOrders, 1)) * 1000)) : 0, color: '#f59e0b' },
            { label: 'Request Resolution', pct: k ? Math.max(0, 100 - k.pendingCreditRequests * 10) : 100, color: '#34d399' },
          ].map(item => (
            <div key={item.label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#94a3b8', marginBottom: 5 }}>
                <span>{item.label}</span>
                <span style={{ color: item.color, fontWeight: 700 }}>{item.pct}%</span>
              </div>
              <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${item.pct}%`, height: '100%', background: item.color, borderRadius: 3, transition: 'width 1s ease', boxShadow: `0 0 6px ${item.color}` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Bottom 3-column grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>

        {/* Top Presses Leaderboard */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
            <Award size={15} color="#f59e0b" />
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f1f5f9' }}>Top Presses</span>
            <span style={{ fontSize: '0.65rem', color: '#475569', marginLeft: 'auto' }}>by cards</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(data?.topPresses ?? []).map((p, i) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 22, height: 22, borderRadius: 6, background: i === 0 ? 'rgba(245,158,11,0.2)' : i === 1 ? 'rgba(148,163,184,0.15)' : 'rgba(180,83,9,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800, color: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : '#b45309', flexShrink: 0 }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                  <div style={{ fontSize: '0.65rem', color: '#475569' }}>{p.cards} cards · Rs. {p.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                </div>
                <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '2px 6px', borderRadius: 5, background: `${planColor[p.plan] ?? '#818cf8'}20`, color: planColor[p.plan] ?? '#818cf8', border: `1px solid ${planColor[p.plan] ?? '#818cf8'}30`, flexShrink: 0 }}>
                  {p.plan}
                </span>
              </div>
            ))}
            {!data?.topPresses?.length && <p style={{ fontSize: '0.8rem', color: '#475569' }}>No data yet</p>}
          </div>
        </div>

        {/* Recent Audit Logs */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
            <Shield size={15} color="#818cf8" />
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f1f5f9' }}>Audit Logs</span>
            <span style={{ fontSize: '0.65rem', color: '#475569', marginLeft: 'auto' }}>latest 8</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(data?.recentLogs ?? []).map(log => {
              const s = SEV[log.severity] ?? SEV.INFO;
              return (
                <div key={log.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 6px', borderRadius: 5, background: s.bg, color: s.color, fontSize: '0.6rem', fontWeight: 700, flexShrink: 0, marginTop: 1 }}>
                    {s.icon} {log.severity}
                  </span>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#cbd5e1', fontWeight: 500, lineHeight: 1.3 }}>{log.action}</div>
                    <div style={{ fontSize: '0.65rem', color: '#475569' }}>{log.actorName} · {new Date(log.createdAt).toLocaleDateString()}</div>
                  </div>
                </div>
              );
            })}
            {!data?.recentLogs?.length && <p style={{ fontSize: '0.8rem', color: '#475569' }}>No logs yet</p>}
          </div>
        </div>

        {/* Recent Credit Requests */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
            <CreditCard size={15} color="#34d399" />
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f1f5f9' }}>Credit Requests</span>
            {(k?.pendingCreditRequests ?? 0) > 0 && (
              <span style={{ marginLeft: 'auto', background: '#ef4444', color: '#fff', fontSize: '0.6rem', fontWeight: 700, padding: '2px 6px', borderRadius: 10 }}>
                {k?.pendingCreditRequests} pending
              </span>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(data?.recentCreditRequests ?? []).map(req => {
              const stColor = req.status === 'APPROVED' ? '#34d399' : req.status === 'REJECTED' ? '#f87171' : '#fbbf24';
              const stIcon = req.status === 'APPROVED' ? <CheckCircle size={11} /> : req.status === 'REJECTED' ? <XCircle size={11} /> : <Clock size={11} />;
              return (
                <div key={req.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: stColor, fontSize: '0.65rem', fontWeight: 700, flexShrink: 0 }}>
                    {stIcon} {req.status}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.78rem', color: '#f1f5f9', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{req.press?.name ?? '—'}</div>
                    <div style={{ fontSize: '0.65rem', color: '#475569' }}>+{req.amount} credits · {new Date(req.createdAt).toLocaleDateString()}</div>
                  </div>
                </div>
              );
            })}
            {!data?.recentCreditRequests?.length && <p style={{ fontSize: '0.8rem', color: '#475569' }}>No requests yet</p>}
          </div>
        </div>
      </div>

      {/* ── Quick actions ── */}
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20 }}>
        <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>System Summary</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
          {[
            { icon: <TrendingUp size={16} />, label: 'Avg. Cards / Press', value: k ? `${Math.round(k.totalCardholders / Math.max(k.totalPresses, 1))}` : '—', color: '#818cf8' },
            { icon: <DollarSign size={16} />, label: 'Avg. Revenue / Press', value: k ? `Rs. ${Math.round(k.totalRevenue / Math.max(k.totalPresses, 1)).toLocaleString()}` : '—', color: '#f59e0b' },
            { icon: <Users size={16} />, label: 'Avg. Users / Press', value: k ? `${(k.totalUsers / Math.max(k.totalPresses, 1)).toFixed(1)}` : '—', color: '#60a5fa' },
            { icon: <Activity size={16} />, label: 'Avg. Clients / Press', value: k ? `${(k.totalClients / Math.max(k.totalPresses, 1)).toFixed(1)}` : '—', color: '#34d399' },
            { icon: <Zap size={16} />, label: 'Avg. Credits Used / Press', value: k ? `${Math.round(k.totalCreditsUsed / Math.max(k.totalPresses, 1)).toLocaleString()}` : '—', color: '#f87171' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ color: item.color }}>{item.icon}</span>
              <div>
                <div style={{ fontSize: '0.65rem', color: '#475569', fontWeight: 600 }}>{item.label}</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f1f5f9' }}>{item.value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Per-press analytics table ── */}
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <BarChart3 size={16} color="#6366f1" />
          <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f1f5f9' }}>Per-Press Breakdown</span>
          <span style={{ fontSize: '0.72rem', color: '#475569', marginLeft: 4 }}>— credits used · cards printed · revenue · last 6 months</span>
        </div>
        <PressAnalyticsTable
          pressStats={data?.pressStats ?? []}
          monthKeys={data?.monthKeys ?? []}
          totalCreditsUsed={k?.totalCreditsUsed ?? 0}
          totalRevenue={k?.totalRevenue ?? 0}
          totalCards={k?.totalCardholders ?? 0}
        />
      </div>

    </div>
  );
}
