'use client';

import React, { useEffect, useState } from 'react';
import { X, FileText, Zap } from 'lucide-react';

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
  const [customCards, setCustomCards] = useState<any[]>([]);
  const [selectedCardId, setSelectedCardId] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (step === 4) loadCards();
  }, [step]);

  const loadCards = async () => {
    try {
      const { getCustomCards } = await import('@/lib/clientDb');
      const list = await getCustomCards();
      setCustomCards(list);
      if (list.length > 0 && !selectedCardId) setSelectedCardId(list[0].id);
    } catch {}
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || f.type !== 'application/pdf') return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const { saveCustomCard } = await import('@/lib/clientDb');
        const saved = await saveCustomCard(f.name, (reader.result as string).split(',')[1]);
        setSelectedCardId(saved.id);
        await loadCards();
      } finally { setUploading(false); }
    };
    reader.readAsDataURL(f);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this custom PDF card?')) return;
    const { deleteCustomCard } = await import('@/lib/clientDb');
    await deleteCustomCard(id);
    if (selectedCardId === id) setSelectedCardId('');
    await loadCards();
  };

  const handleCompile = () => {
    if (!compileType) return;
    onCompile({
      compileType, paperSize, orientation,
      marginLeft, marginRight, marginTop, marginBottom,
      colGap, rowGap, bleed, cropMarks, foldLine,
      emptySlotStrategy: strategy,
      customCardId: strategy === 'FILL_CUSTOM' ? selectedCardId : undefined,
    });
  };

  const stepLabels = ['File Type', 'Sheet Size', 'Layout', 'Empty Slots'];
  const inp = { background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)', borderRadius: '6px', color: '#fff', padding: '6px 10px' };
  const radioBox = (active: boolean) => ({
    display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '11px 14px',
    border: `1px solid ${active ? 'var(--primary)' : 'var(--glass-border)'}`,
    borderRadius: '8px', cursor: 'pointer',
    background: active ? 'rgba(99,102,241,0.08)' : 'transparent', transition: 'all 0.15s'
  } as React.CSSProperties);

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9900, background: 'rgba(3,4,7,0.8)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'rgba(13,16,27,0.98)', border: '1px solid var(--glass-border)', borderTop: '2px solid var(--primary)', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '520px', display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: '0 24px 64px rgba(0,0,0,0.6)', maxHeight: '90vh', overflowY: 'auto' }}>

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

        {/* Step 4: Empty Slot Strategy */}
        {step === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 500 }}>What to do with empty slots on the sheet?</span>
            {([
              { v: 'LEAVE_BLANK', label: 'Leave Blank', desc: 'Keep empty slots as white space.' },
              { v: 'REPEAT_LAST', label: 'Repeat Last Card', desc: 'Fill slots by repeating the last card.' },
              { v: 'REPEAT_FIRST', label: 'Repeat First Card', desc: 'Fill slots with the first card (calibration).' },
              { v: 'FILL_CUSTOM', label: 'Custom PDF Card', desc: 'Upload a local PDF card to fill empty slots (stored 3 days).' },
            ] as const).map(opt => (
              <label key={opt.v} style={radioBox(strategy === opt.v)}>
                <input type="radio" name="strategy" checked={strategy === opt.v} onChange={() => setStrategy(opt.v)} style={{ marginTop: '3px' }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#fff' }}>{opt.label}</div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--muted)', marginTop: '2px' }}>{opt.desc}</div>
                </div>
              </label>
            ))}

            {strategy === 'FILL_CUSTOM' && (
              <div style={{ padding: '14px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
                {customCards.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '0.76rem', color: 'var(--muted)' }}>Saved local cards</span>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <select value={selectedCardId} onChange={e => setSelectedCardId(e.target.value)} style={{ ...inp, flex: 1 }}>
                        {customCards.map(c => (
                          <option key={c.id} value={c.id} style={{ background: '#0a0d14' }}>{c.name} — {new Date(c.createdAt).toLocaleDateString()}</option>
                        ))}
                      </select>
                      <button type="button" onClick={() => handleDelete(selectedCardId)} style={{ padding: '7px 12px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem' }}>Delete</button>
                    </div>
                  </div>
                ) : (
                  <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--muted)', textAlign: 'center' }}>No local PDF cards yet.</p>
                )}
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '0.76rem', color: 'var(--muted)' }}>{uploading ? 'Saving…' : 'Upload New PDF Card'}</span>
                  <input type="file" accept=".pdf" disabled={uploading} onChange={handleUpload} style={{ fontSize: '0.76rem', color: '#fff', padding: '6px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px dashed var(--glass-border)', cursor: 'pointer' }} />
                </label>
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
              if (step + 1 === 4) loadCards();
            }} disabled={step === 1 && !compileType}>
              Next
            </button>
          ) : (
            <button className="btn btn-primary" onClick={handleCompile} disabled={!!compiling || (strategy === 'FILL_CUSTOM' && !selectedCardId)}>
              {compiling ? <span className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} /> : null}
              Compile PDF
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
