'use client';
import React, { useState } from 'react';
import { CheckCircle } from 'lucide-react';

interface ZIPImportResult {
  summary: { totalFiles: number; matchedCount: number; failedValidationCount: number; unmatchedCount: number; };
  details: any[];
}

export function ZIPImportPanel({ clientId, onComplete, onCancel }: { clientId: number, onComplete: () => void, onCancel: () => void }) {
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [zipResult, setZipResult] = useState<ZIPImportResult | null>(null);
  const [zipError, setZipError] = useState('');
  const [zipLoading, setZipLoading] = useState(false);

  const handleZipImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setZipError('');
    setZipResult(null);
    setZipLoading(true);

    try {
      if (!zipFile) throw new Error('Please upload a ZIP file');

      const formData = new FormData();
      formData.append('clientId', String(clientId));
      formData.append('file', zipFile);

      const res = await fetch('/api/cardholders/import-photos', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to process photos archive');

      setZipResult(json);
      onComplete();
    } catch (err: any) {
      setZipError(err.message || 'ZIP import failed');
    } finally {
      setZipLoading(false);
    }
  };

  return (
    <div className="glass-panel" style={{ maxWidth: '640px' }}>
      <h3 style={{ marginBottom: '20px' }}>ZIP Photos Bulk Import</h3>
      <p style={{ marginBottom: '24px', fontSize: '0.85rem' }}>
        Upload a ZIP archive containing photos. Photo filenames must match either the cardholder's <strong>uniqueKey</strong> (e.g. `EMP-102.jpg`) or full <strong>name</strong> (e.g. `John Doe.png`).
      </p>

      {zipError && (
        <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f77', borderRadius: '6px', marginBottom: '20px', fontSize: '0.85rem' }}>
          {zipError}
        </div>
      )}

      {zipResult && (
        <div className="glass-panel" style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', marginBottom: '24px', border: '1px solid var(--success)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--success)', marginBottom: '12px' }}>
            <CheckCircle size={18} />
            <h4 style={{ color: 'var(--success)' }}>ZIP Processing Complete</h4>
          </div>
          <ul style={{ fontSize: '0.85rem', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--muted)' }}>
            <li>Total files found in archive: <strong style={{ color: '#fff' }}>{zipResult.summary?.totalFiles ?? 0}</strong></li>
            <li>Successfully matched & imported: <strong style={{ color: '#fff' }}>{zipResult.summary?.matchedCount ?? 0}</strong></li>
            <li>Failed photo validations: <strong style={{ color: '#fff' }}>{zipResult.summary?.failedValidationCount ?? 0}</strong></li>
            <li>Unmatched filenames: <strong style={{ color: '#fff' }}>{zipResult.summary?.unmatchedCount ?? 0}</strong></li>
          </ul>
          {zipResult.details && zipResult.details.length > 0 && (
            <div style={{ marginTop: '12px', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '6px', maxHeight: '180px', overflowY: 'auto' }}>
              <span style={{ fontSize: '0.75rem', color: '#f87171', fontWeight: '500' }}>Import Details / Warnings:</span>
              {zipResult.details.map((detail: any, idx: number) => {
                const hasIssues = detail.status !== 'SUCCESS' || (detail.warnings && detail.warnings.length > 0);
                if (!hasIssues) return null;
                return (
                  <div key={idx} style={{ fontSize: '0.7rem', marginTop: '6px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px' }}>
                    <strong style={{ color: detail.status === 'SUCCESS' ? 'var(--warning)' : '#f87171' }}>
                      {detail.fileName} ({detail.status})
                    </strong>
                    {detail.cardholderName && ` - Cardholder: ${detail.cardholderName}`}
                    {detail.message && <div style={{ color: 'var(--muted)', marginLeft: '8px' }}>{detail.message}</div>}
                    {detail.errors && detail.errors.map((e: string, i: number) => (
                      <div key={i} style={{ color: '#f87171', marginLeft: '8px' }}>• {e}</div>
                    ))}
                    {detail.warnings && detail.warnings.map((w: string, i: number) => (
                      <div key={i} style={{ color: '#f87171', marginLeft: '8px' }}>• Warning: {w}</div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleZipImport} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div className="form-group">
          <label className="form-label">Upload ZIP Archive</label>
          <input type="file" accept=".zip" className="form-input" required onChange={e => setZipFile(e.target.files?.[0] || null)} />
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
          <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={zipLoading}>
            {zipLoading ? 'Extracting ZIP & Verifying Quality...' : 'Process ZIP Photos'}
          </button>
        </div>
      </form>
    </div>
  );
}
