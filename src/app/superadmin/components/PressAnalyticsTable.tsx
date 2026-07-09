'use client';
import React, { useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, CreditCard, Printer, DollarSign } from 'lucide-react';

interface PressStat {
  id: number; name: string; plan: string; isActive: boolean;
  currentCredits: number; creditsUsed: number;
  cards: number; revenue: number;
  monthlyCredits: Record<string, number>;
  monthlyCards: Record<string, number>;
  monthlyRevenue: Record<string, number>;
}

// tiny inline SVG sparkline
function Spark({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1);
  const W = 72; const H = 22;
  if (data.length < 2) return <span style={{ color: '#475569', fontSize: '0.7rem' }}>—</span>;
  const pts = data.map((v, i) =>
    `${(i / (data.length - 1)) * W},${H - (v / max) * H}`
  ).join(' ');
  return (
    <svg width={W} height={H} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
    </svg>
  );
}

// 6 tiny month bars
function MonthBars({ data, color }: { data: Record<string, number>; color: string }) {
  const vals = Object.values(data);
  const max = Math.max(...vals, 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 28, width: 72 }}>
      {vals.map((v, i) => (
        <div key={i} style={{
          flex: 1, background: color, borderRadius: '2px 2px 0 0',
          height: `${Math.max((v / max) * 100, 4)}%`, opacity: 0.7,
          boxShadow: v > 0 ? `0 0 4px ${color}` : 'none',
        }} />
      ))}
    </div>
  );
}

const planColor: Record<string, string> = {
  ENTERPRISE: '#818cf8', PRO: '#34d399', BASIC: '#60a5fa', TRIAL: '#fbbf24'
};

type SortKey = 'creditsUsed' | 'cards' | 'revenue' | 'currentCredits' | 'name';

export default function PressAnalyticsTable({
  pressStats, monthKeys, totalCreditsUsed, totalRevenue, totalCards,
}: {
  pressStats: PressStat[];
  monthKeys: string[];
  totalCreditsUsed: number;
  totalRevenue: number;
  totalCards: number;
}) {
  const [sortKey, setSortKey] = useState<SortKey>('creditsUsed');
  const [sortAsc, setSortAsc] = useState(false);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);

  const toggle = (key: SortKey) => {
    if (sortKey === key) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(false); }
  };

  const filtered = pressStats
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const va = sortKey === 'name' ? a.name : (a as any)[sortKey];
      const vb = sortKey === 'name' ? b.name : (b as any)[sortKey];
      if (typeof va === 'string') return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortAsc ? va - vb : vb - va;
    });

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k
      ? sortAsc ? <ChevronUp size={11} /> : <ChevronDown size={11} />
      : <ChevronDown size={11} style={{ opacity: 0.3 }} />;

  const shortMonth = (k: string) => {
    const [, m] = k.split('-');
    return new Date(0, parseInt(m) - 1).toLocaleString('default', { month: 'short' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Platform totals banner ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        {[
          { icon: <CreditCard size={16} />, label: 'Total Credits Used (Platform)', value: totalCreditsUsed.toLocaleString(), color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
          { icon: <Printer size={16} />, label: 'Total Cards Printed (Platform)', value: totalCards.toLocaleString(), color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
          { icon: <DollarSign size={16} />, label: 'Total Revenue (Platform)', value: `Rs. ${totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
        ].map(item => (
          <div key={item.label} style={{ background: item.bg, border: `1px solid ${item.color}25`, borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ color: item.color }}>{item.icon}</span>
            <div>
              <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#f1f5f9' }}>{item.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Search ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8 }}>
        <TrendingUp size={14} color="#475569" />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Filter by press name…"
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#f1f5f9', fontSize: '0.85rem' }}
        />
        {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '0.8rem' }}>✕</button>}
      </div>

      {/* ── Table ── */}
      <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
              {([
                ['name', 'Press', '#f1f5f9'],
                ['currentCredits', 'Credits Left', '#a78bfa'],
                ['creditsUsed', 'Credits Used', '#a78bfa'],
                ['cards', 'Cards Printed', '#8b5cf6'],
                ['revenue', 'Revenue', '#f59e0b'],
              ] as [SortKey, string, string][]).map(([k, label, c]) => (
                <th key={k}
                  onClick={() => toggle(k)}
                  style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.68rem', fontWeight: 700, color: c, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{label} <SortIcon k={k} /></span>
                </th>
              ))}
              <th style={{ padding: '10px 14px', fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>6-Mo Trend</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => {
              const isExp = expanded === p.id;
              const credVals = Object.values(p.monthlyCredits);
              const cardVals = Object.values(p.monthlyCards);
              const revVals = Object.values(p.monthlyRevenue);
              return (
                <React.Fragment key={p.id}>
                  <tr
                    onClick={() => setExpanded(isExp ? null : p.id)}
                    style={{ cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,0.02)'}
                    onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}
                  >
                    <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 30, height: 30, borderRadius: 8, background: `linear-gradient(135deg, ${planColor[p.plan] ?? '#6366f1'}, #0d1424)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: '#f1f5f9' }}>{p.name}</div>
                          <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                            <span style={{ fontSize: '0.6rem', padding: '1px 5px', borderRadius: 4, background: `${planColor[p.plan] ?? '#818cf8'}20`, color: planColor[p.plan] ?? '#818cf8', border: `1px solid ${planColor[p.plan] ?? '#818cf8'}30`, fontWeight: 700 }}>{p.plan}</span>
                            <span style={{ fontSize: '0.6rem', padding: '1px 5px', borderRadius: 4, background: p.isActive ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', color: p.isActive ? '#34d399' : '#f87171', fontWeight: 700 }}>{p.isActive ? 'Active' : 'Suspended'}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px', verticalAlign: 'middle', fontWeight: 700, color: '#a78bfa' }}>
                      {p.currentCredits.toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                      <div style={{ fontWeight: 700, color: p.creditsUsed > 0 ? '#f87171' : '#475569' }}>
                        {p.creditsUsed.toLocaleString()}
                      </div>
                      {totalCreditsUsed > 0 && (
                        <div style={{ fontSize: '0.65rem', color: '#475569', marginTop: 2 }}>
                          {((p.creditsUsed / totalCreditsUsed) * 100).toFixed(1)}% of total
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                      <div style={{ fontWeight: 700, color: '#8b5cf6' }}>{p.cards.toLocaleString()}</div>
                      {totalCards > 0 && (
                        <div style={{ fontSize: '0.65rem', color: '#475569', marginTop: 2 }}>
                          {((p.cards / totalCards) * 100).toFixed(1)}% of total
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                      <div style={{ fontWeight: 700, color: '#f59e0b' }}>
                        Rs. {p.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </div>
                      {totalRevenue > 0 && (
                        <div style={{ fontSize: '0.65rem', color: '#475569', marginTop: 2 }}>
                          {((p.revenue / totalRevenue) * 100).toFixed(1)}% of total
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <Spark data={credVals} color="#a78bfa" />
                        <span style={{ color: '#334155', fontSize: '0.6rem' }}>|</span>
                        <Spark data={cardVals} color="#8b5cf6" />
                        <span style={{ color: '#334155', fontSize: '0.6rem' }}>|</span>
                        <Spark data={revVals} color="#f59e0b" />
                        <span style={{ color: '#475569', marginLeft: 4 }}>{isExp ? <ChevronUp size={12} /> : <ChevronDown size={12} />}</span>
                      </div>
                    </td>
                  </tr>

                  {/* ── Expanded monthly detail row ── */}
                  {isExp && (
                    <tr>
                      <td colSpan={6} style={{ padding: 0 }}>
                        <div style={{ background: 'rgba(99,102,241,0.04)', borderTop: '1px solid rgba(99,102,241,0.15)', padding: '16px 20px' }}>
                          <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                            Monthly Breakdown — last 6 months
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>

                            {/* Credits by month */}
                            <div>
                              <div style={{ fontSize: '0.7rem', color: '#a78bfa', fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <CreditCard size={11} /> Credits Used
                              </div>
                              <div style={{ display: 'flex', gap: 6 }}>
                                {monthKeys.map((k) => (
                                  <div key={k} style={{ flex: 1, textAlign: 'center' }}>
                                    <MonthBars data={{ [k]: p.monthlyCredits[k] ?? 0 }} color="#a78bfa" />
                                    <div style={{ fontSize: '0.6rem', color: '#475569', marginTop: 3 }}>{shortMonth(k)}</div>
                                    <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#a78bfa' }}>{(p.monthlyCredits[k] ?? 0).toLocaleString()}</div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Cards by month */}
                            <div>
                              <div style={{ fontSize: '0.7rem', color: '#8b5cf6', fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Printer size={11} /> Cards Printed
                              </div>
                              <div style={{ display: 'flex', gap: 6 }}>
                                {monthKeys.map((k) => (
                                  <div key={k} style={{ flex: 1, textAlign: 'center' }}>
                                    <MonthBars data={{ [k]: p.monthlyCards[k] ?? 0 }} color="#8b5cf6" />
                                    <div style={{ fontSize: '0.6rem', color: '#475569', marginTop: 3 }}>{shortMonth(k)}</div>
                                    <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#8b5cf6' }}>{(p.monthlyCards[k] ?? 0).toLocaleString()}</div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Revenue by month */}
                            <div>
                              <div style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <DollarSign size={11} /> Revenue
                              </div>
                              <div style={{ display: 'flex', gap: 6 }}>
                                {monthKeys.map((k) => (
                                  <div key={k} style={{ flex: 1, textAlign: 'center' }}>
                                    <MonthBars data={{ [k]: p.monthlyRevenue[k] ?? 0 }} color="#f59e0b" />
                                    <div style={{ fontSize: '0.6rem', color: '#475569', marginTop: 3 }}>{shortMonth(k)}</div>
                                    <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#f59e0b' }}>
                                      {(p.monthlyRevenue[k] ?? 0) > 0 ? `${(p.monthlyRevenue[k] ?? 0).toFixed(0)}` : '0'}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#475569' }}>No presses match your filter.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
