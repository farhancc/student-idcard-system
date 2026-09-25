import React from 'react';
import { formatFieldLabel } from '@/lib/pdf/card-renderer-client';
import { groupSelectableFonts } from '@/lib/fontLibrary';

interface FieldCoordinate {
  field: string;
  type: 'text' | 'image' | 'qr' | 'barcode' | 'id' | 'date' | 'number';
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number;
  fontWeight?: string | number;
  color?: string;
  fontFamily?: string;
  align?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'center' | 'bottom';
  borderRadius?: number;
  backgroundColor?: string;
  letterSpacing?: number;
  lineHeight?: number;
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  opacity?: number;
  prefix?: string;
  suffix?: string;
  fontStyle?: 'normal' | 'italic';
  textDecoration?: 'none' | 'underline' | 'line-through';
  min?: number;
  max?: number;
  dateFormat?: string;
}

interface CoordinateTableProps {
  fields: FieldCoordinate[];
  side: 'front' | 'back';
  selectedFieldIndex: number | null;
  selectedSide: 'front' | 'back' | null;
  setSelectedFieldIndex: (idx: number | null) => void;
  setSelectedSide: (side: 'front' | 'back' | null) => void;
  onFieldChange: (side: 'front' | 'back', index: number, key: keyof FieldCoordinate, val: any) => void;
  onRemoveField: (side: 'front' | 'back', index: number) => void;
  pressFonts: any[];
  getFontFamily: (fontName?: string) => string;
  setActiveTooltipIndex: (idx: number | null) => void;
  setActiveTooltipSide: (side: 'front' | 'back' | null) => void;
}

export default function CoordinateTable({
  fields,
  side,
  selectedFieldIndex,
  selectedSide,
  setSelectedFieldIndex,
  setSelectedSide,
  onFieldChange,
  onRemoveField,
  pressFonts,
  getFontFamily,
  setActiveTooltipIndex,
  setActiveTooltipSide
}: CoordinateTableProps) {
  if (fields.length === 0) return null;
  const selectableFonts = groupSelectableFonts(pressFonts);

  return (
                    <div className="table-container">
                      <table className="custom-table" style={{ fontSize: '0.8rem' }}>
                        <thead>
                          <tr>
                            <th>Field Name</th>
                            <th>Type</th>
                            <th>X (px)</th>
                            <th>Y (px)</th>
                            <th>W (px)</th>
                            <th>H (px)</th>
                            <th>Options (Font/Size/Color/Radius)</th>
                            <th>Remove</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fields.map((f, i) => (
                            <tr key={i} style={{ background: selectedFieldIndex === i && selectedSide === side ? 'rgba(59, 130, 246, 0.1)' : 'transparent' }} onClick={() => { setSelectedFieldIndex(i); setSelectedSide(side); }}>
                              <td>
                                <input id={`${side}-field-name-${i}`} type="text" className="form-input" style={{ padding: '6px 10px', fontSize: '0.8rem' }} value={f.field} onChange={e => onFieldChange(side, i, 'field', e.target.value)} onClick={e => e.stopPropagation()} />
                              </td>
                              <td>
                                <select className="form-select" style={{ padding: '6px 10px', fontSize: '0.8rem' }} value={f.type} onChange={e => onFieldChange(side, i, 'type', e.target.value)}>
                                  <option value="text">Text Field</option>
                                  <option value="number">Number Field</option>
                                  <option value="date">Date Field</option>
                                  <option value="image">Photo / Image</option>
                                  <option value="qr">QR Code</option>
                                  <option value="barcode">Barcode</option>
                                  <option value="id">ID / Serial Field</option>
                                </select>
                              </td>
                              <td><input type="number" className="form-input" style={{ padding: '6px 10px', fontSize: '0.8rem', width: '70px' }} value={f.x} onChange={e => onFieldChange(side, i, 'x', Number(e.target.value))} /></td>
                              <td><input type="number" className="form-input" style={{ padding: '6px 10px', fontSize: '0.8rem', width: '70px' }} value={f.y} onChange={e => onFieldChange(side, i, 'y', Number(e.target.value))} /></td>
                              <td><input type="number" className="form-input" style={{ padding: '6px 10px', fontSize: '0.8rem', width: '70px' }} value={f.width} onChange={e => onFieldChange(side, i, 'width', Number(e.target.value))} /></td>
                              <td><input type="number" className="form-input" style={{ padding: '6px 10px', fontSize: '0.8rem', width: '70px' }} value={f.height} onChange={e => onFieldChange(side, i, 'height', Number(e.target.value))} /></td>
                              <td>
                                {(f.type === 'text' || f.type === 'id' || f.type === 'date' || f.type === 'number') ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                    {/* Row 1: Size · Color · Align */}
                                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
                                      <input type="number" className="form-input" style={{ padding: '4px', fontSize: '0.75rem', width: '44px' }} placeholder="Sz" value={f.fontSize || 16} onChange={e => onFieldChange(side, i, 'fontSize', Number(e.target.value))} />
                                      <input type="color" title="Text colour" style={{ padding: '2px', height: '28px', width: '36px', border: '1px solid var(--glass-border)', borderRadius: '4px', background: 'transparent', cursor: 'pointer' }} value={f.color || '#000000'} onChange={e => onFieldChange(side, i, 'color', e.target.value)} />
                                      <select className="form-select" title="Horizontal Align" style={{ padding: '4px', fontSize: '0.75rem', width: '72px' }} value={f.align || 'left'} onChange={e => onFieldChange(side, i, 'align', e.target.value)}>
                                        <option value="left">Left</option>
                                        <option value="center">Center</option>
                                        <option value="right">Right</option>
                                      </select>
                                      <select className="form-select" title="Vertical Align" style={{ padding: '4px', fontSize: '0.75rem', width: '80px' }} value={f.verticalAlign || 'top'} onChange={e => onFieldChange(side, i, 'verticalAlign', e.target.value)}>
                                        <option value="top">Top</option>
                                        <option value="center">Center</option>
                                        <option value="bottom">Bottom</option>
                                      </select>
                                    </div>
                                    {/* Row 2: Font family & Basic Styles */}
                                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
                                      <select className="form-select" style={{ padding: '4px', fontSize: '0.75rem', flex: 1, minWidth: '110px', fontFamily: getFontFamily(f.fontFamily) }} value={f.fontFamily || 'sans-serif'} onChange={e => onFieldChange(side, i, 'fontFamily', e.target.value)}>
                                        {selectableFonts.builtin.length > 0 && (
                                          <optgroup label="── Built-in Fonts">
                                            {selectableFonts.builtin.map(pf => (
                                              <option key={pf.id} value={pf.name} style={{ fontFamily: pf.name.replace(/\s+/g, '_') }}>
                                                {pf.name}
                                              </option>
                                            ))}
                                          </optgroup>
                                        )}
                                        {selectableFonts.custom.length > 0 && (
                                          <optgroup label="── My Custom Fonts">
                                            {selectableFonts.custom.map(pf => (
                                              <option key={pf.id} value={pf.name} style={{ fontFamily: pf.name.replace(/\s+/g, '_') }}>
                                                {pf.name}
                                              </option>
                                            ))}
                                          </optgroup>
                                        )}
                                        <optgroup label="── System">
                                          <option value="sans-serif">Default Sans</option>
                                          <option value="serif">Default Serif</option>
                                          <option value="monospace">Monospace</option>
                                          <option value="Arial">Arial</option>
                                          <option value="Georgia">Georgia</option>
                                          <option value="Verdana">Verdana</option>
                                          <option value="Times New Roman">Times New Roman</option>
                                          <option value="Impact">Impact</option>
                                        </optgroup>
                                      </select>
                                      <select className="form-select" title="Font Weight" style={{ padding: '4px', fontSize: '0.75rem', width: '85px' }} value={f.fontWeight || 'normal'} onChange={e => onFieldChange(side, i, 'fontWeight', e.target.value)}>
                                        <option value="100">100 - Thin</option>
                                        <option value="200">200 - ExLight</option>
                                        <option value="300">300 - Light</option>
                                        <option value="normal">400 - Normal</option>
                                        <option value="500">500 - Medium</option>
                                        <option value="600">600 - SemiBold</option>
                                        <option value="bold">700 - Bold</option>
                                        <option value="800">800 - ExBold</option>
                                        <option value="900">900 - Black</option>
                                      </select>
                                      <button type="button" title="Italic" onClick={() => onFieldChange(side, i, 'fontStyle', f.fontStyle === 'italic' ? 'normal' : 'italic')} style={{ padding: '3px 8px', fontSize: '0.8rem', fontStyle: 'italic', borderRadius: '4px', border: '1px solid var(--glass-border)', background: f.fontStyle === 'italic' ? 'var(--primary)' : 'transparent', color: f.fontStyle === 'italic' ? '#fff' : 'var(--muted)', cursor: 'pointer' }}>I</button>
                                      <button type="button" title="Underline" onClick={() => onFieldChange(side, i, 'textDecoration', f.textDecoration === 'underline' ? 'none' : 'underline')} style={{ padding: '3px 8px', fontSize: '0.8rem', textDecoration: 'underline', borderRadius: '4px', border: '1px solid var(--glass-border)', background: f.textDecoration === 'underline' ? 'var(--primary)' : 'transparent', color: f.textDecoration === 'underline' ? '#fff' : 'var(--muted)', cursor: 'pointer' }}>U</button>
                                      <button type="button" title="Strikethrough" onClick={() => onFieldChange(side, i, 'textDecoration', f.textDecoration === 'line-through' ? 'none' : 'line-through')} style={{ padding: '3px 8px', fontSize: '0.8rem', textDecoration: 'line-through', borderRadius: '4px', border: '1px solid var(--glass-border)', background: f.textDecoration === 'line-through' ? 'var(--primary)' : 'transparent', color: f.textDecoration === 'line-through' ? '#fff' : 'var(--muted)', cursor: 'pointer' }}>S</button>
                                    </div>
                                    {/* Row 3: Advanced formatting controls */}
                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                                      {(f.type === 'number' || f.type === 'text' || f.type === 'id' || !f.type) && (
                                        <div style={{ display: 'flex', gap: '4px' }}>
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                            <span style={{ fontSize: '0.6rem', color: 'var(--muted)' }}>Min Cap</span>
                                            <input type="number" className="form-input" style={{ padding: '4px', fontSize: '0.75rem', width: '55px' }} placeholder="Min" value={f.min ?? ''} onChange={e => onFieldChange(side, i, 'min', e.target.value === '' ? undefined : Number(e.target.value))} />
                                          </div>
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                            <span style={{ fontSize: '0.6rem', color: 'var(--muted)' }}>Max Cap</span>
                                            <input type="number" className="form-input" style={{ padding: '4px', fontSize: '0.75rem', width: '55px' }} placeholder="Max" value={f.max ?? ''} onChange={e => onFieldChange(side, i, 'max', e.target.value === '' ? undefined : Number(e.target.value))} />
                                          </div>
                                        </div>
                                      )}
                                      {f.type === 'date' && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                          <span style={{ fontSize: '0.6rem', color: 'var(--muted)' }}>Date Format</span>
                                          <select className="form-select" style={{ padding: '4px', fontSize: '0.7rem', width: '130px' }} value={f.dateFormat || 'DD/MM/YYYY'} onChange={e => onFieldChange(side, i, 'dateFormat', e.target.value)}>
                                            <option value="DD/MM/YYYY">DD/MM/YYYY (15/05/2002)</option>
                                            <option value="MM/DD/YYYY">MM/DD/YYYY (05/15/2002)</option>
                                            <option value="YYYY-MM-DD">YYYY-MM-DD (2002-05-15)</option>
                                            <option value="DD-MM-YYYY">DD-MM-YYYY (15-05-2002)</option>
                                            <option value="DD.MM.YYYY">DD.MM.YYYY (15.05.2002)</option>
                                            <option value="DD-MMM-YYYY">DD-MMM-YYYY (15-May-2002)</option>
                                            <option value="DD MMM YYYY">DD MMM YYYY (15 May 2002)</option>
                                            <option value="DD MMMM YYYY">DD MMMM YYYY (15 May 2002)</option>
                                            <option value="D MMM YYYY">D MMM YYYY (15 May 2002)</option>
                                            <option value="MMM DD, YYYY">MMM DD, YYYY (May 15, 2002)</option>
                                            <option value="MMMM DD, YYYY">MMMM DD, YYYY (May 15, 2002)</option>
                                            <option value="YYYY/MM/DD">YYYY/MM/DD (2002/05/15)</option>
                                            <option value="DD/MM/YY">DD/MM/YY (15/05/02)</option>
                                            <option value="MM/DD/YY">MM/DD/YY (05/15/02)</option>
                                            <option value="DD-MM-YY">DD-MM-YY (15-05-02)</option>
                                            <option value="DD.MM.YY">DD.MM.YY (15.05.02)</option>
                                            <option value="DD-MMM-YY">DD-MMM-YY (15-May-02)</option>
                                            <option value="MM/YY">MM/YY (05/02)</option>
                                            <option value="MM/YYYY">MM/YYYY (05/2002)</option>
                                            <option value="MMM YYYY">MMM YYYY (May 2002)</option>
                                            <option value="MMMM YYYY">MMMM YYYY (May 2002)</option>
                                            <option value="YYYY">YYYY (2002)</option>
                                          </select>
                                        </div>
                                      )}
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                        <span style={{ fontSize: '0.6rem', color: 'var(--muted)' }}>Letter Spacing</span>
                                        <input type="number" className="form-input" style={{ padding: '4px', fontSize: '0.75rem', width: '55px' }} min={-5} max={50} step={0.5} placeholder="0" value={f.letterSpacing ?? 0} onChange={e => onFieldChange(side, i, 'letterSpacing', Number(e.target.value))} />
                                      </div>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                        <span style={{ fontSize: '0.6rem', color: 'var(--muted)' }}>Line H</span>
                                        <input type="number" className="form-input" style={{ padding: '4px', fontSize: '0.75rem', width: '45px' }} min={0.5} max={5} step={0.1} placeholder="1.2" value={f.lineHeight ?? 1.2} onChange={e => onFieldChange(side, i, 'lineHeight', Number(e.target.value))} />
                                      </div>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                        <span style={{ fontSize: '0.6rem', color: 'var(--muted)' }}>Transform</span>
                                        <select className="form-select" style={{ padding: '4px', fontSize: '0.7rem', width: '85px' }} value={f.textTransform || 'none'} onChange={e => onFieldChange(side, i, 'textTransform', e.target.value)}>
                                          <option value="none">Normal</option>
                                          <option value="uppercase">UPPERCASE</option>
                                          <option value="lowercase">lowercase</option>
                                          <option value="capitalize">Capitalize</option>
                                        </select>
                                      </div>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                        <span style={{ fontSize: '0.6rem', color: 'var(--muted)' }}>Opacity %</span>
                                        <input type="number" className="form-input" style={{ padding: '4px', fontSize: '0.75rem', width: '50px' }} min={10} max={100} step={5} placeholder="100" value={f.opacity != null ? Math.round(f.opacity * 100) : 100} onChange={e => onFieldChange(side, i, 'opacity', Number(e.target.value) / 100)} />
                                      </div>
                                    </div>
                                    {/* Row 4: Prefix & Suffix */}
                                    <div style={{ display: 'flex', gap: '5px' }}>
                                      <input type="text" className="form-input" style={{ padding: '4px', fontSize: '0.75rem', width: '90px' }} placeholder="Prefix" value={f.prefix || ''} onChange={e => onFieldChange(side, i, 'prefix', e.target.value)} />
                                      <input type="text" className="form-input" style={{ padding: '4px', fontSize: '0.75rem', width: '80px' }} placeholder="Suffix" value={f.suffix || ''} onChange={e => onFieldChange(side, i, 'suffix', e.target.value)} />
                                    </div>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: 'var(--muted)', cursor: 'pointer' }}>
                                      <input type="checkbox" checked={!!f.prefix} onChange={e => {
                                        const isChecked = e.target.checked;
                                        const fmt = (n: string) => formatFieldLabel(n);
                                        onFieldChange(side, i, 'prefix', isChecked ? `${fmt(f.field)} : ` : '');
                                      }} />
                                      Add Field Name
                                    </label>
                                  </div>
                                ) : f.type === 'image' ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>Border Radius (px)</label>
                                    <input type="number" className="form-input" style={{ padding: '4px', fontSize: '0.8rem', width: '90px' }} min={0} max={500} placeholder="0" value={f.borderRadius || 0} onChange={e => onFieldChange(side, i, 'borderRadius', Number(e.target.value))} />
                                  </div>
                                ) : <span style={{ color: 'var(--muted)' }}>—</span>}
                              </td>
                              <td>
                                <button type="button" className="btn btn-danger" style={{ padding: '6px 10px', fontSize: '0.75rem' }} onClick={() => { onRemoveField(side, i); setSelectedFieldIndex(null); setActiveTooltipIndex(null); setActiveTooltipSide(null); }}>✕</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

  );
}
