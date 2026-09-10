import React from 'react';
import { Copy, Trash2, X, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import { FieldCoordinate } from '@/lib/pdf/card-renderer-client';

export interface FieldTooltipProps {
  side: 'front' | 'back';
  index: number;
  field: FieldCoordinate;
  scale: number;
  yOffsets: Map<number, number>;
  cardHeight: number;
  pressFonts: any[];
  zoom: number;
  onUpdate: (updatedProps: Partial<FieldCoordinate>) => void;
  onDelete: () => void;
  onClose: () => void;
  onCopy: (side: 'front' | 'back', index: number) => void;
  getFieldSelfOverflow: (f: FieldCoordinate) => number;
}

export default function FieldTooltip({
  side,
  index,
  field: f,
  scale,
  yOffsets,
  cardHeight,
  pressFonts,
  zoom,
  onUpdate,
  onDelete,
  onClose,
  onCopy,
  getFieldSelfOverflow
}: FieldTooltipProps) {
  const isTextLike = f.type === 'text' || f.type === 'id' || f.type === 'date' || f.type === 'number';

  const x = f.x * scale;
  const yOffset = yOffsets.get(index) ?? 0;
  const y = (f.y + yOffset) * scale;
  const selfOverflow = getFieldSelfOverflow(f);
  const h = (f.height + selfOverflow) * scale;
  const isLowerHalf = y > (cardHeight * scale) / 2;

  const tooltipLeft = Math.max(0, Math.min(x, (480 * zoom) - 320));

  const handleStaticImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        onUpdate({ staticValue: event.target.result as string });
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        left: `${tooltipLeft}px`,
        ...(isLowerHalf ? {
          top: `${y - 8}px`,
          transform: 'translateY(-100%)',
        } : {
          top: `${y + h + 8}px`,
        }),
        width: '360px',
        background: 'rgba(15, 23, 42, 0.96)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: '8px',
        padding: '12px',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
        color: '#f8fafc',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '0.8rem',
      }}
    >
      {/* Header / Title / Delete Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '6px' }}>
        <span style={{ fontWeight: 600, color: '#38bdf8' }}>Edit Field #{index + 1}</span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button 
            type="button" 
            onClick={() => onCopy(side, index)}
            style={{ 
              background: '#10b981', 
              border: 'none', 
              borderRadius: '4px', 
              color: '#ffffff', 
              padding: '2px 6px', 
              fontSize: '0.7rem', 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '4px',
              fontWeight: 500
            }}
          >
            <Copy size={10} /> Copy
          </button>
          <button 
            type="button" 
            onClick={onDelete}
            style={{ 
              background: '#ef4444', 
              border: 'none', 
              borderRadius: '4px', 
              color: '#ffffff', 
              padding: '2px 6px', 
              fontSize: '0.7rem', 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '4px',
              fontWeight: 500
            }}
          >
            <Trash2 size={10} /> Delete
          </button>
          <button 
            type="button" 
            onClick={onClose}
            style={{ 
              background: 'rgba(255,255,255,0.1)', 
              border: 'none', 
              borderRadius: '4px', 
              color: '#ffffff', 
              padding: '2px 6px', 
              fontSize: '0.7rem', 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '4px',
              fontWeight: 500
            }}
            title="Close Editor"
          >
            <X size={12} /> Close
          </button>
        </div>
      </div>

      {/* Field Name & Type Row */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Field Name</label>
          <input 
            type="text" 
            value={f.field} 
            onChange={(e) => onUpdate({ field: e.target.value })}
            style={{ 
              background: '#1e293b', 
              border: '1px solid rgba(255,255,255,0.1)', 
              borderRadius: '4px', 
              color: '#ffffff', 
              padding: '4px 6px', 
              fontSize: '0.75rem' 
            }}
          />
        </div>
        <div style={{ width: '110px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Type</label>
          <select 
            value={f.type} 
            onChange={(e) => {
              const newType = e.target.value as any;
              const updates: Partial<FieldCoordinate> = { type: newType };
              if (newType === 'image') {
                updates.borderRadius = 0;
              }
              onUpdate(updates);
            }}
            style={{ 
              background: '#1e293b', 
              border: '1px solid rgba(255,255,255,0.1)', 
              borderRadius: '4px', 
              color: '#ffffff', 
              padding: '4px 6px', 
              fontSize: '0.75rem',
              width: '100%'
            }}
          >
            <option style={{ background: '#1e293b', color: '#ffffff' }} value="text">Text</option>
            <option style={{ background: '#1e293b', color: '#ffffff' }} value="number">Number</option>
            <option style={{ background: '#1e293b', color: '#ffffff' }} value="date">Date</option>
            <option style={{ background: '#1e293b', color: '#ffffff' }} value="image">Image</option>
            <option style={{ background: '#1e293b', color: '#ffffff' }} value="qr">QR Code</option>
            <option style={{ background: '#1e293b', color: '#ffffff' }} value="barcode">Barcode</option>
            <option style={{ background: '#1e293b', color: '#ffffff' }} value="id">ID/Serial</option>
          </select>
        </div>
      </div>

      {/* Dimensions & Position Row (X, Y, Width, Height) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '0.65rem', color: '#94a3b8' }}>X (px)</label>
          <input 
            type="number" 
            value={Math.round(f.x)} 
            onChange={(e) => onUpdate({ x: Number(e.target.value) })}
            style={{ 
              background: '#1e293b', 
              border: '1px solid rgba(255,255,255,0.1)', 
              borderRadius: '4px', 
              color: '#ffffff', 
              padding: '4px', 
              fontSize: '0.75rem',
              width: '100%',
              textAlign: 'center'
            }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Y (px)</label>
          <input 
            type="number" 
            value={Math.round(f.y)} 
            onChange={(e) => onUpdate({ y: Number(e.target.value) })}
            style={{ 
              background: '#1e293b', 
              border: '1px solid rgba(255,255,255,0.1)', 
              borderRadius: '4px', 
              color: '#ffffff', 
              padding: '4px', 
              fontSize: '0.75rem',
              width: '100%',
              textAlign: 'center'
            }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '0.65rem', color: '#94a3b8' }}>W (px)</label>
          <input 
            type="number" 
            value={Math.round(f.width)} 
            onChange={(e) => onUpdate({ width: Number(e.target.value) })}
            style={{ 
              background: '#1e293b', 
              border: '1px solid rgba(255,255,255,0.1)', 
              borderRadius: '4px', 
              color: '#ffffff', 
              padding: '4px', 
              fontSize: '0.75rem',
              width: '100%',
              textAlign: 'center'
            }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '0.65rem', color: '#94a3b8' }}>H (px)</label>
          <input 
            type="number" 
            value={Math.round(f.height)} 
            onChange={(e) => onUpdate({ height: Number(e.target.value) })}
            style={{ 
              background: '#1e293b', 
              border: '1px solid rgba(255,255,255,0.1)', 
              borderRadius: '4px', 
              color: '#ffffff', 
              padding: '4px', 
              fontSize: '0.75rem',
              width: '100%',
              textAlign: 'center'
            }}
          />
        </div>
      </div>

      {/* Static Value Toggle & Input */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input 
            type="checkbox" 
            id={`static-toggle-${side}-${index}`}
            checked={f.staticValue !== undefined && f.staticValue !== null}
            onChange={(e) => {
              if (e.target.checked) {
                onUpdate({ staticValue: f.type === 'image' ? '' : 'Static Text' });
              } else {
                onUpdate({ staticValue: undefined });
              }
            }}
            style={{ cursor: 'pointer' }}
          />
          <label htmlFor={`static-toggle-${side}-${index}`} style={{ fontSize: '0.7rem', color: '#e2e8f0', fontWeight: 500, cursor: 'pointer' }}>
            Static / Non-Editable Content
          </label>
        </div>

        {f.staticValue !== undefined && f.staticValue !== null && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {f.type === 'image' ? (
              <>
                <label style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Static Image Source</label>
                <input 
                  type="text" 
                  value={f.staticValue} 
                  onChange={(e) => onUpdate({ staticValue: e.target.value })}
                  placeholder="Paste image URL..."
                  style={{ 
                    background: '#1e293b', 
                    border: '1px solid rgba(255,255,255,0.1)', 
                    borderRadius: '4px', 
                    color: '#ffffff', 
                    padding: '4px 6px', 
                    fontSize: '0.75rem' 
                  }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                  <span style={{ fontSize: '0.65rem', color: '#64748b' }}>Or upload:</span>
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={handleStaticImageUpload}
                    style={{ fontSize: '0.65rem', color: '#94a3b8', width: '150px' }}
                  />
                </div>
              </>
            ) : (
              <>
                <label style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Static Text Value</label>
                <input 
                  type="text" 
                  value={f.staticValue} 
                  onChange={(e) => onUpdate({ staticValue: e.target.value })}
                  placeholder="Enter static text..."
                  style={{ 
                    background: '#1e293b', 
                    border: '1px solid rgba(255,255,255,0.1)', 
                    borderRadius: '4px', 
                    color: '#ffffff', 
                    padding: '4px 6px', 
                    fontSize: '0.75rem' 
                  }}
                />
              </>
            )}
          </div>
        )}
      </div>

      {/* Typography Styles (Only for Text / ID) */}
      {isTextLike && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '8px' }}>
          {/* Font Family */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Font Family</label>
            <select
              value={f.fontFamily || 'sans-serif'}
              onChange={(e) => onUpdate({ fontFamily: e.target.value })}
              style={{ 
                background: '#1e293b', 
                border: '1px solid rgba(255,255,255,0.1)', 
                borderRadius: '4px', 
                color: '#ffffff', 
                padding: '4px 6px', 
                fontSize: '0.75rem',
                width: '100%'
              }}
            >
              <optgroup label="System Fonts" style={{ background: '#1e293b', color: '#ffffff' }}>
                <option style={{ background: '#1e293b', color: '#ffffff' }} value="sans-serif">Sans-Serif</option>
                <option style={{ background: '#1e293b', color: '#ffffff' }} value="serif">Serif</option>
                <option style={{ background: '#1e293b', color: '#ffffff' }} value="monospace">Monospace</option>
                <option style={{ background: '#1e293b', color: '#ffffff' }} value="Arial">Arial</option>
                <option style={{ background: '#1e293b', color: '#ffffff' }} value="Times New Roman">Times New Roman</option>
                <option style={{ background: '#1e293b', color: '#ffffff' }} value="Courier New">Courier New</option>
              </optgroup>
              {pressFonts && pressFonts.length > 0 && (
                <optgroup label="Custom Fonts" style={{ background: '#1e293b', color: '#ffffff' }}>
                  {pressFonts.map((pf) => (
                    <option 
                      key={pf.id} 
                      style={{ background: '#1e293b', color: '#ffffff' }} 
                      value={pf.name}
                    >
                      {pf.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          {/* Font Size & Weight */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Font Size (pt)</label>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => onUpdate({ fontSize: Math.max(6, (f.fontSize || 18) - 1) })}
                  style={{
                    background: '#334155',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '4px 0 0 4px',
                    color: '#ffffff',
                    width: '24px',
                    height: '24px',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  -
                </button>
                <input
                  type="number"
                  value={f.fontSize || 18}
                  onChange={(e) => onUpdate({ fontSize: Number(e.target.value) })}
                  style={{
                    background: '#1e293b',
                    borderTop: '1px solid rgba(255,255,255,0.1)',
                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                    borderLeft: 'none',
                    borderRight: 'none',
                    color: '#ffffff',
                    width: '36px',
                    height: '24px',
                    textAlign: 'center',
                    fontSize: '0.75rem',
                    MozAppearance: 'textfield'
                  }}
                />
                <button
                  type="button"
                  onClick={() => onUpdate({ fontSize: (f.fontSize || 18) + 1 })}
                  style={{
                    background: '#334155',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '0 4px 4px 0',
                    color: '#ffffff',
                    width: '24px',
                    height: '24px',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  +
                </button>
              </div>
            </div>

            <div style={{ width: '110px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Weight</label>
              <select
                value={f.fontWeight || 'normal'}
                onChange={(e) => onUpdate({ fontWeight: e.target.value as any })}
                style={{ 
                  background: '#1e293b', 
                  border: '1px solid rgba(255,255,255,0.1)', 
                  borderRadius: '4px', 
                  color: '#ffffff', 
                  padding: '4px 6px', 
                  fontSize: '0.75rem',
                  width: '100%'
                }}
              >
                <option style={{ background: '#1e293b', color: '#ffffff' }} value="100">Thin (100)</option>
                <option style={{ background: '#1e293b', color: '#ffffff' }} value="200">Extra-Light (200)</option>
                <option style={{ background: '#1e293b', color: '#ffffff' }} value="300">Light (300)</option>
                <option style={{ background: '#1e293b', color: '#ffffff' }} value="normal">Regular (400)</option>
                <option style={{ background: '#1e293b', color: '#ffffff' }} value="500">Medium (500)</option>
                <option style={{ background: '#1e293b', color: '#ffffff' }} value="600">Semi-Bold (600)</option>
                <option style={{ background: '#1e293b', color: '#ffffff' }} value="bold">Bold (700)</option>
                <option style={{ background: '#1e293b', color: '#ffffff' }} value="800">Extra-Bold (800)</option>
                <option style={{ background: '#1e293b', color: '#ffffff' }} value="900">Black (900)</option>
              </select>
            </div>
          </div>

          {/* Min / Max Cap (only for number type) */}
          {f.type === 'number' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Min Cap</label>
                <input
                  type="number"
                  value={f.min !== undefined && f.min !== null ? f.min : ''}
                  placeholder="Min"
                  onChange={(e) => onUpdate({ min: e.target.value === '' ? undefined : Number(e.target.value) })}
                  style={{
                    background: '#1e293b',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '4px',
                    color: '#ffffff',
                    padding: '4px 6px',
                    fontSize: '0.75rem',
                    width: '100%'
                  }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Max Cap</label>
                <input
                  type="number"
                  value={f.max !== undefined && f.max !== null ? f.max : ''}
                  placeholder="Max"
                  onChange={(e) => onUpdate({ max: e.target.value === '' ? undefined : Number(e.target.value) })}
                  style={{
                    background: '#1e293b',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '4px',
                    color: '#ffffff',
                    padding: '4px 6px',
                    fontSize: '0.75rem',
                    width: '100%'
                  }}
                />
              </div>
            </div>
          )}

          {/* Date Format (only for date type) */}
          {f.type === 'date' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Date Format</label>
              <select
                value={f.dateFormat || 'DD/MM/YYYY'}
                onChange={(e) => onUpdate({ dateFormat: e.target.value })}
                style={{
                  background: '#1e293b',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '4px',
                  color: '#ffffff',
                  padding: '4px 6px',
                  fontSize: '0.75rem',
                  width: '100%'
                }}
              >
                <option style={{ background: '#1e293b', color: '#ffffff' }} value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option style={{ background: '#1e293b', color: '#ffffff' }} value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option style={{ background: '#1e293b', color: '#ffffff' }} value="YYYY-MM-DD">YYYY-MM-DD</option>
                <option style={{ background: '#1e293b', color: '#ffffff' }} value="DD-MM-YYYY">DD-MM-YYYY</option>
                <option style={{ background: '#1e293b', color: '#ffffff' }} value="DD.MM.YYYY">DD.MM.YYYY</option>
                <option style={{ background: '#1e293b', color: '#ffffff' }} value="DD-MMM-YYYY">DD-MMM-YYYY</option>
                <option style={{ background: '#1e293b', color: '#ffffff' }} value="DD MMM YYYY">DD MMM YYYY</option>
                <option style={{ background: '#1e293b', color: '#ffffff' }} value="DD MMMM YYYY">DD MMMM YYYY</option>
                <option style={{ background: '#1e293b', color: '#ffffff' }} value="D MMM YYYY">D MMM YYYY</option>
                <option style={{ background: '#1e293b', color: '#ffffff' }} value="MMM DD, YYYY">MMM DD, YYYY</option>
                <option style={{ background: '#1e293b', color: '#ffffff' }} value="MMMM DD, YYYY">MMMM DD, YYYY</option>
                <option style={{ background: '#1e293b', color: '#ffffff' }} value="YYYY/MM/DD">YYYY/MM/DD</option>
                <option style={{ background: '#1e293b', color: '#ffffff' }} value="DD/MM/YY">DD/MM/YY</option>
                <option style={{ background: '#1e293b', color: '#ffffff' }} value="MM/DD/YY">MM/DD/YY</option>
                <option style={{ background: '#1e293b', color: '#ffffff' }} value="DD-MM-YY">DD-MM-YY</option>
                <option style={{ background: '#1e293b', color: '#ffffff' }} value="DD.MM.YY">DD.MM.YY</option>
                <option style={{ background: '#1e293b', color: '#ffffff' }} value="DD-MMM-YY">DD-MMM-YY</option>
                <option style={{ background: '#1e293b', color: '#ffffff' }} value="MM/YY">MM/YY</option>
                <option style={{ background: '#1e293b', color: '#ffffff' }} value="MM/YYYY">MM/YYYY</option>
                <option style={{ background: '#1e293b', color: '#ffffff' }} value="MMM YYYY">MMM YYYY</option>
                <option style={{ background: '#1e293b', color: '#ffffff' }} value="MMMM YYYY">MMMM YYYY</option>
                <option style={{ background: '#1e293b', color: '#ffffff' }} value="YYYY">YYYY (Year only)</option>
              </select>
            </div>
          )}

          {/* Color & Background Color row */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Color</label>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <input
                  type="color"
                  value={f.color || '#000000'}
                  onChange={(e) => onUpdate({ color: e.target.value })}
                  style={{
                    width: '28px',
                    height: '24px',
                    border: 'none',
                    padding: 0,
                    background: 'transparent',
                    cursor: 'pointer'
                  }}
                />
                <input
                  type="text"
                  value={f.color || '#000000'}
                  onChange={(e) => onUpdate({ color: e.target.value })}
                  style={{
                    background: '#1e293b',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '4px',
                    color: '#ffffff',
                    padding: '3px 6px',
                    fontSize: '0.7rem',
                    width: '60px',
                    textTransform: 'uppercase'
                  }}
                />
              </div>
            </div>

            {/* Background Color */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Bg Color</label>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <input
                  type="color"
                  value={f.backgroundColor && f.backgroundColor !== 'transparent' ? f.backgroundColor : '#ffffff'}
                  onChange={(e) => onUpdate({ backgroundColor: e.target.value })}
                  style={{
                    width: '28px',
                    height: '24px',
                    border: 'none',
                    padding: 0,
                    background: 'transparent',
                    cursor: 'pointer',
                    opacity: (f.backgroundColor && f.backgroundColor !== 'transparent') ? 1 : 0.3,
                  }}
                />
                <button
                  type="button"
                  title={f.backgroundColor && f.backgroundColor !== 'transparent' ? 'Clear background' : 'No background set'}
                  onClick={() => onUpdate({ backgroundColor: f.backgroundColor && f.backgroundColor !== 'transparent' ? 'transparent' : '#ffffff' })}
                  style={{
                    background: f.backgroundColor && f.backgroundColor !== 'transparent' ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '4px',
                    color: f.backgroundColor && f.backgroundColor !== 'transparent' ? '#ef4444' : '#64748b',
                    padding: '2px 5px',
                    fontSize: '0.65rem',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {f.backgroundColor && f.backgroundColor !== 'transparent' ? '✕ Clear' : 'None'}
                </button>
              </div>
            </div>
          </div>

          {/* H Align & V Align row */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.65rem', color: '#94a3b8' }}>H Align</label>
              <div style={{ display: 'flex', background: '#1e293b', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', padding: '2px' }}>
                <button
                  type="button"
                  onClick={() => onUpdate({ align: 'left' })}
                  style={{
                    background: f.align === 'left' || !f.align ? '#3b82f6' : 'transparent',
                    border: 'none',
                    borderRadius: '2px',
                    color: '#ffffff',
                    padding: '2px 6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <AlignLeft size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => onUpdate({ align: 'center' })}
                  style={{
                    background: f.align === 'center' ? '#3b82f6' : 'transparent',
                    border: 'none',
                    borderRadius: '2px',
                    color: '#ffffff',
                    padding: '2px 6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <AlignCenter size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => onUpdate({ align: 'right' })}
                  style={{
                    background: f.align === 'right' ? '#3b82f6' : 'transparent',
                    border: 'none',
                    borderRadius: '2px',
                    color: '#ffffff',
                    padding: '2px 6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <AlignRight size={12} />
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.65rem', color: '#94a3b8' }}>V Align</label>
              <div style={{ display: 'flex', background: '#1e293b', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', padding: '2px' }}>
                <button
                  type="button"
                  onClick={() => onUpdate({ verticalAlign: 'top' })}
                  style={{
                    background: f.verticalAlign === 'top' || !f.verticalAlign ? '#3b82f6' : 'transparent',
                    border: 'none',
                    borderRadius: '2px',
                    color: '#ffffff',
                    padding: '2px 6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  title="Align Top"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="3" y1="3" x2="21" y2="3" />
                    <rect x="6" y="8" width="12" height="13" rx="2" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => onUpdate({ verticalAlign: 'center' })}
                  style={{
                    background: f.verticalAlign === 'center' ? '#3b82f6' : 'transparent',
                    border: 'none',
                    borderRadius: '2px',
                    color: '#ffffff',
                    padding: '2px 6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  title="Align Center"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <rect x="6" y="5" width="12" height="4" rx="1" />
                    <rect x="6" y="15" width="12" height="4" rx="1" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => onUpdate({ verticalAlign: 'bottom' })}
                  style={{
                    background: f.verticalAlign === 'bottom' ? '#3b82f6' : 'transparent',
                    border: 'none',
                    borderRadius: '2px',
                    color: '#ffffff',
                    padding: '2px 6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  title="Align Bottom"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="3" y1="21" x2="21" y2="21" />
                    <rect x="6" y="3" width="12" height="13" rx="2" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Text Style Toggles */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ display: 'flex', background: '#1e293b', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', padding: '2px', width: '100%', justifyContent: 'space-around' }}>
              <button
                type="button"
                onClick={() => onUpdate({ fontStyle: f.fontStyle === 'italic' ? 'normal' : 'italic' })}
                style={{
                  background: f.fontStyle === 'italic' ? '#3b82f6' : 'transparent',
                  border: 'none',
                  borderRadius: '4px',
                  color: '#ffffff',
                  padding: '4px 8px',
                  cursor: 'pointer',
                  fontSize: '0.7rem',
                  fontWeight: 'italic',
                  flex: 1,
                  textAlign: 'center'
                }}
              >
                Italic
              </button>
              <button
                type="button"
                onClick={() => onUpdate({ textDecoration: f.textDecoration === 'underline' ? 'none' : 'underline' })}
                style={{
                  background: f.textDecoration === 'underline' ? '#3b82f6' : 'transparent',
                  border: 'none',
                  borderRadius: '4px',
                  color: '#ffffff',
                  padding: '4px 8px',
                  cursor: 'pointer',
                  fontSize: '0.7rem',
                  textDecoration: 'underline',
                  flex: 1,
                  textAlign: 'center'
                }}
              >
                Underline
              </button>
              <button
                type="button"
                onClick={() => onUpdate({ textTransform: f.textTransform === 'uppercase' ? 'none' : 'uppercase' })}
                style={{
                  background: f.textTransform === 'uppercase' ? '#3b82f6' : 'transparent',
                  border: 'none',
                  borderRadius: '4px',
                  color: '#ffffff',
                  padding: '4px 8px',
                  cursor: 'pointer',
                  fontSize: '0.7rem',
                  flex: 1,
                  textAlign: 'center'
                }}
              >
                Uppercase
              </button>
            </div>
          </div>

          {/* Prefix/Suffix */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Prefix</label>
              <input 
                type="text" 
                value={f.prefix || ''} 
                onChange={(e) => onUpdate({ prefix: e.target.value })}
                placeholder="e.g. Roll No: "
                style={{ 
                  background: '#1e293b', 
                  border: '1px solid rgba(255,255,255,0.1)', 
                  borderRadius: '4px', 
                  color: '#ffffff', 
                  padding: '4px 6px', 
                  fontSize: '0.75rem' 
                }}
              />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Suffix</label>
              <input 
                type="text" 
                value={f.suffix || ''} 
                onChange={(e) => onUpdate({ suffix: e.target.value })}
                placeholder="e.g. /-"
                style={{ 
                  background: '#1e293b', 
                  border: '1px solid rgba(255,255,255,0.1)', 
                  borderRadius: '4px', 
                  color: '#ffffff', 
                  padding: '4px 6px', 
                  fontSize: '0.75rem' 
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Image Corner Radius (Only for Image) */}
      {f.type === 'image' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '8px' }}>
          <label style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Corner Radius (px)</label>
          <input 
            type="number" 
            value={f.borderRadius || 0} 
            onChange={(e) => onUpdate({ borderRadius: Number(e.target.value) })}
            style={{ 
              background: '#1e293b', 
              border: '1px solid rgba(255,255,255,0.1)', 
              borderRadius: '4px', 
              color: '#ffffff', 
              padding: '4px 6px', 
              fontSize: '0.75rem' 
            }}
          />
        </div>
      )}
    </div>
  );
}
