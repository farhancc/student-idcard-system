import React from 'react';
import Image from 'next/image';
import { Loader2 } from 'lucide-react';

export function GlobalTemplatesTab({
  templatesLoading,
  globalTemplates,
  handleEditTemplateClick,
  handleDeleteTemplate
}: any) {
  return (
    <>
      {/* Starter Templates Grid */}
      {templatesLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', flexDirection: 'column', gap: '12px' }}>
          <Loader2 size={36} className="spinner" />
          <p>Loading starter templates...</p>
        </div>
      ) : globalTemplates.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)', border: '1px dashed var(--glass-border)', borderRadius: '12px' }}>
          No starter templates uploaded yet. Click "Add Starter Template" to create one.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
          {globalTemplates.map((tmpl: any) => (
            <div key={tmpl.id} className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '16px', border: '1px solid var(--glass-border)' }}>
              {/* Preview Image */}
              <div style={{ position: 'relative', width: '100%', paddingBottom: '63%', background: 'rgba(3,4,7,0.4)', borderRadius: '8px', overflow: 'hidden', marginBottom: '16px', border: '1px solid var(--glass-border)' }}>
                {tmpl.frontImageUrl ? (
                  <Image 
                    src={tmpl.frontImageUrl} 
                    alt={tmpl.name} 
                    fill
                    unoptimized
                    style={{ objectFit: 'contain' }}
                  />
                ) : (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: '0.8rem' }}>
                    No Front Preview
                  </div>
                )}
              </div>

              <h4 style={{ margin: '0 0 4px 0', color: '#ffffff', fontSize: '1rem', fontWeight: '600' }}>{tmpl.name}</h4>
              <p style={{ margin: '0 0 16px 0', color: 'var(--muted)', fontSize: '0.8rem' }}>
                {tmpl.cardWidth}x{tmpl.cardHeight} px | {tmpl.backImageUrl ? 'Double-sided' : 'Single-sided'}
              </p>

              <div style={{ display: 'flex', gap: '12px', marginTop: 'auto' }}>
                <button
                  className="btn btn-secondary"
                  style={{ flex: 1, padding: '6px 12px', fontSize: '0.8rem', background: 'rgba(99,102,241,0.15)', color: 'var(--primary)', borderColor: 'rgba(99,102,241,0.3)' }}
                  onClick={() => handleEditTemplateClick(tmpl)}
                >
                  Edit
                </button>
                <button
                  className="btn btn-danger"
                  style={{ flex: 1, padding: '6px 12px', fontSize: '0.8rem' }}
                  onClick={() => handleDeleteTemplate(tmpl.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
