'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Shield, Search, Filter, RefreshCw, ChevronLeft, ChevronRight, AlertTriangle, Info, Zap } from 'lucide-react';

const CATEGORIES = ['', 'TEMPLATE', 'SECURITY', 'BILLING', 'USER', 'PORTAL', 'ORDER', 'SYSTEM'];
const SEVERITIES = ['', 'INFO', 'WARN', 'CRITICAL'];

const severityStyles: Record<string, { bg: string; color: string; label: string; icon: React.ReactNode }> = {
  INFO:     { bg: 'rgba(59,130,246,0.12)', color: '#60a5fa', label: 'Info',     icon: <Info size={12} /> },
  WARN:     { bg: 'rgba(234,179,8,0.15)',  color: '#fbbf24', label: 'Warning',  icon: <AlertTriangle size={12} /> },
  CRITICAL: { bg: 'rgba(239,68,68,0.18)', color: '#f87171', label: 'Critical', icon: <Zap size={12} /> },
};

const categoryColor: Record<string, string> = {
  TEMPLATE: '#818cf8',
  SECURITY: '#f87171',
  BILLING:  '#34d399',
  USER:     '#60a5fa',
  PORTAL:   '#a78bfa',
  ORDER:    '#fbbf24',
  SYSTEM:   '#94a3b8',
};

function SeverityBadge({ severity }: { severity: string }) {
  const s = severityStyles[severity] || severityStyles.INFO;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      background: s.bg, color: s.color,
      padding: '2px 8px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 600,
    }}>
      {s.icon} {s.label}
    </span>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const color = categoryColor[category] || '#94a3b8';
  return (
    <span style={{
      background: `${color}18`, color, border: `1px solid ${color}40`,
      padding: '2px 8px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 600,
    }}>
      {category}
    </span>
  );
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [severity, setSeverity] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '50',
        ...(search && { search }),
        ...(category && { category }),
        ...(severity && { severity }),
      });
      const res = await fetch(`/api/audit-logs?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setLogs(json.logs || []);
      setTotal(json.total || 0);
      setTotalPages(json.totalPages || 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search, category, severity]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const handleSearchKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { setPage(1); fetchLogs(); }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <div style={{
          width: '44px', height: '44px', borderRadius: '12px',
          background: 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(239,68,68,0.05))',
          border: '1px solid rgba(239,68,68,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Shield size={22} color="#f87171" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700 }}>System Audit Log</h1>
          <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--muted)' }}>
            Immutable record of all administrative actions, configuration changes, and security events.
          </p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px' }}>
          <span style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)',
            padding: '6px 14px', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--muted)',
          }}>
            {total.toLocaleString()} total records
          </span>
          <button
            onClick={() => { setPage(1); fetchLogs(); }}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)',
              padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', color: 'var(--text)',
              fontSize: '0.8rem',
            }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-panel" style={{ padding: '14px 16px', marginBottom: '16px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <Filter size={14} color="var(--muted)" />
        <div style={{ position: 'relative', flex: '1 1 260px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
          <input
            type="text"
            className="form-input"
            placeholder="Search by action, actor, or description…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={handleSearchKey}
            style={{ paddingLeft: '32px', height: '36px', fontSize: '0.82rem' }}
          />
        </div>

        <select
          className="form-input"
          value={category}
          onChange={e => { setCategory(e.target.value); setPage(1); }}
          style={{ width: 'auto', minWidth: '130px', height: '36px', fontSize: '0.82rem' }}
        >
          <option value="">All Categories</option>
          {CATEGORIES.filter(Boolean).map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select
          className="form-input"
          value={severity}
          onChange={e => { setSeverity(e.target.value); setPage(1); }}
          style={{ width: 'auto', minWidth: '120px', height: '36px', fontSize: '0.82rem' }}
        >
          <option value="">All Severities</option>
          {SEVERITIES.filter(Boolean).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--muted)' }}>
            <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} />
            <div style={{ marginTop: '8px' }}>Loading audit records…</div>
          </div>
        ) : logs.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--muted)' }}>
            <Shield size={32} style={{ marginBottom: '12px', opacity: 0.3 }} />
            <div>No audit records found.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.02)' }}>
                  {['Timestamp', 'Severity', 'Category', 'Action', 'Actor', 'Description', 'IP Address'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log: any) => (
                  <React.Fragment key={log.id}>
                    <tr
                      onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        cursor: 'pointer',
                        background: expandedId === log.id ? 'rgba(255,255,255,0.03)' : 'transparent',
                        transition: 'background 0.15s',
                      }}
                    >
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: 'var(--muted)', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <SeverityBadge severity={log.severity} />
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <CategoryBadge category={log.category} />
                      </td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: '0.75rem', color: '#a5b4fc' }}>
                        {log.action}
                      </td>
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.8rem' }}>{log.actorName}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{log.actorType}</div>
                      </td>
                      <td style={{ padding: '10px 14px', maxWidth: '360px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {log.description}
                      </td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--muted)' }}>
                        {log.ipAddress}
                      </td>
                    </tr>
                    {expandedId === log.id && (
                      <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--glass-border)' }}>
                        <td colSpan={7} style={{ padding: '12px 20px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                            {log.resourceType && (
                              <div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginBottom: '4px' }}>RESOURCE</div>
                                <div style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{log.resourceType} #{log.resourceId}</div>
                              </div>
                            )}
                            {log.oldValue && (
                              <div>
                                <div style={{ fontSize: '0.7rem', color: '#fbbf24', marginBottom: '4px' }}>BEFORE</div>
                                <pre style={{ margin: 0, fontFamily: 'monospace', fontSize: '0.72rem', background: 'rgba(234,179,8,0.05)', padding: '6px 8px', borderRadius: '6px', overflowX: 'auto', color: '#fbbf24' }}>
                                  {JSON.stringify(JSON.parse(log.oldValue), null, 2)}
                                </pre>
                              </div>
                            )}
                            {log.newValue && (
                              <div>
                                <div style={{ fontSize: '0.7rem', color: '#34d399', marginBottom: '4px' }}>AFTER</div>
                                <pre style={{ margin: 0, fontFamily: 'monospace', fontSize: '0.72rem', background: 'rgba(52,211,153,0.05)', padding: '6px 8px', borderRadius: '6px', overflowX: 'auto', color: '#34d399' }}>
                                  {JSON.stringify(JSON.parse(log.newValue), null, 2)}
                                </pre>
                              </div>
                            )}
                            {log.userAgent && (
                              <div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginBottom: '4px' }}>USER AGENT</div>
                                <div style={{ fontSize: '0.72rem', wordBreak: 'break-all', color: 'var(--muted)' }}>{log.userAgent}</div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', marginTop: '16px' }}>
          <button
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '6px 14px', borderRadius: '8px', cursor: page <= 1 ? 'not-allowed' : 'pointer',
              opacity: page <= 1 ? 0.4 : 1,
              background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'var(--text)',
            }}
          >
            <ChevronLeft size={14} /> Previous
          </button>
          <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '6px 14px', borderRadius: '8px', cursor: page >= totalPages ? 'not-allowed' : 'pointer',
              opacity: page >= totalPages ? 0.4 : 1,
              background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'var(--text)',
            }}
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        tr:hover td { background: rgba(255,255,255,0.02); }
      `}</style>
    </div>
  );
}
