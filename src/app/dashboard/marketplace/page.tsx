'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import CardPreview from '@/app/components/CardPreview';
import { useToast } from '@/components/ui/toast';
import {
  Store, Search, Heart, Flag, Download, ShoppingCart,
  Star, Filter, X, ChevronLeft, ChevronRight,
  CreditCard, CheckCircle, Tag, Zap, Package, AlertTriangle,
  Eye, Layers, FileText, QrCode, Barcode, Image as ImageIcon, Maximize2, Edit3,
} from 'lucide-react';

const CATEGORIES = ['', 'ID_CARD', 'BADGE', 'CERTIFICATE', 'LABEL', 'TICKET', 'VISITOR_PASS', 'LETTER', 'CARD', 'TAG', 'STICKER', 'OTHER'];
const CAT_LABELS: Record<string, string> = {
  '': 'All', ID_CARD: 'ID Card', BADGE: 'Badge', CERTIFICATE: 'Certificate',
  LABEL: 'Label', TICKET: 'Ticket', VISITOR_PASS: 'Visitor Pass',
  LETTER: 'Letter', CARD: 'Card', TAG: 'Tag', STICKER: 'Sticker', OTHER: 'Other',
};

interface TemplateField {
  key: string;
  name?: string;
  label: string;
  type: string;
  side: 'Front' | 'Back';
  prefix?: string;
  suffix?: string;
  sampleValue?: string;
}

interface Template {
  id: number; name: string; category: string; sides: number;
  price: number; likes: number; reports: number;
  frontImageUrl: string; backImageUrl?: string | null;
  frontFields?: string | null; backFields?: string | null;
  sellerName: string; isOfficial: boolean;
  hasPhoto: boolean; hasQr: boolean; hasBarcode: boolean;
  hasCdr: boolean; hasAi: boolean; hasPsd: boolean; hasPdf: boolean;
  cardWidth: number; cardHeight: number; createdAt: string;
  fieldsSummary?: TemplateField[];
  isLiked?: boolean;
  isReported?: boolean;
  isPurchased?: boolean;
  pressId?: number | null;
}

export default function MarketplacePage() {
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'browse' | 'my-purchases'>('browse');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  // Like & Report tracking per press
  const [likedSet, setLikedSet] = useState<Set<number>>(new Set());
  const [reportedSet, setReportedSet] = useState<Set<number>>(new Set());

  // Filters
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('popular');
  const [priceFilter, setPriceFilter] = useState('');
  const [hasCdr, setHasCdr] = useState(false);
  const [hasAi, setHasAi] = useState(false);
  const [hasPhoto, setHasPhoto] = useState(false);
  const [hasQr, setHasQr] = useState(false);

  // Purchase & Modal
  const [purchasing, setPurchasing] = useState<number | null>(null);
  const [purchased, setPurchased] = useState<Set<number>>(new Set());
  const [liking, setLiking] = useState<number | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);

  // My Purchases tab
  const [myPurchases, setMyPurchases] = useState<any[]>([]);
  const [myPurchasesLoading, setMyPurchasesLoading] = useState(false);

  // Credits display
  const [paidCredits, setPaidCredits] = useState<number | null>(null);
  const [promoCredits, setPromoCredits] = useState<number | null>(null);
  const [currentPressId, setCurrentPressId] = useState<number | null>(null);

  const fetchCredits = async () => {
    try {
      const res = await fetch('/api/press/profile');
      if (res.ok) {
        const d = await res.json();
        setPaidCredits(d.press?.credits ?? 0);
        setPromoCredits(d.press?.promoCredits ?? 0);
        setCurrentPressId(d.press?.id ? Number(d.press.id) : null);
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
      if (!res.ok) {
        console.error('[Marketplace] API error:', res.status, data);
        toast(`Marketplace error (${res.status}): ${data?.error || 'Unknown error'}`, 'error');
        setTemplates([]);
        return;
      }
      const fetched: Template[] = data.templates || [];
      console.log('[Marketplace] Loaded', fetched.length, 'templates, total:', data.pagination?.total);
      setTemplates(fetched);
      setTotal(data.pagination?.total || 0);
      setPages(data.pagination?.pages || 1);

      setLikedSet(new Set(fetched.filter(t => t.isLiked).map(t => t.id)));
      setReportedSet(new Set(fetched.filter(t => t.isReported).map(t => t.id)));
      setPurchased(new Set(fetched.filter(t => t.isPurchased).map(t => t.id)));
    } catch (err: any) {
      console.error('[Marketplace] Fetch exception:', err);
      toast('Failed to load marketplace: ' + (err?.message || 'Network error'), 'error');
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
    if (t.price > 0 && (paidCredits ?? 0) < t.price) {
      if ((promoCredits ?? 0) > 0) {
        toast(`Signup bonus & promo credits cannot be used to buy marketplace templates. You need ${t.price} paid credits (Available: ${paidCredits ?? 0}).`, 'error');
        return;
      }
    }
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
      const res = await fetch(`/api/marketplace/like?templateId=${t.id}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update like status');

      const isNowLiked = data.liked;
      const newLikesCount = data.likes;

      setLikedSet(prev => {
        const next = new Set(prev);
        if (isNowLiked) next.add(t.id);
        else next.delete(t.id);
        return next;
      });

      setTemplates(prev => prev.map(x => x.id === t.id ? { ...x, likes: newLikesCount, isLiked: isNowLiked } : x));
      if (selectedTemplate && selectedTemplate.id === t.id) {
        setSelectedTemplate(prev => prev ? { ...prev, likes: newLikesCount, isLiked: isNowLiked } : null);
      }
    } catch (err: any) {
      toast(err.message || 'Error updating like status', 'error');
    } finally {
      setLiking(null);
    }
  };

  const handleReport = async (t: Template) => {
    if (reportedSet.has(t.id)) {
      toast('You have already reported this template.', 'info');
      return;
    }
    if (!confirm(`Report "${t.name}" for inappropriate content?`)) return;
    try {
      const res = await fetch(`/api/marketplace/report?templateId=${t.id}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        if (data.alreadyReported) {
          setReportedSet(prev => new Set([...prev, t.id]));
        }
        throw new Error(data.error || 'Report submission failed');
      }
      setReportedSet(prev => new Set([...prev, t.id]));
      setTemplates(prev => prev.map(x => x.id === t.id ? { ...x, isReported: true, reports: (x.reports || 0) + 1 } : x));
      if (selectedTemplate && selectedTemplate.id === t.id) {
        setSelectedTemplate(prev => prev ? { ...prev, isReported: true, reports: (prev.reports || 0) + 1 } : null);
      }
      toast('Report submitted. Thank you.', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to submit report', 'error');
    }
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
            Browse, preview front/back sides, check fields, and purchase premium templates
          </p>
        </div>
        {paidCredits !== null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '10px', padding: '10px 16px' }}>
              <CreditCard size={16} color="#818cf8" />
              <span style={{ fontWeight: '600', color: '#818cf8' }}>{paidCredits.toLocaleString()}</span>
              <span style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>paid credits</span>
            </div>
            {(promoCredits ?? 0) > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '10px', padding: '10px 14px' }}>
                <Zap size={14} color="#10b981" />
                <span style={{ fontWeight: '600', color: '#34d399' }}>{promoCredits?.toLocaleString()}</span>
                <span style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>bonus credits (print only)</span>
              </div>
            )}
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

          {/* Info banner: all visible templates are own listings */}
          {!loading && templates.length > 0 && templates.every(t => t.pressId === currentPressId) && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '14px 18px',
              background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)',
              borderRadius: '10px', marginBottom: '20px',
            }}>
              <Store size={18} color="#818cf8" style={{ flexShrink: 0, marginTop: '1px' }} />
              <div style={{ fontSize: '0.83rem', color: 'var(--muted)', lineHeight: '1.5' }}>
                <span style={{ color: '#c7d2fe', fontWeight: '600' }}>All current listings are yours.</span>
                {' '}You can click <strong style={{ color: '#10b981' }}>View in My Library</strong> to edit or use them.
                {' '}Once other presses publish templates, the <strong style={{ color: '#818cf8' }}>Buy</strong> button will be available for templates from other sellers.
              </div>
            </div>
          )}

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
                  isLiked={likedSet.has(t.id)}
                  isReported={reportedSet.has(t.id)}
                  isOwnTemplate={t.pressId !== null && t.pressId === currentPressId}
                  onSelect={() => setSelectedTemplate(t)}
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

      {/* Template Detail Modal */}
      {selectedTemplate && (
        <ModalErrorBoundary onClose={() => setSelectedTemplate(null)}>
          <TemplateDetailModal
            template={selectedTemplate}
            isPurchased={purchased.has(selectedTemplate.id)}
            isPurchasing={purchasing === selectedTemplate.id}
            isLiking={liking === selectedTemplate.id}
            isLiked={likedSet.has(selectedTemplate.id)}
            isReported={reportedSet.has(selectedTemplate.id)}
            isOwnTemplate={selectedTemplate.pressId !== null && selectedTemplate.pressId === currentPressId}
            onClose={() => setSelectedTemplate(null)}
            onPurchase={() => handlePurchase(selectedTemplate)}
            onLike={() => handleLike(selectedTemplate)}
            onReport={() => handleReport(selectedTemplate)}
            onDownload={(fmt) => handleDownload(selectedTemplate.id, fmt)}
          />
        </ModalErrorBoundary>
      )}

    </div>
  );
}

function TemplateCard({ template: t, isPurchased, isPurchasing, isLiking, isLiked = false, isReported = false, isOwnTemplate = false, onSelect, onPurchase, onLike, onReport, onDownload }: {
  template: Template;
  isPurchased: boolean;
  isPurchasing: boolean;
  isLiking: boolean;
  isLiked?: boolean;
  isReported?: boolean;
  isOwnTemplate?: boolean;
  onSelect: () => void;
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
      cursor: 'pointer',
      transition: 'transform 0.2s, box-shadow 0.2s',
    }}
      onClick={onSelect}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 12px 40px rgba(0,0,0,0.3)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = ''; }}>

      {/* Preview — use real card aspect ratio so portrait cards aren't cropped */}
      <div style={{ position: 'relative', aspectRatio: `${t.cardWidth || 673}/${t.cardHeight || 1039}`, background: '#111', overflow: 'hidden' }}>
        <img
          src={showBack && t.backImageUrl ? t.backImageUrl : t.frontImageUrl}
          alt={t.name}
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        />
        {/* Badges */}
        <div style={{ position: 'absolute', top: '8px', left: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {t.isOfficial && (
            <span style={{ background: '#6366f1', color: '#fff', padding: '2px 8px', borderRadius: '20px', fontSize: '0.65rem', fontWeight: '700' }}>OFFICIAL</span>
          )}
          {isOwnTemplate && (
            <span style={{ background: '#10b981', color: '#fff', padding: '2px 8px', borderRadius: '20px', fontSize: '0.65rem', fontWeight: '700' }}>YOUR LISTING</span>
          )}
          <span style={{ background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '2px 8px', borderRadius: '20px', fontSize: '0.65rem' }}>
            {CAT_LABELS[t.category] || t.category}
          </span>
          {t.sides === 2 && (
            <span style={{ background: 'rgba(99,102,241,0.8)', color: '#fff', padding: '2px 8px', borderRadius: '20px', fontSize: '0.65rem' }}>2-Sided</span>
          )}
        </div>
        {/* Flip button for 2-sided */}
        {(t.backImageUrl || t.sides === 2 || (t.backFields && t.backFields !== '[]')) && (
          <button onClick={(e) => { e.stopPropagation(); setShowBack(s => !s); }} style={{
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
          {t.fieldsSummary && t.fieldsSummary.length > 0 && (
            <span style={tagStyle('#10b981')}>{t.fieldsSummary.length} Fields</span>
          )}
        </div>

        {/* Source format badges */}
        {formats.length > 0 && (
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {formats.map(f => (
              <span key={f.key} style={tagStyle('#374151')}>{f.label}</span>
            ))}
          </div>
        )}

        {/* Likes + View Details Trigger */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--muted)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: isLiked ? '#ef4444' : undefined, fontWeight: isLiked ? '600' : 'normal' }}>
            <Heart size={12} fill={isLiked ? '#ef4444' : 'none'} color={isLiked ? '#ef4444' : 'currentColor'} /> {t.likes}
          </div>
          <span style={{ color: 'var(--primary)', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Eye size={12} /> View Details
          </span>
        </div>

        {/* Actions */}
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '7px' }} onClick={e => e.stopPropagation()}>
          {isPurchased && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#10b981', fontSize: '0.75rem', fontWeight: '600' }}>
              <CheckCircle size={13} /> In Your Library
            </div>
          )}
          {isOwnTemplate ? (
            <a
              href={`/dashboard/templates?highlight=${t.id}`}
              style={{
                width: '100%', fontSize: '0.82rem', padding: '8px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)',
                borderRadius: '8px', color: '#10b981', textDecoration: 'none', fontWeight: '600',
              }}
            >
              <CheckCircle size={13} /> View in My Library
            </a>
          ) : (
            <button
              className="btn btn-primary"
              style={{ width: '100%', fontSize: '0.82rem', padding: '8px', gap: '6px', justifyContent: 'center' }}
              onClick={onPurchase}
              disabled={isPurchasing}
            >
              {isPurchasing ? <div className="spinner" style={{ width: '14px', height: '14px' }} /> : <ShoppingCart size={13} />}
              {isPurchasing ? 'Processing...' : isPurchased ? (t.price === 0 ? 'Add to Library Again' : `Buy Again · ${t.price} cr`) : (t.price === 0 ? 'Add to Library' : `Buy · ${t.price} cr`)}
            </button>
          )}

          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={onLike}
              disabled={isLiking}
              style={{
                flex: 1, padding: '6px',
                background: isLiked ? 'rgba(239, 68, 68, 0.12)' : 'transparent',
                border: `1px solid ${isLiked ? 'rgba(239, 68, 68, 0.4)' : 'var(--glass-border)'}`,
                borderRadius: '8px', cursor: 'pointer',
                color: isLiked ? '#ef4444' : 'var(--muted)',
                fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                fontWeight: isLiked ? '600' : 'normal',
                transition: 'all 0.15s',
              }}
            >
              <Heart size={12} fill={isLiked ? '#ef4444' : 'none'} color={isLiked ? '#ef4444' : 'currentColor'} />
              {isLiked ? 'Liked' : 'Like'}
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
              disabled={isReported}
              style={{
                padding: '6px',
                background: isReported ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                border: `1px solid ${isReported ? 'rgba(239, 68, 68, 0.3)' : 'var(--glass-border)'}`,
                borderRadius: '8px',
                cursor: isReported ? 'not-allowed' : 'pointer',
                color: isReported ? '#ef4444' : 'var(--muted)',
                opacity: isReported ? 0.7 : 1,
              }}
              title={isReported ? 'You have reported this template' : 'Report this template'}
            >
              <Flag size={12} fill={isReported ? '#ef4444' : 'none'} color={isReported ? '#ef4444' : 'currentColor'} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

class ModalErrorBoundary extends React.Component<
  { children: React.ReactNode; onClose: () => void },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ModalErrorBoundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(10px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={this.props.onClose}
        >
          <div
            style={{
              background: 'var(--card-bg, #18181b)',
              border: '1px solid var(--glass-border, rgba(255,255,255,0.12))',
              borderRadius: '16px',
              padding: '32px',
              maxWidth: '480px',
              width: '100%',
              textAlign: 'center',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <AlertTriangle size={48} color="#ef4444" style={{ marginBottom: '16px' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '8px' }}>Unable to preview template</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: '24px' }}>
              An error occurred while loading this template&apos;s preview assets.
            </p>
            <button className="btn btn-secondary" onClick={this.props.onClose}>
              Close Preview
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function TemplateDetailModal({
  template: t,
  isPurchased,
  isPurchasing,
  isLiking,
  isLiked = false,
  isReported = false,
  isOwnTemplate = false,
  onClose,
  onPurchase,
  onLike,
  onReport,
  onDownload,
}: {
  template: Template;
  isPurchased: boolean;
  isPurchasing: boolean;
  isLiking: boolean;
  isLiked?: boolean;
  isReported?: boolean;
  isOwnTemplate?: boolean;
  onClose: () => void;
  onPurchase: () => void;
  onLike: () => void;
  onReport: () => void;
  onDownload: (format: string) => void;
}) {
  const [activeSide, setActiveSide] = useState<'both' | 'front' | 'back'>(
    t.backImageUrl || t.sides === 2 ? 'both' : 'front'
  );
  const [fullscreenImg, setFullscreenImg] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<'mapped_data' | 'raw_design'>('mapped_data');

  // Interactive sample cardholder data state for buyers to type test values
  const [sampleCardholderData, setSampleCardholderData] = useState<Record<string, string>>({
    name: 'John Doe',
    designation: 'Student / Employee',
    cardSerial: 'STU-2026-001',
    bloodGroup: 'B+',
    rollNumber: '2026-99',
    schoolName: 'Greenwood High School',
    class: 'Class X-A',
    fatherName: 'Robert Doe',
    phone: '+1 555-0192',
    dob: '2008-05-14',
    address: '123 Academic Way',
  });

  const editableFields = useMemo(() => {
    try {
      let parsedFront: any[] = [];
      if (typeof t.frontFields === 'string') {
        parsedFront = JSON.parse(t.frontFields || '[]');
      } else if (Array.isArray(t.frontFields)) {
        parsedFront = t.frontFields;
      }

      let parsedBack: any[] = [];
      if (typeof t.backFields === 'string') {
        parsedBack = JSON.parse(t.backFields || '[]');
      } else if (Array.isArray(t.backFields)) {
        parsedBack = t.backFields;
      }

      const allParsed = [
        ...(Array.isArray(parsedFront) ? parsedFront : []),
        ...(Array.isArray(parsedBack) ? parsedBack : [])
      ];

      const nonImageFields = allParsed.filter((f: any) => f && typeof f === 'object' && f.type !== 'image' && f.field !== 'photo');
      const fieldMap = new Map<string, any>();
      nonImageFields.forEach((f: any) => {
        if (f && f.field && !fieldMap.has(f.field)) {
          fieldMap.set(f.field, f);
        }
      });
      return Array.from(fieldMap.values());
    } catch (e) {
      console.warn('Error parsing editable fields for template:', e);
      return [];
    }
  }, [t.frontFields, t.backFields]);

  const liveCardholder = useMemo(() => {
    const custom: Record<string, string> = {};
    if (sampleCardholderData && typeof sampleCardholderData === 'object') {
      Object.keys(sampleCardholderData).forEach(k => {
        if (k !== 'name' && k !== 'designation' && k !== 'cardSerial') {
          custom[k] = String(sampleCardholderData[k] || '');
        }
      });
    }

    // Parse all fields from both sides and inject sample image URLs for every image field
    const SAMPLE_PHOTO = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80';
    const SAMPLE_SIGNATURE = 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/John_Doe_Signature.svg/320px-John_Doe_Signature.svg.png';
    const SAMPLE_LOGO = 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Culinary_Arts_School_logo.svg/240px-Culinary_Arts_School_logo.svg.png';

    try {
      let allFields: any[] = [];
      for (const src of [t.frontFields, t.backFields]) {
        if (!src) continue;
        const parsed = typeof src === 'string' ? JSON.parse(src || '[]') : src;
        if (Array.isArray(parsed)) allFields = allFields.concat(parsed);
      }
      allFields.forEach((f: any) => {
        if (!f || !f.field) return;
        const fType = (f.type || '').toLowerCase();
        const fKey = f.field.toLowerCase();
        const isImg = fType === 'image' || fType === 'photo' || fType === 'signature' || fType === 'sig' ||
          fType === 'logo' || fType === 'stamp' || fType === 'img' || fType === 'picture' ||
          fType === 'static_image' || fType === 'static_img';
        if (!isImg) return;
        if (custom[f.field]) return; // already set by user
        // Pick a contextual sample image
        if (fKey.includes('sign') || fKey === 'sig') {
          custom[f.field] = SAMPLE_SIGNATURE;
        } else if (fKey.includes('logo') || fKey.includes('school') || fKey.includes('org') || fKey.includes('institute')) {
          custom[f.field] = SAMPLE_LOGO;
        } else {
          custom[f.field] = SAMPLE_PHOTO;
        }
      });
    } catch (_) {}

    return {
      id: 99,
      name: sampleCardholderData?.name || 'John Doe',
      designation: sampleCardholderData?.designation || 'Student / Employee',
      photoUrl: SAMPLE_PHOTO,
      cardSerial: sampleCardholderData?.cardSerial || 'STU-2026-001',
      customFields: JSON.stringify(custom),
    };
  }, [sampleCardholderData, t.frontFields, t.backFields]);

  const formats = [
    { key: 'cdr', label: 'CDR', available: t.hasCdr },
    { key: 'ai', label: 'AI', available: t.hasAi },
    { key: 'psd', label: 'PSD', available: t.hasPsd },
    { key: 'pdf', label: 'PDF', available: t.hasPdf },
  ].filter(f => f.available);

  const fields = t.fieldsSummary || [];
  const frontFields = fields.filter(f => f.side === 'Front');
  const backFields = fields.filter(f => f.side === 'Back');

  const previewTemplate = useMemo(() => ({
    id: t.id,
    cardWidth: t.cardWidth || 1013,
    cardHeight: t.cardHeight || 638,
    frontImageUrl: t.frontImageUrl,
    backImageUrl: t.backImageUrl,
    frontOriginalUrl: (t as any).frontOriginalUrl,
    backOriginalUrl: (t as any).backOriginalUrl,
    sides: t.sides,
    frontFields: typeof t.frontFields === 'string' ? t.frontFields : JSON.stringify(t.frontFields || []),
    backFields: typeof t.backFields === 'string' ? t.backFields : JSON.stringify(t.backFields || []),
  }), [t.id, t.cardWidth, t.cardHeight, t.frontImageUrl, t.backImageUrl, (t as any).frontOriginalUrl, (t as any).backOriginalUrl, t.sides, t.frontFields, t.backFields]);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(10px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        overflowY: 'auto',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--card-bg, #18181b)',
          border: '1px solid var(--glass-border, rgba(255,255,255,0.12))',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '980px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--glass-border, rgba(255,255,255,0.1))', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: '700', margin: 0 }}>{t.name}</h2>
              {t.isOfficial && (
                <span style={{ background: '#6366f1', color: '#fff', padding: '2px 8px', borderRadius: '20px', fontSize: '0.65rem', fontWeight: '700' }}>OFFICIAL</span>
              )}
              {isOwnTemplate && (
                <span style={{ background: '#10b981', color: '#fff', padding: '2px 8px', borderRadius: '20px', fontSize: '0.65rem', fontWeight: '700' }}>YOUR LISTING</span>
              )}
            </div>
            <p style={{ color: 'var(--muted)', fontSize: '0.82rem', margin: '4px 0 0 0' }}>
              by {t.sellerName} · {CAT_LABELS[t.category] || t.category} · {t.sides === 2 ? '2-Sided Template' : 'Single-Sided Template'}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'var(--muted)', cursor: 'pointer', padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Mode & Side Controls */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
            {/* Live Data vs Raw Asset Switcher */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '0.78rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  border: '1px solid var(--glass-border)',
                  background: previewMode === 'mapped_data' ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                  color: previewMode === 'mapped_data' ? '#fff' : 'var(--muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease',
                }}
                onClick={() => setPreviewMode('mapped_data')}
              >
                <Zap size={14} /> Mapped Sample Data Preview
              </button>
              <button
                type="button"
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '0.78rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  border: '1px solid var(--glass-border)',
                  background: previewMode === 'raw_design' ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                  color: previewMode === 'raw_design' ? '#fff' : 'var(--muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease',
                }}
                onClick={() => setPreviewMode('raw_design')}
              >
                <ImageIcon size={14} /> Blank Design Asset
              </button>
            </div>

            {/* Side Toggle Control (if 2-sided) */}
            {(t.backImageUrl || t.sides === 2) && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setActiveSide('both')}
                  className={`btn ${activeSide === 'both' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.78rem', padding: '6px 14px', gap: '6px' }}
                >
                  <Layers size={14} /> Both Sides
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSide('front')}
                  className={`btn ${activeSide === 'front' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.78rem', padding: '6px 14px' }}
                >
                  Front Side
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSide('back')}
                  className={`btn ${activeSide === 'back' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.78rem', padding: '6px 14px' }}
                >
                  Back Side
                </button>
              </div>
            )}
          </div>

          {/* Previews Display */}
          <div style={{ display: 'grid', gridTemplateColumns: activeSide === 'both' && (t.backImageUrl || t.sides === 2) ? 'repeat(auto-fit, minmax(320px, 1fr))' : '1fr', gap: '20px', justifyContent: 'center' }}>
            {(activeSide === 'both' || activeSide === 'front') && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CreditCard size={14} color="var(--primary)" />
                  Front Side {previewMode === 'mapped_data' ? '(Sample Test Data Mapped)' : 'Design Asset'}
                </div>
                <div
                  style={{ position: 'relative', cursor: 'zoom-in', borderRadius: '12px', overflow: 'hidden', width: '100%', display: 'flex', justifyContent: 'center' }}
                  onClick={() => setFullscreenImg(t.frontImageUrl)}
                  title="Click to view full screen"
                >
                  {previewMode === 'mapped_data' ? (
                    <CardPreview
                      template={previewTemplate}
                      cardholder={liveCardholder}
                      side="front"
                      forceWeb={true}
                      style={{ maxWidth: t.cardWidth > t.cardHeight ? '520px' : '360px', maxHeight: '420px', objectFit: 'contain' }}
                    />
                  ) : (
                    <img
                      src={t.frontImageUrl}
                      alt={`${t.name} Front`}
                      style={{
                        display: 'block',
                        maxWidth: t.cardWidth > t.cardHeight ? '520px' : '360px',
                        width: '100%',
                        height: 'auto',
                        borderRadius: '12px',
                        border: '1px solid var(--glass-border)',
                        boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
                        transition: 'transform 0.2s',
                      }}
                    />
                  )}
                  <div style={{
                    position: 'absolute', bottom: '10px', right: '10px',
                    background: 'rgba(0,0,0,0.75)', color: '#fff',
                    padding: '4px 10px', borderRadius: '20px', fontSize: '0.72rem',
                    display: 'flex', alignItems: 'center', gap: '5px', backdropFilter: 'blur(4px)'
                  }}>
                    <Maximize2 size={12} /> Fullscreen
                  </div>
                </div>
              </div>
            )}

            {(activeSide === 'both' || activeSide === 'back') && (t.backImageUrl || t.sides === 2 || backFields.length > 0) && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CreditCard size={14} color="#818cf8" />
                  Back Side {previewMode === 'mapped_data' ? '(Sample Test Data Mapped)' : 'Design Asset'}
                </div>
                {t.backImageUrl || t.backFields || t.sides === 2 || backFields.length > 0 ? (
                  <div
                    style={{ position: 'relative', cursor: 'zoom-in', borderRadius: '12px', overflow: 'hidden', width: '100%', display: 'flex', justifyContent: 'center' }}
                    onClick={() => setFullscreenImg(t.backImageUrl || t.frontImageUrl)}
                    title="Click to view full screen"
                  >
                    {previewMode === 'mapped_data' ? (
                      <CardPreview
                        template={previewTemplate}
                        cardholder={liveCardholder}
                        side="back"
                        forceWeb={true}
                        style={{ maxWidth: t.cardWidth > t.cardHeight ? '520px' : '360px', maxHeight: '420px', objectFit: 'contain' }}
                      />
                    ) : (
                      <img
                        src={t.backImageUrl || (t as any).backOriginalUrl || t.frontImageUrl}
                        alt={`${t.name} Back`}
                        style={{
                          display: 'block',
                          maxWidth: t.cardWidth > t.cardHeight ? '520px' : '360px',
                          width: '100%',
                          height: 'auto',
                          borderRadius: '12px',
                          border: '1px solid var(--glass-border)',
                          boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
                          transition: 'transform 0.2s',
                        }}
                      />
                    )}
                    <div style={{
                      position: 'absolute', bottom: '10px', right: '10px',
                      background: 'rgba(0,0,0,0.75)', color: '#fff',
                      padding: '4px 10px', borderRadius: '20px', fontSize: '0.72rem',
                      display: 'flex', alignItems: 'center', gap: '5px', backdropFilter: 'blur(4px)'
                    }}>
                      <Maximize2 size={12} /> Fullscreen
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '20px', color: 'var(--muted)', fontSize: '0.85rem',
                    border: '1px dashed var(--glass-border)', borderRadius: '12px', minHeight: '160px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    Back Side Image Not Generated Yet
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Interactive Text Field Input Panel (Live Testing for Buyers) */}
          {previewMode === 'mapped_data' && editableFields.length > 0 && (
            <div className="glass-panel" style={{ padding: '16px 20px', borderRadius: '12px', background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Edit3 size={15} color="var(--primary)" />
                  Test Live Card Text (Type below to preview live changes)
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--muted)', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '10px' }}>
                  Image & photo fields locked
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                {editableFields.map((f: any, idx: number) => {
                  if (!f || typeof f !== 'object') return null;
                  const key = String(f.field || f.name || f.key || `field_${idx}`);
                  if (!key) return null;
                  const label = f.label || (key.length > 0 ? (key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')) : `Field ${idx + 1}`);
                  const val = sampleCardholderData[key] !== undefined ? String(sampleCardholderData[key]) : '';
                  return (
                    <div key={`${key}_${idx}`} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.72rem', fontWeight: '500', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {label} {f.prefix ? <span style={{ opacity: 0.65 }}>({f.prefix})</span> : null}
                      </label>
                      <input
                        type="text"
                        value={val}
                        placeholder={`Type sample ${label}...`}
                        onChange={(e) => {
                          const newText = e.target.value;
                          setSampleCardholderData(prev => ({
                            ...prev,
                            [key]: newText,
                          }));
                        }}
                        style={{
                          width: '100%',
                          fontSize: '0.8rem',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          background: 'var(--background)',
                          border: '1px solid var(--glass-border)',
                          color: 'var(--foreground)',
                          outline: 'none',
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Full Screen Image Lightbox Overlay */}
          {fullscreenImg && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.92)',
                backdropFilter: 'blur(12px)',
                zIndex: 999999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '24px',
                cursor: 'zoom-out',
              }}
              onClick={() => setFullscreenImg(null)}
            >
              <button
                onClick={() => setFullscreenImg(null)}
                style={{
                  position: 'absolute', top: '24px', right: '24px',
                  background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
                  padding: '10px', borderRadius: '50%', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
                }}
                title="Close Full Screen (Esc)"
              >
                <X size={24} />
              </button>
              <img
                src={fullscreenImg}
                alt="Full Screen Preview"
                style={{
                  maxWidth: '96vw',
                  maxHeight: '94vh',
                  objectFit: 'contain',
                  borderRadius: '12px',
                  boxShadow: '0 25px 80px rgba(0,0,0,0.9)',
                }}
              />
            </div>
          )}

          {/* Fields Summary Section */}
          <div className="glass-panel" style={{ padding: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: '600', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={16} color="var(--primary)" /> Included Cardholder Fields
              </h3>
              <span style={{ fontSize: '0.78rem', color: 'var(--muted)', background: 'rgba(99,102,241,0.1)', padding: '3px 10px', borderRadius: '12px', border: '1px solid rgba(99,102,241,0.2)' }}>
                {fields.length} dynamic field{fields.length !== 1 ? 's' : ''}
              </span>
            </div>

            {fields.length === 0 ? (
              <div style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
                Standard dynamic cardholder fields (Name, Photo, ID, etc.).
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {frontFields.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--primary)' }} />
                      Front Side Fields ({frontFields.length})
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
                      {frontFields.map((f, i) => {
                        const badge = getFieldTypeBadge(f.type);
                        const fieldName = f.name || f.label || f.key || 'Field';
                        const samplePreview = `${f.prefix || ''}${f.sampleValue || ''}${f.suffix || ''}`.trim();
                        return (
                          <div key={i} style={{
                            padding: '12px 14px', borderRadius: '12px',
                            background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)',
                            display: 'flex', flexDirection: 'column', gap: '8px'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ color: badge.color, display: 'flex', padding: '6px', borderRadius: '8px', background: badge.color + '18' }}>
                                {badge.icon}
                              </span>
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontSize: '0.88rem', fontWeight: '600', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {fieldName}
                                </div>
                                <div style={{ fontSize: '0.7rem', color: badge.color, fontWeight: '500', marginTop: '1px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <span style={{ opacity: 0.7 }}>Type:</span>
                                  <span>{badge.label}</span>
                                </div>
                              </div>
                            </div>

                            {samplePreview && (
                              <div style={{
                                fontSize: '0.75rem',
                                color: 'var(--text)',
                                background: 'rgba(99,102,241,0.08)',
                                border: '1px solid rgba(99,102,241,0.2)',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}>
                                <span style={{ fontSize: '0.68rem', color: 'var(--muted)', fontWeight: '600', textTransform: 'uppercase' }}>Preview:</span>
                                <span style={{ fontWeight: '500', color: '#a5b4fc', textOverflow: 'ellipsis', overflow: 'hidden' }}>{samplePreview}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {backFields.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#818cf8' }} />
                      Back Side Fields ({backFields.length})
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
                      {backFields.map((f, i) => {
                        const badge = getFieldTypeBadge(f.type);
                        const fieldName = f.name || f.label || f.key || 'Field';
                        const samplePreview = `${f.prefix || ''}${f.sampleValue || ''}${f.suffix || ''}`.trim();
                        return (
                          <div key={i} style={{
                            padding: '12px 14px', borderRadius: '12px',
                            background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)',
                            display: 'flex', flexDirection: 'column', gap: '8px'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ color: badge.color, display: 'flex', padding: '6px', borderRadius: '8px', background: badge.color + '18' }}>
                                {badge.icon}
                              </span>
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontSize: '0.88rem', fontWeight: '600', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {fieldName}
                                </div>
                                <div style={{ fontSize: '0.7rem', color: badge.color, fontWeight: '500', marginTop: '1px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <span style={{ opacity: 0.7 }}>Type:</span>
                                  <span>{badge.label}</span>
                                </div>
                              </div>
                            </div>

                            {samplePreview && (
                              <div style={{
                                fontSize: '0.75rem',
                                color: 'var(--text)',
                                background: 'rgba(99,102,241,0.08)',
                                border: '1px solid rgba(99,102,241,0.2)',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}>
                                <span style={{ fontSize: '0.68rem', color: 'var(--muted)', fontWeight: '600', textTransform: 'uppercase' }}>Preview:</span>
                                <span style={{ fontWeight: '500', color: '#a5b4fc', textOverflow: 'ellipsis', overflow: 'hidden' }}>{samplePreview}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Specifications & Export Options */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div className="glass-panel" style={{ padding: '16px', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '4px' }}>Card Dimensions</div>
              <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>
                {t.cardWidth || 85.6}mm × {t.cardHeight || 53.98}mm
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '16px', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '4px' }}>Downloadable File Formats</div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                {formats.length === 0 ? <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>PDF System Template</span> : formats.map(f => (
                  <span key={f.key} style={tagStyle('#818cf8')}>{f.label}</span>
                ))}
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '16px', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '4px' }}>Marketplace Price</div>
              <div style={{ fontWeight: '700', fontSize: '0.95rem', color: t.price === 0 ? '#10b981' : '#f59e0b' }}>
                {t.price === 0 ? 'FREE' : `${t.price} Credits`}
              </div>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--glass-border, rgba(255,255,255,0.1))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={onLike}
              disabled={isLiking}
              className="btn btn-secondary"
              style={{
                fontSize: '0.82rem', padding: '8px 14px', gap: '6px',
                color: isLiked ? '#ef4444' : undefined,
                borderColor: isLiked ? 'rgba(239, 68, 68, 0.4)' : undefined,
                background: isLiked ? 'rgba(239, 68, 68, 0.12)' : undefined,
                fontWeight: isLiked ? '600' : 'normal',
              }}
            >
              <Heart size={14} fill={isLiked ? '#ef4444' : 'none'} color={isLiked ? '#ef4444' : 'currentColor'} /> {t.likes} {isLiked ? 'Liked' : 'Likes'}
            </button>
            <button
              onClick={onReport}
              disabled={isReported}
              className="btn btn-secondary"
              style={{
                fontSize: '0.82rem', padding: '8px 14px', gap: '6px',
                color: isReported ? '#ef4444' : undefined,
                borderColor: isReported ? 'rgba(239, 68, 68, 0.3)' : undefined,
                background: isReported ? 'rgba(239, 68, 68, 0.08)' : undefined,
                opacity: isReported ? 0.7 : 1,
                cursor: isReported ? 'not-allowed' : 'pointer',
              }}
              title={isReported ? 'You have reported this template' : 'Report this template'}
            >
              <Flag size={14} fill={isReported ? '#ef4444' : 'none'} color={isReported ? '#ef4444' : 'currentColor'} /> {isReported ? 'Reported' : 'Report'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {isPurchased && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#10b981', fontSize: '0.85rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle size={16} /> In Your Library
                </span>
                {formats.length > 0 && (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {formats.map(f => (
                      <button key={f.key} onClick={() => onDownload(f.key)} className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '6px 12px' }}>
                        ↓ {f.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {isOwnTemplate ? (
              <a
                href={`/dashboard/templates?highlight=${t.id}`}
                style={{
                  fontSize: '0.88rem', padding: '10px 24px',
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                  background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)',
                  borderRadius: '8px', color: '#10b981', textDecoration: 'none', fontWeight: '600',
                }}
              >
                <CheckCircle size={16} /> View in My Library
              </a>
            ) : (
              <button
                className="btn btn-primary"
                style={{ fontSize: '0.88rem', padding: '10px 24px', gap: '8px' }}
                onClick={onPurchase}
                disabled={isPurchasing}
              >
                {isPurchasing ? <div className="spinner" style={{ width: '16px', height: '16px' }} /> : <ShoppingCart size={16} />}
                {isPurchasing ? 'Processing...' : isPurchased ? (t.price === 0 ? 'Add Again' : `Buy Again · ${t.price} Credits`) : (t.price === 0 ? 'Add to Library' : `Buy Template · ${t.price} Credits`)}
              </button>
            )}
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

function getFieldTypeBadge(type: string) {
  const t = (type || '').toLowerCase();
  if (t.includes('photo') || t.includes('image')) return { icon: <ImageIcon size={13} />, label: 'Photo / Image', color: '#6366f1' };
  if (t.includes('qr')) return { icon: <QrCode size={13} />, label: 'QR Code', color: '#06b6d4' };
  if (t.includes('barcode')) return { icon: <Barcode size={13} />, label: 'Barcode', color: '#8b5cf6' };
  if (t.includes('sig')) return { icon: <FileText size={13} />, label: 'Signature', color: '#f59e0b' };
  if (t.includes('id') || t.includes('serial')) return { icon: <Tag size={13} />, label: 'ID Number', color: '#ec4899' };
  return { icon: <FileText size={13} />, label: 'Text Field', color: '#10b981' };
}
