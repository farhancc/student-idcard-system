import React from 'react';
import { Eye, Download, AlertCircle } from 'lucide-react';

export function OrderPDFCompilerCard({
  order,
  layoutConfig,
  updateLayoutConfig,
  showLayoutSettings,
  setShowLayoutSettings,
  openCompileWizard,
  handleCompilePdf,
  handleWhatsAppShare,
  pdfLoading
}: any) {
  return (
    <div className="glass-panel" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem' }}>
          ⚙ Print Layout Configuration
        </h3>
        <button
          type="button"
          onClick={() => setShowLayoutSettings(!showLayoutSettings)}
          style={{
            fontSize: '0.75rem', padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--glass-border)',
            background: showLayoutSettings ? 'rgba(99,102,241,0.15)' : 'transparent',
            color: showLayoutSettings ? 'var(--primary)' : 'var(--muted)', cursor: 'pointer',
          }}
        >
          {showLayoutSettings ? 'Collapse' : 'Expand'}
        </button>
      </div>

      {showLayoutSettings && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Paper Size</label>
              <select
                className="form-input"
                style={{ padding: '6px 10px', fontSize: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', color: 'var(--foreground)' }}
                value={layoutConfig.paperSize}
                onChange={e => updateLayoutConfig('paperSize', e.target.value)}
              >
                <option value="A3">A3 Sheet</option>
                <option value="A4">A4 Sheet</option>
                <option value="SRA3">SRA3 Sheet</option>
                <option value="13x19">13" x 19" Sheet</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Orientation</label>
              <select
                className="form-input"
                style={{ padding: '6px 10px', fontSize: '0.8rem', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', color: 'var(--foreground)' }}
                value={layoutConfig.orientation}
                onChange={e => updateLayoutConfig('orientation', e.target.value)}
              >
                <option value="PORTRAIT">Portrait</option>
                <option value="LANDSCAPE">Landscape</option>
              </select>
            </div>
            {([
              { label: 'Left Margin (pt)',   value: layoutConfig.marginLeft,   field: 'marginLeft' },
              { label: 'Top Margin (pt)',    value: layoutConfig.marginTop,    field: 'marginTop' },
              { label: 'Right Margin (pt)',  value: layoutConfig.marginRight,  field: 'marginRight' },
              { label: 'Bottom Margin (pt)', value: layoutConfig.marginBottom, field: 'marginBottom' },
              { label: 'Col Gap (pt)',       value: layoutConfig.colGap,       field: 'colGap' },
              { label: 'Row Gap (pt)',       value: layoutConfig.rowGap,       field: 'rowGap' },
              { label: 'Bleed (pt)',         value: layoutConfig.bleed,        field: 'bleed' },
            ] as const).map(({ label, value, field }) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{label}</label>
                <input
                  type="number" min={0} max={200}
                  className="form-input"
                  style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                  value={value}
                  onChange={e => updateLayoutConfig(field, Number(e.target.value))}
                />
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', gridColumn: 'span 2', marginTop: '4px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--muted)', cursor: 'pointer' }}>
                <input type="checkbox" checked={layoutConfig.cropMarks} onChange={e => updateLayoutConfig('cropMarks', e.target.checked)} style={{ cursor: 'pointer', accentColor: 'var(--primary)' }} />
                Crop Marks
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--muted)', cursor: 'pointer' }}>
                <input type="checkbox" checked={layoutConfig.foldLine} onChange={e => updateLayoutConfig('foldLine', e.target.checked)} style={{ cursor: 'pointer', accentColor: 'var(--primary)' }} />
                Fold Lines
              </label>
            </div>
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--muted)', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px' }}>
            Default: Margins 40 pt · Col/Row Gap 15 pt · Bleed 0 pt · Values in PDF points (1 pt ≈ 0.35 mm)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{ fontSize: '0.8rem', padding: '10px 14px', flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                onClick={() => openCompileWizard('PRODUCTION')}
                disabled={pdfLoading !== null}
              >
                Generate PDF Grid...
              </button>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button" className="btn btn-secondary"
                style={{ fontSize: '0.8rem', padding: '8px 12px', flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                onClick={() => handleCompilePdf('INDIVIDUAL')}
                disabled={pdfLoading !== null}
              >
                Compile CR-80 Cards
              </button>
              <button
                type="button" className="btn btn-secondary"
                style={{ fontSize: '0.8rem', padding: '8px 12px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                onClick={handleWhatsAppShare}
              >
                Share Proofs Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
