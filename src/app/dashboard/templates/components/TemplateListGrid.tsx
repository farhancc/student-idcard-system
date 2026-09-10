import React from 'react';
import { LayoutGrid, Store, Eye } from 'lucide-react';
import { TEMPLATE_CATEGORIES, TemplateCategory, CATEGORY_LABELS, CATEGORY_COLORS } from './constants';

interface TemplateListGridProps {
  loading: boolean;
  baseTemplates: any[];
  currentTemplates: any[];
  filterCategory: TemplateCategory | 'ALL';
  setFilterCategory: (cat: TemplateCategory | 'ALL') => void;
  isElectron: boolean;
  handleEditClick: (tmpl: any) => void;
  handleDeleteTemplate: (id: number) => void;
  onPublishClick: (tmpl: any) => void;
  onPreviewClick: (id: number, side: 'front' | 'back') => void;
  getOptimizedImageUrl: (url: string) => string;
}

export default function TemplateListGrid({
  loading,
  baseTemplates,
  currentTemplates,
  filterCategory,
  setFilterCategory,
  isElectron,
  handleEditClick,
  handleDeleteTemplate,
  onPublishClick,
  onPreviewClick,
  getOptimizedImageUrl
}: TemplateListGridProps) {
  return (
    <>
      {/* Category Filter Chips */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '24px' }}>
        <button
          onClick={() => setFilterCategory('ALL')}
          style={{
            padding: '4px 14px', borderRadius: '99px', fontSize: '0.78rem', fontWeight: filterCategory === 'ALL' ? 700 : 400,
            border: filterCategory === 'ALL' ? '1.5px solid rgba(255,255,255,0.4)' : '1px solid var(--glass-border)',
            background: filterCategory === 'ALL' ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
            color: filterCategory === 'ALL' ? '#fff' : 'var(--muted)',
            cursor: 'pointer', transition: 'all 0.15s',
          }}
        >
          All ({baseTemplates.length})
        </button>
        {TEMPLATE_CATEGORIES.filter(cat => baseTemplates.some((t: any) => (t.category || 'OTHER') === cat)).map(cat => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            style={{
              padding: '4px 14px', borderRadius: '99px', fontSize: '0.78rem', fontWeight: filterCategory === cat ? 700 : 400,
              border: filterCategory === cat ? `1.5px solid ${CATEGORY_COLORS[cat].border}` : '1px solid var(--glass-border)',
              background: filterCategory === cat ? CATEGORY_COLORS[cat].bg : 'rgba(255,255,255,0.04)',
              color: filterCategory === cat ? CATEGORY_COLORS[cat].color : 'var(--muted)',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            {CATEGORY_LABELS[cat]} ({baseTemplates.filter((t: any) => (t.category || 'OTHER') === cat).length})
          </button>
        ))}
      </div>

      {/* Templates List */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '50px 0' }}>
          <div className="spinner"></div>
        </div>
      ) : currentTemplates.length === 0 ? (
        <div className="glass-panel" style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--muted)' }}>
          <LayoutGrid size={40} style={{ marginBottom: '16px' }} />
          <h3>No Templates Created</h3>
          <p style={{ marginTop: '8px' }}>
            {filterCategory !== 'ALL' ? `No ${CATEGORY_LABELS[filterCategory as TemplateCategory]} templates yet.` : 'Create a template and map card details coordinates to begin layouts previews.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '24px' }}>
          {currentTemplates.map((tmpl: any) => {
            const cat = (tmpl.category || 'OTHER') as TemplateCategory;
            const catColors = CATEGORY_COLORS[cat];
            return (
            <div 
              key={tmpl.id} 
              className="glass-panel glass-panel-hover" 
              onClick={() => handleEditClick(tmpl)}
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
                        {CATEGORY_LABELS[cat]}
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
                          onClick={(e) => { e.stopPropagation(); handleEditClick(tmpl); }}
                        >
                          Edit
                        </button>
                        <button 
                          className="btn btn-danger" 
                          style={{ padding: '4px 8px', fontSize: '0.7rem' }}
                          onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(tmpl.id); }}
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
                              onPublishClick(tmpl);
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
                <button className="btn btn-secondary" style={{ padding: '8px 12px', fontSize: '0.8rem', width: '50%' }} onClick={(e) => { e.stopPropagation(); onPreviewClick(tmpl.id, 'front'); }}>
                  <Eye size={14} /> Preview Front
                </button>
                {tmpl.backImageUrl && (
                  <button className="btn btn-secondary" style={{ padding: '8px 12px', fontSize: '0.8rem', width: '50%' }} onClick={(e) => { e.stopPropagation(); onPreviewClick(tmpl.id, 'back'); }}>
                    <Eye size={14} /> Preview Back
                  </button>
                )}
              </div>
            </div>
            );
          })}
        </div>
      )}
    </>
  );
}
