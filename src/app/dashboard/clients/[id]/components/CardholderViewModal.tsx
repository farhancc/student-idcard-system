'use client';
import React from 'react';
import { X } from 'lucide-react';
import { CardLivePreview } from './CardLivePreview';
import { getEffectivePhotoUrl } from './utils';

export function CardholderViewModal({
  cardholder,
  previewTemplate,
  previewLoading,
  previewSide,
  onClose,
  onToggleSide,
}: {
  cardholder: any;
  previewTemplate: any;
  previewLoading: boolean;
  previewSide: 'front' | 'back';
  onClose: () => void;
  onToggleSide: (side: 'front' | 'back') => void;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(3,4,7,0.82)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'rgba(13,16,27,0.98)',
          border: '1px solid var(--glass-border)',
          borderTop: '2px solid var(--primary)',
          borderRadius: '18px',
          width: '100%',
          maxWidth: previewTemplate ? '860px' : '500px',
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
          transition: 'max-width 0.3s ease',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '22px 28px 16px', borderBottom: '1px solid var(--glass-border)' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '600' }}>Cardholder Preview</h3>
            {previewTemplate && (
              <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: '500' }}>{previewTemplate.name}</span>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '4px' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0', minHeight: '400px' }}>
          {/* Left: Cardholder Info */}
          <div style={{ flex: '0 0 260px', padding: '22px 24px', borderRight: previewTemplate ? '1px solid var(--glass-border)' : 'none' }}>
            {/* Photo */}
            <div style={{ marginBottom: '18px' }}>
              {(() => {
                const photo = getEffectivePhotoUrl(cardholder);
                return photo ? (
                  <img
                    src={photo}
                    alt={cardholder.name}
                    style={{ width: '80px', height: '80px', borderRadius: '12px', objectFit: 'cover', border: '2px solid var(--glass-border)', display: 'block' }}
                  />
                ) : (
                  <div style={{
                    width: '80px', height: '80px', borderRadius: '12px',
                    background: 'rgba(255,255,255,0.05)', border: '2px dashed var(--glass-border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--muted)', fontSize: '0.7rem', textAlign: 'center',
                  }}>No Photo</div>
                );
              })()}
            </div>

            {/* Core fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
              {[
                { label: 'Name', value: cardholder.name },
                { label: 'Designation', value: cardholder.designation || '—' },
                {
                  label: 'ID / Serial', value: (() => {
                    const custom = cardholder.customFields ? (typeof cardholder.customFields === 'string' ? (() => { try { return JSON.parse(cardholder.customFields!); } catch { return {}; } })() : cardholder.customFields) : {};
                    return cardholder.uniqueKey || (custom as any).uniqueKey || (custom as any).id || (custom as any).unique_key || cardholder.cardSerial || '—';
                  })()
                },
                { label: 'Template', value: cardholder.templateName || '—' },
                { label: 'Added On', value: new Date(cardholder.createdAt).toLocaleDateString() },
              ].map(({ label, value }) => (
                <div key={label} style={{ fontSize: '0.78rem' }}>
                  <span style={{ color: 'var(--muted)', display: 'block', marginBottom: '2px' }}>{label}</span>
                  <span style={{ color: '#fff', fontWeight: '500', wordBreak: 'break-all' }}>{value}</span>
                </div>
              ))}
            </div>

            {/* Template Fields */}
            {(() => {
              let parsed: Record<string, any> = {};
              try { parsed = typeof cardholder.customFields === 'string' ? JSON.parse(cardholder.customFields) : (cardholder.customFields || {}); } catch {}

              let tmplFields: any[] = [];
              if (previewTemplate) {
                try {
                  const front = JSON.parse(previewTemplate.frontFields || '[]');
                  const back = JSON.parse(previewTemplate.backFields || '[]');
                  tmplFields = [...front, ...back].filter(f => f && f.field && !f.isStatic && f.type !== 'static_text' && f.type !== 'static_image' && f.type !== 'image');
                } catch {}
              }

              if (tmplFields.length > 0) {
                const seen = new Set<string>();
                const uniqueTmplFields = tmplFields.filter(f => {
                  if (seen.has(f.field)) return false;
                  seen.add(f.field);
                  return true;
                });

                return (
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px', fontWeight: '600' }}>Template Fields</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                      {uniqueTmplFields.map(f => {
                        let val = parsed[f.field];
                        if (!val) {
                          if (f.isName && cardholder.name && cardholder.name !== 'Cardholder') val = cardholder.name;
                          else if (f.field === 'designation') val = cardholder.designation;
                          else if (f.field === 'uniqueKey') {
                            const rawId = cardholder.uniqueKey || parsed.uniqueKey || parsed.id || parsed.unique_key;
                            if (rawId && !String(rawId).startsWith('C-')) val = rawId;
                          }
                        }

                        const label = f.label || f.field;

                        return (
                          <div key={f.field} style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', padding: '6px 8px' }}>
                            <span style={{ color: 'var(--primary)', display: 'block', fontSize: '0.68rem', marginBottom: '2px' }}>{label}</span>
                            <span style={{ color: val ? '#fff' : '#f59e0b' }}>{val || '— (Missing)'}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              // Fallback if no template linked or loaded
              const entries = Object.entries(parsed).filter(([k, v]) => {
                if (v === null || v === undefined || String(v).trim() === '') return false;
                const str = String(v).trim();
                return !(str.startsWith('http') && (str.includes('.jpg') || str.includes('.png') || str.includes('.webp') || str.includes('/uploads/'))) && !str.startsWith('data:image/');
              });
              if (entries.length === 0) return null;
              return (
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px', fontWeight: '600' }}>Custom Fields</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                    {entries.map(([key, val]) => (
                      <div key={key} style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', padding: '6px 8px' }}>
                        <span style={{ color: 'var(--primary)', display: 'block', fontSize: '0.68rem', marginBottom: '2px' }}>{key}</span>
                        <span style={{ color: '#fff' }}>{String(val)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Right: Live Card Preview */}
          {previewTemplate && (
            <div style={{ flex: 1, padding: '22px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {/* Front / Back toggle */}
              {previewTemplate.backImageUrl && (
                <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '4px' }}>
                  {(['front', 'back'] as const).map(side => (
                    <button
                      key={side}
                      onClick={() => onToggleSide(side)}
                      style={{
                        padding: '5px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: '600',
                        background: previewSide === side ? 'var(--primary)' : 'transparent',
                        color: previewSide === side ? '#fff' : 'var(--muted)',
                        transition: 'all 0.15s',
                      }}
                    >
                      {side.charAt(0).toUpperCase() + side.slice(1)}
                    </button>
                  ))}
                </div>
              )}

              {/* Canvas */}
              <CardLivePreview
                template={previewTemplate}
                cardholder={cardholder}
                side={previewSide}
              />
            </div>
          )}

          {/* No template state */}
          {!previewTemplate && !previewLoading && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: '0.85rem', padding: '32px' }}>
              {cardholder.resolvedTemplateId ? 'Could not load template preview.' : 'No template linked to this cardholder.'}
            </div>
          )}

          {previewLoading && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: '0.85rem', padding: '32px' }}>
              Loading preview…
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px 28px 22px', borderTop: '1px solid var(--glass-border)' }}>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
