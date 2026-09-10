import React from 'react';
import { Store, Eye } from 'lucide-react';

const CATEGORY_LABELS: Record<string, string> = {
  ID_CARD: 'ID Card',
  CERTIFICATE: 'Certificate',
  BADGE: 'Badge',
  LABEL: 'Label',
  TICKET: 'Ticket',
  VISITOR_PASS: 'Visitor Pass',
  LETTER: 'Letter',
  CARD: 'Card',
  TAG: 'Tag',
  STICKER: 'Sticker',
  OTHER: 'Other',
};

const CATEGORY_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  ID_CARD:      { bg: 'rgba(79,70,229,0.18)',  color: '#818cf8', border: 'rgba(79,70,229,0.4)' },
  CERTIFICATE:  { bg: 'rgba(245,158,11,0.18)', color: '#fbbf24', border: 'rgba(245,158,11,0.4)' },
  BADGE:        { bg: 'rgba(16,185,129,0.18)', color: '#34d399', border: 'rgba(16,185,129,0.4)' },
  LABEL:        { bg: 'rgba(59,130,246,0.18)', color: '#60a5fa', border: 'rgba(59,130,246,0.4)' },
  TICKET:       { bg: 'rgba(236,72,153,0.18)', color: '#f472b6', border: 'rgba(236,72,153,0.4)' },
  VISITOR_PASS: { bg: 'rgba(20,184,166,0.18)', color: '#2dd4bf', border: 'rgba(20,184,166,0.4)' },
  LETTER:       { bg: 'rgba(107,114,128,0.2)', color: '#9ca3af', border: 'rgba(107,114,128,0.4)' },
  CARD:         { bg: 'rgba(239,68,68,0.18)',  color: '#f87171', border: 'rgba(239,68,68,0.4)' },
  TAG:          { bg: 'rgba(251,191,36,0.18)', color: '#fde68a', border: 'rgba(251,191,36,0.4)' },
  STICKER:      { bg: 'rgba(167,139,250,0.2)', color: '#c4b5fd', border: 'rgba(167,139,250,0.4)' },
  OTHER:        { bg: 'rgba(255,255,255,0.06)', color: '#94a3b8', border: 'rgba(255,255,255,0.15)' },
};

const getOptimizedImageUrl = (url: string) => {
  if (!url) return '';
  const lowerUrl = url.toLowerCase();

  if (url.startsWith('local://') || url.startsWith('data:')) {
    return url;
  }

  if (lowerUrl.includes('.pdf')) {
    if (url.includes('/templates/originals/')) {
      return url.replace('/templates/originals/', '/templates/previews/').replace(/\.pdf(\?|$)/i, '.png$1');
    }
    return url.replace(/\.pdf(\?|$)/i, '.png$1');
  }

  if (lowerUrl.includes('.svg')) {
    if (url.includes('/image/upload/')) {
      return url.replace('/image/upload/', '/image/upload/w_2000/').replace(/\.svg(\?|$)/i, '.png$1');
    }
    return url.replace(/\.svg(\?|$)/i, '.png$1');
  }
  return url;
};

interface TemplateCardProps {
  tmpl: any;
  isElectron: boolean;
  onEdit: (tmpl: any) => void;
  onDelete: (id: number) => void;
  onPublish: (tmpl: any) => void;
  onPreview: (id: number, side: 'front' | 'back') => void;
}

export default function TemplateCard({
  tmpl,
  isElectron,
  onEdit,
  onDelete,
  onPublish,
  onPreview,
}: TemplateCardProps) {
  const cat = (tmpl.category || 'OTHER') as string;
  const catColors = CATEGORY_COLORS[cat] || CATEGORY_COLORS.OTHER;

  return (
    <div 
      className="glass-panel glass-panel-hover" 
      onClick={() => onEdit(tmpl)}
      style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'space-between',
        cursor: 'pointer'
      }}
    >
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ fontSize: '1.05rem', margin: 0, marginBottom: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tmpl.name}</h3>
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
              {/* Category Badge */}
              <span style={{
                display: 'inline-flex', alignItems: 'center', padding: '2px 9px',
                borderRadius: '99px', fontSize: '0.68rem', fontWeight: 700,
                background: catColors.bg, color: catColors.color, border: `1px solid ${catColors.border}`,
              }}>
                {CATEGORY_LABELS[cat] || 'Other'}
              </span>
              {/* Sides Badge */}
              <span style={{
                display: 'inline-flex', alignItems: 'center', padding: '2px 9px',
                borderRadius: '99px', fontSize: '0.68rem', fontWeight: 700,
                background: tmpl.sides === 2 ? 'rgba(236,72,153,0.12)' : 'rgba(255,255,255,0.06)',
                color: tmpl.sides === 2 ? '#f472b6' : '#94a3b8',
                border: tmpl.sides === 2 ? '1px solid rgba(236,72,153,0.3)' : '1px solid rgba(255,255,255,0.1)',
              }}>
                {tmpl.sides === 2 ? '2-Sided' : '1-Sided'}
              </span>
              {/* Version Badge */}
              <span className="badge badge-primary">v{tmpl.version}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0, marginLeft: '8px' }}>
            {isElectron && (
              <>
                <button 
                  className="btn btn-secondary" 
                  style={{ padding: '4px 8px', fontSize: '0.7rem' }}
                  onClick={(e) => { e.stopPropagation(); onEdit(tmpl); }}
                >
                  Edit
                </button>
                <button 
                  className="btn btn-danger" 
                  style={{ padding: '4px 8px', fontSize: '0.7rem' }}
                  onClick={(e) => { e.stopPropagation(); onDelete(tmpl.id); }}
                >
                  Delete
                </button>
                {tmpl.isPurchased ? (
                  <span className="badge badge-secondary" style={{ padding: '4px 8px', fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.06)' }}>
                    Purchased
                  </span>
                ) : (
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '4px 8px', fontSize: '0.7rem', background: tmpl.isPublic ? 'rgba(16,185,129,0.1)' : 'transparent', border: tmpl.isPublic ? '1px solid rgba(16,185,129,0.3)' : '1px solid var(--glass-border)', color: tmpl.isPublic ? '#10b981' : undefined }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onPublish(tmpl);
                    }}
                    title={tmpl.isPublic ? 'Listed on Marketplace' : 'Sell on Marketplace'}
                  >
                    <Store size={10} /> {tmpl.isPublic ? 'Listed' : 'Sell'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
        
        <div style={{ 
          width: '100%', 
          height: '180px', 
          borderRadius: '10px', 
          backgroundImage: `url(${getOptimizedImageUrl(tmpl.frontImageUrl)})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          border: `1px solid ${catColors.border}`,
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'flex-end',
          padding: '12px'
        }}>
          <div className="badge badge-primary" style={{ background: 'rgba(0,0,0,0.6)', border: 'none' }}>
            {tmpl.cardWidth} × {tmpl.cardHeight} px ({Math.round((tmpl.cardWidth * 25.4 / 300) * 10) / 10} × {Math.round((tmpl.cardHeight * 25.4 / 300) * 10) / 10} mm)
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '0.75rem' }}>
          <span style={{ color: 'var(--muted)' }}>Front fields:</span>
          {JSON.parse(tmpl.frontFields || '[]').map((f: any, idx: number) => (
            <span key={idx} style={{ color: '#fff', background: 'rgba(255,255,255,0.04)', padding: '2px 6px', borderRadius: '4px' }}>{f.field}</span>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <button className="btn btn-secondary" style={{ padding: '8px 12px', fontSize: '0.8rem', width: '50%' }} onClick={(e) => { e.stopPropagation(); onPreview(tmpl.id, 'front'); }}>
          <Eye size={14} /> Preview Front
        </button>
        {tmpl.backImageUrl && (
          <button className="btn btn-secondary" style={{ padding: '8px 12px', fontSize: '0.8rem', width: '50%' }} onClick={(e) => { e.stopPropagation(); onPreview(tmpl.id, 'back'); }}>
            <Eye size={14} /> Preview Back
          </button>
        )}
      </div>
    </div>
  );
}
