'use client';
import React from 'react';
import { AlertTriangle } from 'lucide-react';

export function ValidationModal({
  validationResult,
  onFixRecords,
  onSkipAndPrint,
}: {
  validationResult: any;
  onFixRecords: () => void;
  onSkipAndPrint: () => void;
}) {
  if (!validationResult) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)',
      zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
    }}>
      <div style={{
        background: 'rgba(13,16,27,0.98)', border: '1px solid var(--glass-border)', borderTop: '2px solid #f59e0b',
        borderRadius: '16px', padding: '28px', maxWidth: '640px', width: '100%',
        maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: '16px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertTriangle size={22} color="#f59e0b" />
          <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#f59e0b', fontWeight: '600' }}>Missing Data Detected</h3>
        </div>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.9rem' }}>
          <strong style={{ color: '#fff' }}>{validationResult.missingFields.length} record(s)</strong>{' '}
          have incomplete required fields. Fix them or skip to proceed.
        </p>
        <div style={{ overflowY: 'auto', maxHeight: '280px', border: '1px solid var(--glass-border)', borderRadius: '8px', background: 'rgba(255,255,255,0.02)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }} className="custom-table">
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid var(--glass-border)', fontWeight: '600' }}>#</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid var(--glass-border)', fontWeight: '600' }}>Cardholder</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid var(--glass-border)', fontWeight: '600' }}>Missing Fields</th>
              </tr>
            </thead>
            <tbody>
              {validationResult.missingFields.map((row: any, i: number) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '8px 12px', color: 'var(--muted)' }}>{i + 1}</td>
                  <td style={{ padding: '8px 12px', fontWeight: '500' }}>{row.cardholderName}</td>
                  <td style={{ padding: '8px 12px' }}>
                    {row.missingFields.map((f: string, fi: number) => (
                      <span key={fi} style={{
                        display: 'inline-block', background: 'rgba(239,68,68,0.12)', color: '#f87171',
                        borderRadius: '4px', padding: '2px 7px', fontSize: '0.75rem', marginRight: '4px', marginBottom: '2px',
                        fontWeight: '500'
                      }}>{f}</span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
          <button
            className="btn btn-secondary"
            onClick={onFixRecords}
          >
            Fix Records
          </button>
          <button
            className="btn"
            style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}
            onClick={onSkipAndPrint}
          >
            Skip & Print Anyway
          </button>
        </div>
      </div>
    </div>
  );
}
