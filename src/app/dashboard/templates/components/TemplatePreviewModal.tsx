'use client';
import React from 'react';
import { Maximize2, Minimize2, X } from 'lucide-react';
import CardPreview from '@/app/components/CardPreview';

interface TemplatePreviewModalProps {
  template: any;
  previewSide: string;
  isFullView: boolean;
  pressFonts: any[];
  onClose: () => void;
  onToggleSide: () => void;
  onToggleFullView: () => void;
}

export default function TemplatePreviewModal({
  template,
  previewSide,
  isFullView,
  pressFonts,
  onClose,
  onToggleSide,
  onToggleFullView,
}: TemplatePreviewModalProps) {
  if (!template) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel"
        style={{
          width: isFullView ? '96vw' : '90%',
          maxWidth: isFullView ? '1350px' : '780px',
          maxHeight: isFullView ? '95vh' : '90vh',
          textAlign: 'center',
          position: 'relative',
          padding: '24px',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          transition: 'all 0.25s ease-in-out',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ position: 'absolute', top: '16px', right: '16px', display: 'flex', gap: '8px' }}>
          <button
            className="btn btn-secondary"
            style={{
              padding: '6px 12px',
              borderRadius: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.75rem',
              cursor: 'pointer',
            }}
            onClick={onToggleFullView}
            title={isFullView ? "Exit Fullscreen" : "Fullscreen View"}
          >
            {isFullView ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            {isFullView ? 'Normal' : 'Fullscreen'}
          </button>
          <button
            className="btn btn-secondary"
            style={{
              padding: '6px',
              minWidth: 'auto',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            onClick={onClose}
            title="Close Preview (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        <h3 style={{ marginBottom: '16px', marginTop: '4px', fontSize: '1.2rem', fontWeight: '600' }}>
          Template Visual Preview ({previewSide.toUpperCase()})
        </h3>
        
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.5)',
          padding: '20px',
          borderRadius: '12px',
          marginBottom: '20px',
          border: '1px solid var(--glass-border)',
          overflow: 'hidden'
        }}>
          <CardPreview
            template={template}
            side={previewSide as any}
            pressFonts={pressFonts as any}
            forceWeb={true}
            style={{ maxWidth: '100%', maxHeight: isFullView ? '75vh' : '520px', objectFit: 'contain', borderRadius: '8px' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button className="btn btn-secondary" onClick={onToggleSide}>
            Switch to {previewSide === 'front' ? 'Back' : 'Front'}
          </button>
          <button className="btn btn-primary" onClick={onClose}>Close Preview</button>
        </div>
      </div>
    </div>
  );
}
