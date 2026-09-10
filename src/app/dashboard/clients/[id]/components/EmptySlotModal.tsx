'use client';
import React from 'react';
import { AlertTriangle } from 'lucide-react';

export type EmptySlotStrategyType = 'LEAVE_BLANK' | 'REPEAT_LAST' | 'REPEAT_FIRST' | 'FILL_CUSTOM';

export function EmptySlotModal({
  validationResult,
  emptySlotStrategy,
  onStrategyChange,
  onCancel,
  onConfirm,
}: {
  validationResult: any;
  emptySlotStrategy: EmptySlotStrategyType;
  onStrategyChange: (strategy: EmptySlotStrategyType) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!validationResult) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)',
      zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
    }}>
      <div style={{
        background: 'rgba(13,16,27,0.98)', border: '1px solid var(--glass-border)', borderTop: '2px solid var(--primary)',
        borderRadius: '16px', padding: '28px', maxWidth: '480px', width: '100%',
        display: 'flex', flexDirection: 'column', gap: '16px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertTriangle size={22} color="var(--primary)" />
          <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '600' }}>Empty Sheet Slots</h3>
        </div>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.9rem' }}>
          Your <strong style={{ color: '#fff' }}>{validationResult.totalCards}</strong> records
          will fill <strong style={{ color: '#fff' }}>{validationResult.totalCards}</strong> of{' '}
          <strong style={{ color: '#fff' }}>{validationResult.totalSlots}</strong> available sheet slots.
          How should the remaining <strong style={{ color: 'var(--primary)' }}>
            {validationResult.totalSlots - validationResult.totalCards}
          </strong> slots be filled?
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {([
            { value: 'LEAVE_BLANK', label: 'Leave Blank', desc: 'Empty slots print as white space. Safe for cut-and-stack printing.' },
            { value: 'REPEAT_LAST', label: 'Repeat Last Card', desc: 'Fill remaining slots by repeating the last record.' },
            { value: 'REPEAT_FIRST', label: 'Repeat First Card', desc: 'Fill remaining slots with the first record (useful for calibration).' },
          ] as const).map(opt => (
            <label
              key={opt.value}
              style={{
                display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '10px 14px',
                border: `1px solid ${emptySlotStrategy === opt.value ? 'var(--primary)' : 'var(--glass-border)'}`,
                borderRadius: '8px', cursor: 'pointer',
                background: emptySlotStrategy === opt.value ? 'rgba(99,102,241,0.08)' : 'transparent',
                transition: 'all 0.15s'
              }}
            >
              <input type="radio" name="emptySlot" value={opt.value}
                checked={emptySlotStrategy === opt.value}
                onChange={() => onStrategyChange(opt.value)}
                style={{ marginTop: '4px' }}
              />
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#fff' }}>{opt.label}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '2px' }}>{opt.desc}</div>
              </div>
            </label>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={onConfirm}>
            Confirm & Queue Print
          </button>
        </div>
      </div>
    </div>
  );
}
