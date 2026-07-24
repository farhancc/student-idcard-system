'use client';

import React, { useState, useEffect } from 'react';
import {
  Store, Shield, Eye, EyeOff, Trash2, AlertTriangle,
  Search, Filter, RefreshCw, Heart, Flag, Tag,
} from 'lucide-react';

interface MktTemplate {
  id: number; name: string; category: string; sides: number;
  price: number; likes: number; reports: number;
  isModerated: boolean; isPublic: boolean;
  frontImageUrl: string;
  press: { id: number; name: string; email: string } | null;
  createdAt: string;
}

export default function SuperAdminMarketplacePage() {
  const [templates, setTemplates] = useState<MktTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'reported' | 'moderated'>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [acting, setActing] = useState<number | null>(null);

  // Settings
  const [listingFee, setListingFee] = useState('0');
  const [savingFee, setSavingFee] = useState(false);
  const [feeMsg, setFeeMsg] = useState('');

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/superadmin/marketplace?filter=${filter}&page=${page}`);
      const data = await res.json();
      let items: MktTemplate[] = data.templates || [];
      if (search) items = items.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));
      setTemplates(items);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/superadmin/settings');
      const data = await res.json();
      setListingFee(String(data.settings?.marketplaceListingFee ?? data.settings?.marketplace_listing_fee ?? 0));
    } catch {}
  };

  useEffect(() => { fetchTemplates(); }, [filter, page]);
  useEffect(() => { fetchSettings(); }, []);

  const handleAction = async (id: number, action: 'hide' | 'unhide' | 'delete') => {
    if (action === 'delete' && !confirm('Permanently delete this template from the marketplace?')) return;
    setActing(id);
    try {
      const res = await fetch('/api/superadmin/marketplace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: id, action }),
      });
      if (res.ok) fetchTemplates();
    } finally {
      setActing(null);
    }
  };

  const saveListingFee = async () => {
    setSavingFee(true); setFeeMsg('');
    try {
      const currentRes = await fetch('/api/superadmin/settings');
      const current = (await currentRes.json()).settings || {};
      await fetch('/api/superadmin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...current, marketplaceListingFee: Number(listingFee) }),
      });
      setFeeMsg('Saved!');
    } catch { setFeeMsg('Failed to save'); }
    finally { setSavingFee(false); }
  };

  const CAT_LABELS: Record<string, string> = { ID_CARD: 'ID Card', BADGE: 'Badge', CERTIFICATE: 'Cert', LABEL: 'Label', OTHER: 'Other' };

  return (
    <div style={{ padding: '32px 24px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: '700', margin: '0 0 28px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Store size={24} color="var(--primary)" /> Marketplace Moderation
      </h1>

      {/* Settings panel */}
      <div className="glass-panel" style={{ padding: '20px', borderRadius: '12px', marginBottom: '28px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <Shield size={18} color="#f59e0b" />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: '600', fontSize: '0.9rem', marginBottom: '4px' }}>Marketplace Listing Fee</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>Credits deducted from sellers to list a template. Set to 0 for free listing.</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input type="number" min="0" className="form-input" style={{ width: '100px' }} value={listingFee} onChange={e => setListingFee(e.target.value)} />
          <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>credits</span>
          <button className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.82rem' }} onClick={saveListingFee} disabled={savingFee}>
            {savingFee ? 'Saving...' : 'Save'}
          </button>
          {feeMsg && <span style={{ color: feeMsg === 'Saved!' ? '#10b981' : '#ef4444', fontSize: '0.8rem' }}>{feeMsg}</span>}
        </div>
      </div>

      {/* Filter tabs + search */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        {(['all', 'reported', 'moderated'] as const).map(f => (
          <button key={f} onClick={() => { setFilter(f); setPage(1); }} style={{
            padding: '6px 16px', borderRadius: '8px', fontSize: '0.82rem', cursor: 'pointer',
            border: '1px solid ' + (filter === f ? 'var(--primary)' : 'var(--glass-border)'),
            background: filter === f ? 'rgba(99,102,241,0.15)' : 'transparent',
            color: filter === f ? 'var(--primary)' : 'var(--muted)',
          }}>
            {f === 'all' ? `All (${total})` : f === 'reported' ? '🚩 Reported' : '🚫 Hidden'}
          </button>
        ))}
        <input
          className="form-input"
          style={{ marginLeft: 'auto', width: '200px' }}
          placeholder="Search by name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button className="btn btn-secondary" style={{ padding: '8px', minWidth: 'auto' }} onClick={fetchTemplates}>
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px' }}><div className="spinner" /></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {templates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--muted)' }}>No templates in this category.</div>
          ) : templates.map(t => (
            <div key={t.id} className="glass-panel" style={{
              padding: '14px 18px', borderRadius: '10px',
              display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap',
              opacity: t.isModerated ? 0.6 : 1,
              border: t.reports > 5 ? '1px solid rgba(239,68,68,0.4)' : '1px solid var(--glass-border)',
            }}>
              <img src={t.frontImageUrl} alt={t.name} style={{ width: '56px', height: '40px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: '160px' }}>
                <div style={{ fontWeight: '600', fontSize: '0.88rem' }}>{t.name}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                  {CAT_LABELS[t.category] || t.category} · {t.sides}-sided · by {t.press?.name ?? 'IDexo Official'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '16px', fontSize: '0.8rem', color: 'var(--muted)', flexShrink: 0 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Heart size={13} /> {t.likes}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: t.reports > 0 ? '#ef4444' : undefined }}>
                  <Flag size={13} /> {t.reports}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Tag size={13} /> {t.price === 0 ? 'Free' : `${t.price} cr`}</span>
              </div>
              {t.isModerated && (
                <span style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', padding: '2px 10px', fontSize: '0.72rem', fontWeight: '600' }}>HIDDEN</span>
              )}
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                {t.isModerated ? (
                  <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '6px 12px', gap: '5px' }}
                    disabled={acting === t.id} onClick={() => handleAction(t.id, 'unhide')}>
                    <Eye size={13} /> Unhide
                  </button>
                ) : (
                  <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '6px 12px', gap: '5px', background: 'rgba(245,158,11,0.1)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)' }}
                    disabled={acting === t.id} onClick={() => handleAction(t.id, 'hide')}>
                    <EyeOff size={13} /> Hide
                  </button>
                )}
                <button className="btn btn-danger" style={{ fontSize: '0.75rem', padding: '6px 12px', gap: '5px' }}
                  disabled={acting === t.id} onClick={() => handleAction(t.id, 'delete')}>
                  <Trash2 size={13} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '24px' }}>
          <button className="btn btn-secondary" disabled={page === 1} onClick={() => setPage(p => p - 1)}>←</button>
          <span style={{ padding: '8px 16px', fontSize: '0.85rem', color: 'var(--muted)' }}>Page {page} of {pages}</span>
          <button className="btn btn-secondary" disabled={page === pages} onClick={() => setPage(p => p + 1)}>→</button>
        </div>
      )}
    </div>
  );
}
