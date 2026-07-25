'use client';

import React, { useEffect, useState } from 'react';
import { X, FileText, Zap, CheckCircle2, AlertCircle, Plus, Trash2, Layers } from 'lucide-react';

export interface CompileWizardConfig {
  compileType: 'APPROVAL' | 'PRODUCTION';
  paperSize: string;
  orientation: 'PORTRAIT' | 'LANDSCAPE';
  marginLeft: number; marginRight: number;
  marginTop: number;  marginBottom: number;
  colGap: number; rowGap: number;
  bleed: number; cropMarks: boolean; foldLine: boolean;
  emptySlotStrategy: 'LEAVE_BLANK' | 'REPEAT_LAST' | 'REPEAT_FIRST' | 'FILL_CUSTOM';
  customCardId?: string;
}

interface AddedFillerCard {
  id: string;
  title: string;
  isDoubleSided: boolean;
  frontFile: File;
  backFile: File | null;
  slotsToFill: number;
}

interface Props {
  cardCount: number;
  onClose: () => void;
  onCompile: (cfg: CompileWizardConfig) => void;
  compiling?: boolean;
}

export default function CompileWizardModal({ cardCount, onClose, onCompile, compiling }: Props) {
  const [step, setStep] = useState<1|2|3|4>(1);
  const [compileType, setCompileType] = useState<'APPROVAL'|'PRODUCTION'|null>(null);
  const [paperSize, setPaperSize] = useState('A3');
  const [orientation, setOrientation] = useState<'PORTRAIT'|'LANDSCAPE'>('PORTRAIT');
  const [marginLeft, setMarginLeft] = useState(40);
  const [marginRight, setMarginRight] = useState(40);
  const [marginTop, setMarginTop] = useState(40);
  const [marginBottom, setMarginBottom] = useState(40);
  const [colGap, setColGap] = useState(15);
  const [rowGap, setRowGap] = useState(15);
  const [bleed, setBleed] = useState(0);
  const [cropMarks, setCropMarks] = useState(true);
  const [foldLine, setFoldLine] = useState(true);
  const [strategy, setStrategy] = useState<'LEAVE_BLANK'|'REPEAT_LAST'|'REPEAT_FIRST'|'FILL_CUSTOM'>('LEAVE_BLANK');

  // Multi-Card Filler State
  const [addedFillerCards, setAddedFillerCards] = useState<AddedFillerCard[]>([]);
  const [uploadTitle, setUploadTitle] = useState('');
  const [isDoubleSided, setIsDoubleSided] = useState(false);
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [slotsCount, setSlotsCount] = useState<number>(1);
  const [formError, setFormError] = useState('');
  const [preparingCompile, setPreparingCompile] = useState(false);

  // Calculate live slot capacity
  const calcSlots = () => {
    let pw = 841.89; let ph = 1190.55;
    if (paperSize === 'SRA3') {
      pw = orientation === 'PORTRAIT' ? 907.09 : 1275.59;
      ph = orientation === 'PORTRAIT' ? 1275.59 : 907.09;
    } else if (paperSize === '13x19') {
      pw = orientation === 'PORTRAIT' ? 936 : 1368;
      ph = orientation === 'PORTRAIT' ? 1368 : 936;
    } else if (paperSize === 'A4') {
      pw = orientation === 'PORTRAIT' ? 595.27 : 841.89;
      ph = orientation === 'PORTRAIT' ? 841.89 : 595.27;
    } else {
      pw = orientation === 'PORTRAIT' ? 841.89 : 1190.55;
      ph = orientation === 'PORTRAIT' ? 1190.55 : 841.89;
    }
    const bleedPt = (bleed || 0) * 2.83464567;
    const cw = 153 + bleedPt * 2;
    const ch = 242.6 + bleedPt * 2;
    const cols = Math.floor((pw - marginLeft - marginRight + colGap) / (cw + colGap)) || 1;
    const rows = Math.floor((ph - marginTop - marginBottom + rowGap) / (ch + rowGap)) || 1;
    const perPage = Math.max(1, cols * rows);
    const pages = Math.ceil(cardCount / perPage) || 1;
    const totalSlots = pages * perPage;
    const emptySlots = Math.max(0, totalSlots - cardCount);
    return { totalSlots, perPage, pages, emptySlots };
  };

  const { totalSlots, emptySlots } = calcSlots();
  const totalAssignedSlots = addedFillerCards.reduce((acc, c) => acc + c.slotsToFill, 0);
  const remainingSlots = Math.max(0, emptySlots - totalAssignedSlots);

  useEffect(() => {
    if (step === 4) {
      if (emptySlots === 0 && strategy === 'FILL_CUSTOM') {
        setStrategy('LEAVE_BLANK');
      }
    }
  }, [step, emptySlots]);

  useEffect(() => {
    // Reset slots count default whenever remaining slots change
    setSlotsCount(remainingSlots > 0 ? 1 : 0);
  }, [remainingSlots]);

  const handleAddCardToList = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!frontFile) {
      setFormError('Please select Front Side File (PDF/Image).');
      return;
    }
    if (isDoubleSided && !backFile) {
      setFormError('Please select Back Side File (PDF/Image).');
      return;
    }
    if (slotsCount < 1 || slotsCount > remainingSlots) {
      setFormError(`Slots to fill must be between 1 and ${remainingSlots}.`);
      return;
    }

    const title = uploadTitle.trim() || frontFile.name.replace(/\.[^/.]+$/, "");
    const newCard: AddedFillerCard = {
      id: Math.random().toString(36).substring(2) + Date.now().toString(36),
      title,
      isDoubleSided,
      frontFile,
      backFile: isDoubleSided ? backFile : null,
      slotsToFill: slotsCount,
    };

    setAddedFillerCards(prev => [...prev, newCard]);
    setUploadTitle('');
    setFrontFile(null);
    setBackFile(null);
    setIsDoubleSided(false);
  };

  const handleRemoveCard = (id: string) => {
    setAddedFillerCards(prev => prev.filter(c => c.id !== id));
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const res = reader.result as string;
        resolve(res.includes(',') ? res.split(',')[1] : res);
      };
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  };

  const handleCompile = async () => {
    if (!compileType) return;

    let customCardPayload: string | undefined = undefined;

    if (emptySlots > 0 && strategy === 'FILL_CUSTOM') {
      if (addedFillerCards.length === 0) {
        alert('Please add at least 1 custom card to fill the empty slots.');
        return;
      }

      setPreparingCompile(true);
      try {
        const { saveCustomCard } = await import('@/lib/clientDb');
        const cardIdList: string[] = [];

        for (const card of addedFillerCards) {
          const frontBase64 = await fileToBase64(card.frontFile);
          const backBase64 = card.isDoubleSided && card.backFile ? await fileToBase64(card.backFile) : undefined;
          
          const savedCard = await saveCustomCard(
            card.title,
            frontBase64,
            backBase64,
            card.isDoubleSided,
            card.isDoubleSided ? 'Double Sided' : 'Single Sided'
          );

          // Repeat this card ID according to slotsToFill count
          for (let s = 0; s < card.slotsToFill; s++) {
            cardIdList.push(savedCard.id);
          }
        }

        customCardPayload = JSON.stringify(cardIdList);
      } catch (err: any) {
        alert('Failed to process custom card files: ' + (err?.message || err));
        setPreparingCompile(false);
        return;
      }
    }

    onCompile({
      compileType, paperSize, orientation,
      marginLeft, marginRight, marginTop, marginBottom,
      colGap, rowGap, bleed, cropMarks, foldLine,
      emptySlotStrategy: emptySlots > 0 ? strategy : 'LEAVE_BLANK',
      customCardId: customCardPayload,
    });
  };

  const stepLabels = ['File Type', 'Sheet Size', 'Layout', 'Empty Slots'];
  const inp = { background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)', borderRadius: '6px', color: '#fff', padding: '6px 10px' };
  const radioBox = (active: boolean, disabled: boolean = false) => ({
    display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '11px 14px',
    border: `1px solid ${active ? 'var(--primary)' : 'var(--glass-border)'}`,
    borderRadius: '8px', cursor: disabled ? 'not-allowed' : 'pointer',
    background: active ? 'rgba(99,102,241,0.08)' : 'transparent',
    opacity: disabled ? 0.4 : 1,
    transition: 'all 0.15s'
  } as React.CSSProperties);

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9900, background: 'rgba(3,4,7,0.8)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'rgba(13,16,27,0.98)', border: '1px solid var(--glass-border)', borderTop: '2px solid var(--primary)', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '560px', display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: '0 24px 64px rgba(0,0,0,0.6)', maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={17} color="var(--primary)" /> Generate PDF — {cardCount} Card{cardCount !== 1 ? 's' : ''}
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--muted)' }}>Step {step} of 4 — {stepLabels[step - 1]}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {[1,2,3,4].map(s => (
            <div key={s} style={{ flex: 1, height: '3px', borderRadius: '2px', background: s <= step ? 'var(--primary)' : 'rgba(255,255,255,0.1)', transition: 'background 0.3s' }} />
          ))}
        </div>

        {/* Step 1: File Type */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 500 }}>What type of PDF do you want to generate?</span>
            <label style={radioBox(compileType === 'APPROVAL')}>
              <input type="radio" name="ctype" checked={compileType === 'APPROVAL'} onChange={() => setCompileType('APPROVAL')} />
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={14} color="#94a3b8" /> Approval / Proof PDF
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '2px' }}>Watermarked proof for client sign-off. Default A4.</div>
              </div>
            </label>
            <label style={radioBox(compileType === 'PRODUCTION')}>
              <input type="radio" name="ctype" checked={compileType === 'PRODUCTION'} onChange={() => setCompileType('PRODUCTION')} />
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Zap size={14} color="var(--primary)" /> Production PDF
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '2px' }}>Print-ready grid layout. Default A3 with crop marks.</div>
              </div>
            </label>
          </div>
        )}

        {/* Step 2: Paper Size & Orientation */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 500 }}>Paper Size</span>
              <select className="form-input" value={paperSize} onChange={e => setPaperSize(e.target.value)} style={{ background: '#0a0d14', color: '#fff', border: '1px solid var(--glass-border)' }}>
                <option value="A4">A4 — 210 × 297 mm</option>
                <option value="A3">A3 — 297 × 420 mm</option>
                <option value="SRA3">SRA3 — 320 × 450 mm</option>
                <option value="13x19">13″ × 19″ — 330 × 483 mm</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 500 }}>Orientation</span>
              <div style={{ display: 'flex', gap: '10px' }}>
                {(['PORTRAIT','LANDSCAPE'] as const).map(o => (
                  <button key={o} type="button" onClick={() => setOrientation(o)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: `1px solid ${orientation === o ? 'var(--primary)' : 'var(--glass-border)'}`, background: orientation === o ? 'rgba(99,102,241,0.08)' : 'transparent', color: orientation === o ? '#fff' : 'var(--muted)', cursor: 'pointer', transition: 'all 0.15s' }}>
                    {o.charAt(0) + o.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Layout Configuration */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 500 }}>Margins (pt)</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {[['Left', marginLeft, setMarginLeft], ['Right', marginRight, setMarginRight], ['Top', marginTop, setMarginTop], ['Bottom', marginBottom, setMarginBottom]].map(([label, val, setter]: any) => (
                <label key={label} style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.76rem', color: 'var(--muted)' }}>
                  {label}
                  <input type="number" min={0} max={200} value={val} onChange={e => setter(Number(e.target.value))} style={{ ...inp, width: '100%' }} />
                </label>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              {[['Col Gap', colGap, setColGap], ['Row Gap', rowGap, setRowGap], ['Bleed', bleed, setBleed]].map(([label, val, setter]: any) => (
                <label key={label} style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.76rem', color: 'var(--muted)' }}>
                  {label} (pt)
                  <input type="number" min={0} max={50} value={val} onChange={e => setter(Number(e.target.value))} style={{ ...inp, width: '100%' }} />
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '20px' }}>
              {[['Crop Marks', cropMarks, setCropMarks], ['Fold Line', foldLine, setFoldLine]].map(([label, val, setter]: any) => (
                <label key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={val} onChange={e => setter(e.target.checked)} style={{ accentColor: 'var(--primary)' }} /> {label}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: Empty Slots Strategy */}
        {step === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            
            {/* Capacity Status Banner */}
            {emptySlots === 0 ? (
              <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', display: 'flex', alignItems: 'center', gap: '10px', color: '#4ade80', fontSize: '0.83rem' }}>
                <CheckCircle2 size={18} color="#4ade80" />
                <div>
                  <strong>Sheet is 100% Full</strong> — All {totalSlots} slot(s) are occupied by your {cardCount} selected record(s). No empty slots remaining.
                </div>
              </div>
            ) : (
              <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', gap: '10px', color: '#a5b4fc', fontSize: '0.83rem' }}>
                <AlertCircle size={18} color="#818cf8" />
                <div>
                  <strong>{emptySlots} Empty Slot(s) Available</strong> — Your {cardCount} selected card(s) occupy {cardCount} of {totalSlots} sheet slots. Choose how to fill the remaining {emptySlots} slot(s).
                </div>
              </div>
            )}

            <span style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 500 }}>Empty Slot Strategy</span>

            {([
              { v: 'LEAVE_BLANK', label: 'Leave Blank', desc: 'Keep empty slots as white space.' },
              { v: 'REPEAT_LAST', label: 'Repeat Last Card', desc: 'Fill slots by repeating the last card.' },
              { v: 'REPEAT_FIRST', label: 'Repeat First Card', desc: 'Fill slots with the first card (calibration).' },
              { v: 'FILL_CUSTOM', label: 'Custom Filler Cards (PAN, Driving License, Visitor ID)', desc: emptySlots > 0 ? `Add custom cards to fill all ${emptySlots} empty slot(s).` : 'Disabled — No empty slots remaining.' },
            ] as const).map(opt => {
              const disabled = opt.v === 'FILL_CUSTOM' && emptySlots === 0;
              return (
                <label key={opt.v} style={radioBox(strategy === opt.v, disabled)}>
                  <input
                    type="radio"
                    name="strategy"
                    disabled={disabled}
                    checked={strategy === opt.v}
                    onChange={() => !disabled && setStrategy(opt.v)}
                    style={{ marginTop: '3px' }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: disabled ? 'var(--muted)' : '#fff' }}>
                      {opt.label}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--muted)', marginTop: '2px' }}>{opt.desc}</div>
                  </div>
                </label>
              );
            })}

            {/* Custom Multi-Card Filler Form */}
            {strategy === 'FILL_CUSTOM' && emptySlots > 0 && (
              <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '4px' }}>
                
                {/* Header Progress Bar */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Layers size={15} color="var(--primary)" /> Fill {emptySlots} Empty Slot(s)
                    </span>
                    <span style={{ fontSize: '0.74rem', color: remainingSlots === 0 ? '#4ade80' : '#a5b4fc', fontWeight: 600 }}>
                      {totalAssignedSlots} / {emptySlots} Slots Assigned {remainingSlots === 0 ? '✓ All Full' : `(${remainingSlots} left)`}
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, (totalAssignedSlots / emptySlots) * 100)}%`, height: '100%', background: remainingSlots === 0 ? '#22c55e' : 'var(--primary)', transition: 'all 0.3s' }} />
                  </div>
                </div>

                {/* List of Added Cards */}
                {addedFillerCards.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span style={{ fontSize: '0.76rem', color: 'var(--muted)', fontWeight: 500 }}>Added Custom Cards ({addedFillerCards.length})</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '160px', overflowY: 'auto' }}>
                      {addedFillerCards.map((card, idx) => (
                        <div key={card.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '8px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700 }}>
                              {idx + 1}
                            </span>
                            <div>
                              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#fff' }}>{card.title}</div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                                {card.isDoubleSided ? 'Double Sided (Front & Back)' : 'Single Sided'} • {card.slotsToFill} Slot{card.slotsToFill > 1 ? 's' : ''}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveCard(card.id)}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                            title="Remove card"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Form to add another custom card */}
                {remainingSlots > 0 ? (
                  <form onSubmit={handleAddCardToList} style={{ borderTop: addedFillerCards.length > 0 ? '1px solid var(--glass-border)' : 'none', paddingTop: addedFillerCards.length > 0 ? '12px' : '0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Plus size={14} color="var(--primary)" /> Add Custom Filler Card {addedFillerCards.length > 0 ? `(#${addedFillerCards.length + 1})` : ''}
                    </span>

                    {formError && (
                      <div style={{ fontSize: '0.75rem', color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '6px 10px', borderRadius: '6px' }}>
                        {formError}
                      </div>
                    )}

                    {/* Card Title / Label */}
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.76rem', color: 'var(--muted)' }}>
                      Card Title / Label (e.g. PAN Card, Driving License, Visitor ID)
                      <input
                        type="text"
                        placeholder="e.g. PAN Card - Front & Back"
                        value={uploadTitle}
                        onChange={e => setUploadTitle(e.target.value)}
                        style={{ ...inp, width: '100%' }}
                      />
                    </label>

                    {/* Single vs Both Sided Selection */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '0.76rem', color: 'var(--muted)' }}>Card Type</span>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                          type="button"
                          onClick={() => setIsDoubleSided(false)}
                          style={{
                            flex: 1, padding: '7px 10px', borderRadius: '6px', fontSize: '0.76rem',
                            border: `1px solid ${!isDoubleSided ? 'var(--primary)' : 'var(--glass-border)'}`,
                            background: !isDoubleSided ? 'rgba(99,102,241,0.15)' : 'transparent',
                            color: !isDoubleSided ? '#fff' : 'var(--muted)', cursor: 'pointer'
                          }}
                        >
                          Single Sided
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsDoubleSided(true)}
                          style={{
                            flex: 1, padding: '7px 10px', borderRadius: '6px', fontSize: '0.76rem',
                            border: `1px solid ${isDoubleSided ? 'var(--primary)' : 'var(--glass-border)'}`,
                            background: isDoubleSided ? 'rgba(99,102,241,0.15)' : 'transparent',
                            color: isDoubleSided ? '#fff' : 'var(--muted)', cursor: 'pointer'
                          }}
                        >
                          Both Sided (Front & Back)
                        </button>
                      </div>
                    </div>

                    {/* Front & Back File Inputs */}
                    <div style={{ display: 'grid', gridTemplateColumns: isDoubleSided ? '1fr 1fr' : '1fr', gap: '10px' }}>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontSize: '0.76rem', color: 'var(--muted)' }}>Front Side (PDF / Image)</span>
                        <input
                          type="file"
                          accept=".pdf,image/*"
                          onChange={e => setFrontFile(e.target.files?.[0] || null)}
                          style={{ fontSize: '0.75rem', color: '#fff', padding: '6px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px dashed var(--glass-border)', cursor: 'pointer' }}
                        />
                      </label>

                      {isDoubleSided && (
                        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontSize: '0.76rem', color: 'var(--muted)' }}>Back Side (PDF / Image)</span>
                          <input
                            type="file"
                            accept=".pdf,image/*"
                            onChange={e => setBackFile(e.target.files?.[0] || null)}
                            style={{ fontSize: '0.75rem', color: '#fff', padding: '6px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px dashed var(--glass-border)', cursor: 'pointer' }}
                          />
                        </label>
                      )}
                    </div>

                    {/* Slots to fill count */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.76rem', color: 'var(--muted)' }}>
                        Fill how many slots with this card?
                        <select
                          value={slotsCount}
                          onChange={e => setSlotsCount(Number(e.target.value))}
                          style={{ ...inp, padding: '4px 8px' }}
                        >
                          {Array.from({ length: remainingSlots }, (_, i) => i + 1).map(n => (
                            <option key={n} value={n} style={{ background: '#0a0d14' }}>
                              {n} slot{n > 1 ? 's' : ''} {n === remainingSlots ? '(All remaining)' : ''}
                            </option>
                          ))}
                        </select>
                      </label>

                      <button
                        type="submit"
                        disabled={!frontFile || (isDoubleSided && !backFile)}
                        style={{
                          padding: '8px 14px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600,
                          background: 'var(--primary)', color: '#fff', border: 'none', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: '6px',
                          opacity: (!frontFile || (isDoubleSided && !backFile)) ? 0.5 : 1
                        }}
                      >
                        <Plus size={14} /> Add Card ({slotsCount} Slot{slotsCount > 1 ? 's' : ''})
                      </button>
                    </div>
                  </form>
                ) : (
                  <div style={{ padding: '10px 12px', borderRadius: '8px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', color: '#4ade80', fontSize: '0.78rem', textAlign: 'center', fontWeight: 500 }}>
                    ✓ All {emptySlots} empty slot(s) assigned! Click "Compile PDF" below to process.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px' }}>
          {step > 1 && <button className="btn btn-secondary" onClick={() => setStep((s) => (s - 1) as any)}>Back</button>}
          {step < 4 ? (
            <button className="btn btn-primary" onClick={() => {
              if (step === 1 && !compileType) return;
              setStep((s) => (s + 1) as any);
            }} disabled={step === 1 && !compileType}>
              Next
            </button>
          ) : (
            <button className="btn btn-primary" onClick={handleCompile} disabled={!!compiling || preparingCompile || (strategy === 'FILL_CUSTOM' && (emptySlots === 0 || addedFillerCards.length === 0))}>
              {compiling || preparingCompile ? <span className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} /> : null}
              {preparingCompile ? ' Processing Files…' : 'Compile PDF'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
