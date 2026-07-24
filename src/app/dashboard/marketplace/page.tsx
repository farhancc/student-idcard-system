'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ui/toast';
import {
  Store, Search, Heart, Flag, Download, ShoppingCart,
  Star, Filter, X, ChevronLeft, ChevronRight,
  CreditCard, CheckCircle, Tag, Zap, Package, AlertTriangle,
} from 'lucide-react';

const CATEGORIES = ['', 'ID_CARD', 'BADGE', 'CERTIFICATE', 'LABEL', 'TICKET', 'VISITOR_PASS', 'LETTER', 'CARD', 'TAG', 'STICKER', 'OTHER'];
const CAT_LABELS: Record<string, string> = {
  '': 'All', ID_CARD: 'ID Card', BADGE: 'Badge', CERTIFICATE: 'Certificate',
  LABEL: 'Label', TICKET: 'Ticket', VISITOR_PASS: 'Visitor Pass',
  LETTER: 'Letter', CARD: 'Card', TAG: 'Tag', STICKER: 'Sticker', OTHER: 'Other',
};

interface Template {
  id: number; name: string; category: string; sides: number;
  price: number; likes: number; reports: number;
  frontImageUrl: string; backImageUrl?: string | null;
  sellerName: string; isOfficial: boolean;
  hasPhoto: boolean; hasQr: boolean; hasBarcode: boolean;
  hasCdr: boolean; hasAi: boolean; hasPsd: boolean; hasPdf: boolean;
  cardWidth: number; cardHeight: number; createdAt: string;
}

export default function MarketplacePage() {
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'browse' | 'my-purchases'>('browse');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  // Filters
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('popular');
  const [priceFilter, setPriceFilter] = useState('');
  const [hasCdr, setHasCdr] = useState(false);
  const [hasAi, setHasAi] = useState(false);
  const [hasPhoto, setHasPhoto] = useState(false);
  const [hasQr, setHasQr] = useState(false);

  // Purchase
  const [purchasing, setPurchasing] = useState<number | null>(null);
  const [purchased, setPurchased] = useState<Set<number>>(new Set());
  const [liking, setLiking] = useState<number | null>(null);

  // My Purchases tab
  const [myPurchases, setMyPurchases] = useState<any[]>([]);
  const [myPurchasesLoading, setMyPurchasesLoading] = useState(false);

  // Credits display
  const [credits, setCredits] = useState<number | null>(null);

  const fetchCredits = async () => {
    try {
      const res = await fetch('/api/press/profile');
      if (res.ok) {
        const d = await res.json();
        setCredits((d.press?.credits ?? 0) + (d.press?.promoCredits ?? 0));
      }
    } catch {}
  };

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page), sort, limit: '20',
        ...(search && { search }),
        ...(category && { category }),
        ...(priceFilter && { price: priceFilter }),
        ...(hasCdr && { has_cdr: '1' }),
        ...(hasAi && { has_ai: '1' }),
        ...(hasPhoto && { has_photo: '1' }),
        ...(hasQr && { has_qr: '1' }),
      });
      const res = await fetch(`/api/marketplace?${params}`);
      const data = await res.json();
      setTemplates(data.templates || []);
      setTotal(data.pagination?.total || 0);
      setPages(data.pagination?.pages || 1);
    } catch {
      toast('Failed to load marketplace', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, sort, search, category, priceFilter, hasCdr, hasAi, hasPhoto, hasQr]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);
  useEffect(() => { fetchCredits(); }, []);

  const fetchMyPurchases = async () => {
    setMyPurchasesLoading(true);
    try {
      const res = await fetch('/api/marketplace/my-purchases');
      const data = await res.json();
      setMyPurchases(data.purchases || []);
    } catch {} finally {
      setMyPurchasesLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'my-purchases') fetchMyPurchases();
  }, [activeTab]);

  const handlePurchase = async (t: Template) => {
    if (purchasing) return;
    setPurchasing(t.id);
    try {
      const res = await fetch('/api/marketplace/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: t.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast(data.message || 'Template added to your library!', 'success');
      setPurchased(prev => new Set([...prev, t.id]));
      fetchCredits();
    } catch (err: any) {
      toast(err.message || 'Purchase failed', 'error');
    } finally {
      setPurchasing(null);
    }
  };

  const handleLike = async (t: Template) => {
    if (liking) return;
    setLiking(t.id);
    try {
      await fetch(`/api/marketplace/like?templateId=${t.id}`, { method: 'POST' });
      setTemplates(prev => prev.map(x => x.id === t.id ? { ...x, likes: x.likes + 1 } : x));
    } finally {
      setLiking(null);
    }
  };

  const handleReport = async (t: Template) => {
    if (!confirm(`Report "${t.name}" for inappropriate content?`)) return;
    await fetch(`/api/marketplace/report?templateId=${t.id}`, { method: 'POST' });
    toast('Report submitted. Thank you.', 'success');
  };

  const handleDownload = (templateId: number, format: string) => {
    window.open(`/api/marketplace/download?templateId=${templateId}&format=${format}`, '_blank');
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '32px 24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Store size={28} color="var(--primary)" /> Template Marketplace
          </h1>
          <p style={{ color: 'var(--muted)', marginTop: '4px', fontSize: '0.9rem' }}>
            Browse, purchase, and use premium ID card templates
          </p>
        </div>
        {credits !== null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '10px', padding: '10px 16px' }}>
            <CreditCard size={16} color="#818cf8" />
            <span style={{ fontWeight: '600', color: '#818cf8' }}>{credits.toLocaleString()}</span>
            <span style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>credits available</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '28px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1px' }}>
        {(['browse', 'my-purchases'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '10px 20px', fontSize: '0.88rem', fontWeight: '500',
            color: activeTab === tab ? 'var(--primary)' : 'var(--muted)',
            borderBottom: activeTab === tab ? '2px solid var(--primary)' : '2px solid transparent',
            transition: 'all 0.2s',
          }}>
            {tab === 'browse' ? '🏪 Browse' : '📦 My Purchases'}
          </button>
        ))}
      </div>

      {activeTab === 'browse' && (
        <>
          {/* Search + Sort bar */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
              <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
              <input
                className="form-input"
                style={{ paddingLeft: '36px' }}
                placeholder="Search templates..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <select className="form-input" style={{ width: '140px' }} value={sort} onChange={e => { setSort(e.target.value); setPage(1); }}>
              <option value="popular">Most Popular</option>
              <option value="newest">Newest</option>
              <option value="price_asc">Price: Low→High</option>
              <option value="price_desc">Price: High→Low</option>
            </select>
            <select className="form-input" style={{ width: '130px' }} value={priceFilter} onChange={e => { setPriceFilter(e.target.value); setPage(1); }}>
              <option value="">All Prices</option>
              <option value="free">Free</option>
              <option value="paid">Paid</option>
            </select>
          </div>

          {/* Category chips */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => { setCategory(c); setPage(1); }} style={{
                padding: '5px 14px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: '500', cursor: 'pointer',
                border: '1px solid ' + (category === c ? 'var(--primary)' : 'var(--glass-border)'),
                background: category === c ? 'rgba(99,102,241,0.15)' : 'transparent',
                color: category === c ? 'var(--primary)' : 'var(--muted)',
                transition: 'all 0.15s',
              }}>{CAT_LABELS[c]}</button>
            ))}
          </div>

          {/* Format filters */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
            {[
              { label: '📸 Photo', val: hasPhoto, set: setHasPhoto },
              { label: '📷 QR Code', val: hasQr, set: setHasQr },
              { label: '📄 CDR', val: hasCdr, set: setHasCdr },
              { label: '🎨 AI', val: hasAi, set: setHasAi },
            ].map(f => (
              <button key={f.label} onClick={() => { f.set(!f.val); setPage(1); }} style={{
                padding: '4px 12px', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer',
                border: '1px solid ' + (f.val ? 'var(--primary)' : 'var(--glass-border)'),
                background: f.val ? 'rgba(99,102,241,0.15)' : 'transparent',
                color: f.val ? 'var(--primary)' : 'var(--muted)',
              }}>{f.label}</button>
            ))}
            <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--muted)', alignSelf: 'center' }}>
              {total} template{total !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Grid */}
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '20px' }}>
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} style={{ borderRadius: '12px', background: 'var(--card-bg)', border: '1px solid var(--glass-border)', overflow: 'hidden', height: '340px', animation: 'pulse 1.5s infinite' }} />
              ))}
            </div>
          ) : templates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--muted)' }}>
              <Store size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
              <p>No templates found. Try adjusting your filters.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '20px' }}>
              {templates.map(t => (
                <TemplateCard
                  key={t.id}
                  template={t}
                  isPurchased={purchased.has(t.id)}
                  isPurchasing={purchasing === t.id}
                  isLiking={liking === t.id}
                  onPurchase={() => handlePurchase(t)}
                  onLike={() => handleLike(t)}
                  onReport={() => handleReport(t)}
                  onDownload={(fmt) => handleDownload(t.id, fmt)}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {pages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '32px', alignItems: 'center' }}>
              <button className="btn btn-secondary" style={{ padding: '8px 12px', minWidth: 'auto' }} disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft size={16} />
              </button>
              <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Page {page} of {pages}</span>
              <button className="btn btn-secondary" style={{ padding: '8px 12px', minWidth: 'auto' }} disabled={page === pages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}

      {activeTab === 'my-purchases' && (
        <div>
          {myPurchasesLoading ? (
            <div style={{ textAlign: 'center', padding: '60px' }}><div className="spinner" /></div>
          ) : myPurchases.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--muted)' }}>
              <Package size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
              <p>You haven&apos;t purchased any templates yet.</p>
              <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={() => setActiveTab('browse')}>Browse Marketplace</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {myPurchases.map(p => (
                <div key={p.id} className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px', borderRadius: '12px' }}>
                  <CheckCircle size={20} color="#10b981" style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>{p.templateName}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '2px' }}>
                      Purchased on {new Date(p.createdAt).toLocaleDateString()} · {p.creditsSpent > 0 ? `${p.creditsSpent} credits` : 'Free'}
                    </div>
                  </div>
                  {p.clonedTemplateId && (
                    <a href={`/dashboard/templates?highlight=${p.clonedTemplateId}`} className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '6px 14px' }}>
                      View in Library
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TemplateCard({ template: t, isPurchased, isPurchasing, isLiking, onPurchase, onLike, onReport, onDownload }: {
  template: Template;
  isPurchased: boolean;
  isPurchasing: boolean;
  isLiking: boolean;
  onPurchase: () => void;
  onLike: () => void;
  onReport: () => void;
  onDownload: (format: string) => void;
}) {
  const [showBack, setShowBack] = useState(false);
  const [showFormats, setShowFormats] = useState(false);

  const formats = [
    { key: 'cdr', label: 'CDR', available: t.hasCdr },
    { key: 'ai', label: 'AI', available: t.hasAi },
    { key: 'psd', label: 'PSD', available: t.hasPsd },
    { key: 'pdf', label: 'PDF', available: t.hasPdf },
  ].filter(f => f.available);

  return (
    <div style={{
      borderRadius: '14px',
      background: 'var(--card-bg)',
      border: '1px solid var(--glass-border)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      transition: 'transform 0.2s, box-shadow 0.2s',
    }} onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 12px 40px rgba(0,0,0,0.3)'; }}
       onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = ''; }}>

      {/* Preview */}
      <div style={{ position: 'relative', aspectRatio: '3/2', background: '#111', overflow: 'hidden' }}>
        <img
          src={showBack && t.backImageUrl ? t.backImageUrl : t.frontImageUrl}
          alt={t.name}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
        {/* Badges */}
        <div style={{ position: 'absolute', top: '8px', left: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {t.isOfficial && (
            <span style={{ background: '#6366f1', color: '#fff', padding: '2px 8px', borderRadius: '20px', fontSize: '0.65rem', fontWeight: '700' }}>OFFICIAL</span>
          )}
          <span style={{ background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '2px 8px', borderRadius: '20px', fontSize: '0.65rem' }}>
            {CAT_LABELS[t.category] || t.category}
          </span>
          {t.sides === 2 && (
            <span style={{ background: 'rgba(99,102,241,0.8)', color: '#fff', padding: '2px 8px', borderRadius: '20px', fontSize: '0.65rem' }}>2-Sided</span>
          )}
        </div>
        {/* Flip button for 2-sided */}
        {t.backImageUrl && (
          <button onClick={() => setShowBack(s => !s)} style={{
            position: 'absolute', bottom: '8px', right: '8px',
            background: 'rgba(0,0,0,0.7)', border: 'none', color: '#fff',
            borderRadius: '6px', padding: '4px 8px', fontSize: '0.68rem', cursor: 'pointer',
          }}>
            {showBack ? '← Front' : 'Back →'}
          </button>
        )}
        {/* Price badge */}
        <div style={{
          position: 'absolute', top: '8px', right: '8px',
          background: t.price === 0 ? 'rgba(16,185,129,0.9)' : 'rgba(245,158,11,0.9)',
          color: '#fff', padding: '3px 10px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: '700',
        }}>
          {t.price === 0 ? 'FREE' : `${t.price} cr`}
        </div>
      </div>

      {/* Info */}
      <div style={{ padding: '14px', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div>
          <div style={{ fontWeight: '600', fontSize: '0.9rem', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>by {t.sellerName}</div>
        </div>

        {/* Field type tags */}
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
          {t.hasPhoto && <span style={tagStyle('#6366f1')}>📸 Photo</span>}
          {t.hasQr && <span style={tagStyle('#06b6d4')}>QR</span>}
          {t.hasBarcode && <span style={tagStyle('#8b5cf6')}>Barcode</span>}
        </div>

        {/* Source format badges */}
        {formats.length > 0 && (
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {formats.map(f => (
              <span key={f.key} style={tagStyle('#374151')}>{f.label}</span>
            ))}
          </div>
        )}

        {/* Likes */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--muted)' }}>
          <Heart size={12} /> {t.likes}
        </div>

        {/* Actions */}
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '7px' }}>
          {isPurchased ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', fontSize: '0.82rem', fontWeight: '600' }}>
              <CheckCircle size={14} /> In Your Library
            </div>
          ) : (
            <button
              className="btn btn-primary"
              style={{ width: '100%', fontSize: '0.82rem', padding: '8px', gap: '6px', justifyContent: 'center' }}
              onClick={onPurchase}
              disabled={isPurchasing}
            >
              {isPurchasing ? <div className="spinner" style={{ width: '14px', height: '14px' }} /> : <ShoppingCart size={13} />}
              {isPurchasing ? 'Processing...' : t.price === 0 ? 'Add to Library' : `Buy · ${t.price} cr`}
            </button>
          )}

          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={onLike}
              disabled={isLiking}
              style={{ flex: 1, padding: '6px', background: 'transparent', border: '1px solid var(--glass-border)', borderRadius: '8px', cursor: 'pointer', color: 'var(--muted)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
            >
              <Heart size={12} /> Like
            </button>
            {formats.length > 0 && isPurchased && (
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowFormats(s => !s)}
                  style={{ padding: '6px 10px', background: 'transparent', border: '1px solid var(--glass-border)', borderRadius: '8px', cursor: 'pointer', color: 'var(--muted)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Download size={12} /> Files
                </button>
                {showFormats && (
                  <div style={{ position: 'absolute', bottom: '36px', right: 0, background: 'var(--card-bg)', border: '1px solid var(--glass-border)', borderRadius: '10px', padding: '8px', zIndex: 10, display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '80px' }}>
                    {formats.map(f => (
                      <button key={f.key} onClick={() => { onDownload(f.key); setShowFormats(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px 10px', borderRadius: '6px', fontSize: '0.78rem', color: 'var(--text)', textAlign: 'left' }}>
                        ↓ {f.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <button
              onClick={onReport}
              style={{ padding: '6px', background: 'transparent', border: '1px solid var(--glass-border)', borderRadius: '8px', cursor: 'pointer', color: 'var(--muted)' }}
              title="Report this template"
            >
              <Flag size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function tagStyle(bg: string): React.CSSProperties {
  return {
    background: bg + '33',
    color: bg,
    border: `1px solid ${bg}55`,
    borderRadius: '4px',
    padding: '1px 7px',
    fontSize: '0.65rem',
    fontWeight: '600',
  };
}
