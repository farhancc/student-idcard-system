'use client';

import React, { useState } from 'react';
import { Download, CheckCircle, AlertTriangle } from 'lucide-react';

interface CSVImportResult {
  mode: string;
  totalRows: number;
  newAdded: number;
  updated: number;
  skipped: number;
  duplicateCount: number;
  success?: boolean;
  error?: string;
}

interface CSVImportWizardProps {
  clientId: string | number;
  clientTemplates?: any[];
  onImported?: () => void;
  onComplete?: () => void;
  onCancel: () => void;
}

export default function CSVImportWizard({
  clientId,
  clientTemplates = [],
  onImported,
  onComplete,
  onCancel,
}: CSVImportWizardProps) {
  const handleSuccess = () => {
    if (onImported) onImported();
    if (onComplete) onComplete();
  };
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [googleSheetsUrl, setGoogleSheetsUrl] = useState('');
  const [importMode, setImportMode] = useState('check');
  const [importTemplateId, setImportTemplateId] = useState('');
  const [importResult, setImportResult] = useState<CSVImportResult | null>(null);
  const [importError, setImportError] = useState('');
  const [importLoading, setImportLoading] = useState(false);

  const [importStep, setImportStep] = useState<'source' | 'mapping' | 'validating' | 'confirm' | 'done'>('source');
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  const [parsedPreview, setParsedPreview] = useState<any[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [importValidationErrors, setImportValidationErrors] = useState<Array<{ row: number; name: string; missingFields: string[] }>>([]);
  const [parseLoading, setParseLoading] = useState(false);
  const [templateFieldDefs, setTemplateFieldDefs] = useState<Array<{ field: string; type: string; isRequired: boolean }>>([]);

  const handleParseFile = async () => {
    if (!csvFile && !googleSheetsUrl.trim()) {
      setImportError('Please select a file or enter a Google Sheets URL first.');
      return;
    }
    if (!importTemplateId) {
      setImportError('Please select a template before proceeding.');
      return;
    }
    setImportError('');
    setParseLoading(true);
    try {
      let rows: any[] = [];

      if (googleSheetsUrl.trim()) {
        const regex = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;
        const match = googleSheetsUrl.match(regex);
        if (!match) throw new Error('Invalid Google Sheets URL format');
        const exportUrl = `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv`;
        const res = await fetch(exportUrl);
        if (!res.ok) throw new Error('Failed to fetch Google Sheet. Make sure link sharing is on.');
        const csvText = await res.text();
        const Papa = (await import('papaparse')).default;
        const result = Papa.parse(csvText, { header: true, skipEmptyLines: true });
        rows = result.data as any[];
      } else if (csvFile) {
        const fileName = csvFile.name.toLowerCase();
        if (fileName.endsWith('.csv')) {
          const text = await csvFile.text();
          const Papa = (await import('papaparse')).default;
          const result = Papa.parse(text, { header: true, skipEmptyLines: true });
          rows = result.data as any[];
        } else {
          const ExcelJS = (await import('exceljs')).default;
          const buffer = await csvFile.arrayBuffer();
          const workbook = new ExcelJS.Workbook();
          await workbook.xlsx.load(buffer as any);
          const sheet = workbook.worksheets[0];
          if (!sheet) throw new Error('XLSX file contains no sheets.');
          const headerRow = sheet.getRow(1).values as (string | undefined)[];
          const headers = headerRow.slice(1);
          sheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;
            const obj: Record<string, any> = {};
            (row.values as any[]).slice(1).forEach((cell, idx) => {
              const key = headers[idx];
              if (key) obj[key] = cell?.text ?? cell ?? '';
            });
            rows.push(obj);
          });
        }
      }

      if (rows.length === 0) throw new Error('No data rows found in the source.');

      const headers = Object.keys(rows[0]);
      setParsedHeaders(headers);
      setParsedPreview(rows.slice(0, 3));

      // Auto-build initial mapping using fuzzy match
      const AUTO_MAP: Record<string, string[]> = {
        name: ['name', 'full name', 'student name', 'employee name', 'cardholder name'],
        designation: ['designation', 'role', 'class', 'grade', 'job title', 'post', 'position'],
        id: ['id', 'idnumber', 'id no', 'id number', 'empid', 'rollnumber', 'roll no', 'roll', 'employee id', 'unique key', 'reg no', 'adm no'],
        photo: ['photo', 'photourl', 'photo url', 'image', 'picture'],
      };
      const initialMapping: Record<string, string> = {};
      for (const [field, aliases] of Object.entries(AUTO_MAP)) {
        const matched = headers.find(h => aliases.some(a => h.toLowerCase().trim() === a.toLowerCase()));
        if (matched) initialMapping[field] = matched;
      }

      // Fetch template field definitions for column mapping UI
      const tplRes = await fetch(`/api/templates/${importTemplateId}/fields`);
      if (tplRes.ok) {
        const tplJson = await tplRes.json();
        setTemplateFieldDefs(tplJson.fields || []);
        // Auto-map custom fields that match exactly
        for (const f of (tplJson.fields || [])) {
          if (!initialMapping[f.field]) {
            const exactMatch = headers.find(h => h.toLowerCase().trim() === f.field.toLowerCase());
            if (exactMatch) initialMapping[f.field] = exactMatch;
          }
        }
      } else {
        // Fallback: use core fields only
        setTemplateFieldDefs([
          { field: 'name', type: 'text', isRequired: true },
          { field: 'designation', type: 'text', isRequired: false },
          { field: 'id', type: 'id', isRequired: false },
          { field: 'photo', type: 'image', isRequired: false },
        ]);
      }

      setColumnMapping(initialMapping);
      setImportStep('mapping');
    } catch (err: any) {
      setImportError(err.message || 'Failed to parse file');
    } finally {
      setParseLoading(false);
    }
  };

  const handleCsvImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportError('');
    setImportResult(null);
    setImportLoading(true);

    try {
      const formData = new FormData();
      formData.append('clientId', String(clientId));
      formData.append('mode', importMode);
      if (importTemplateId) formData.append('templateId', importTemplateId);
      // Send column mapping for server-side field resolution
      if (Object.keys(columnMapping).length > 0) {
        formData.append('columnMapping', JSON.stringify(columnMapping));
      }
      if (csvFile) {
        formData.append('file', csvFile);
      } else if (googleSheetsUrl.trim()) {
        formData.append('googleSheetsUrl', googleSheetsUrl.trim());

      } else {
        throw new Error('Please select a file or enter a Google Sheets URL');
      }

      const res = await fetch('/api/cardholders/import', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to import cardholders');

      setImportResult(json);
      setImportValidationErrors(json.validationErrors || []);
      setImportStep('done');
      if (importMode !== 'check') {
        handleSuccess();
      }
    } catch (err: any) {
      setImportError(err.message || 'Import failed');
    } finally {
      setImportLoading(false);
    }
  };

  return (
        <div className="glass-panel" style={{ maxWidth: '780px' }}>
          {/* Step indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0', marginBottom: '28px' }}>
            {[
              { key: 'source', label: '1. Source' },
              { key: 'mapping', label: '2. Map Columns' },
              { key: 'confirm', label: '3. Confirm' },
              { key: 'done', label: '4. Done' },
            ].map((step, i, arr) => {
              const steps = ['source', 'mapping', 'validating', 'confirm', 'done'];
              const currentIdx = steps.indexOf(importStep);
              const stepIdx = ['source', 'mapping', 'confirm', 'done'].indexOf(step.key);
              const isDone = currentIdx > stepIdx + (step.key === 'confirm' ? 1 : 0);
              const isActive = step.key === importStep || (importStep === 'validating' && step.key === 'confirm');
              return (
                <React.Fragment key={step.key}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '6px 14px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600,
                    background: isActive ? 'var(--primary)' : isDone ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.05)',
                    color: isActive ? '#fff' : isDone ? 'var(--primary)' : 'var(--muted)',
                    transition: 'all 0.2s',
                  }}>
                    {isDone && <CheckCircle size={12} />}
                    {step.label}
                  </div>
                  {i < arr.length - 1 && <div style={{ flex: 1, height: '1px', background: 'var(--glass-border)', minWidth: '12px' }} />}
                </React.Fragment>
              );
            })}
          </div>

          {importError && (
            <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f77', borderRadius: '6px', marginBottom: '20px', fontSize: '0.85rem' }}>
              {importError}
            </div>
          )}

          {/* ── Step 1: Source selection ─────────────────────────────────────── */}
          {importStep === 'source' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <h3 style={{ marginBottom: '6px' }}>Batch Data Import</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: 0 }}>
                  Upload a CSV / Excel spreadsheet or paste a public Google Sheets sharing link.
                  We'll auto-detect your column headers and let you map them to template fields.
                </p>
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label className="form-label" style={{ margin: 0 }}>Upload File (.csv, .xlsx)</label>
                  <a href="/api/cardholders/import/sample" download style={{ fontSize: '0.8rem', color: 'var(--primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '500' }}>
                    <Download size={12} /> Sample Template
                  </a>
                </div>
                <input type="file" accept=".csv,.xlsx,.xls" className="form-input"
                  onChange={e => { setCsvFile(e.target.files?.[0] || null); setGoogleSheetsUrl(''); }}
                />
              </div>

              <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '0.8rem' }}>— OR —</div>

              <div className="form-group">
                <label className="form-label">Public Google Sheets URL</label>
                <input type="text" className="form-input"
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  value={googleSheetsUrl}
                  onChange={e => { setGoogleSheetsUrl(e.target.value); setCsvFile(null); }}
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: '600', color: 'var(--primary)' }}>
                  Assign to Template <span style={{ color: 'var(--muted)', fontWeight: 'normal' }}>(required — determines which fields to map)</span>
                </label>
                <select className="form-select" value={importTemplateId} onChange={e => setImportTemplateId(e.target.value)} required>
                  <option value="">— Select a Template —</option>
                  {clientTemplates.map((t: any) => (
                    <option key={t.id} value={String(t.id)}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => { onCancel(); setImportResult(null); setImportStep('source'); }}>Cancel</button>
                <button type="button" className="btn btn-primary" disabled={parseLoading} onClick={handleParseFile}>
                  {parseLoading ? 'Detecting columns...' : 'Next — Map Columns →'}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: Column Mapping ───────────────────────────────────────── */}
          {importStep === 'mapping' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <h3 style={{ marginBottom: '6px' }}>Map Columns to Template Fields</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: 0 }}>
                  We auto-detected <strong style={{ color: 'var(--text)' }}>{parsedHeaders.length} columns</strong> in your file.
                  Map each template field to the correct source column. Required fields are marked <span style={{ color: '#f87171' }}>●</span>.
                </p>
              </div>

              {/* Preview table */}
              {parsedPreview.length > 0 && (
                <div style={{ overflowX: 'auto', border: '1px solid var(--glass-border)', borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                        {parsedHeaders.map(h => (
                          <th key={h} style={{ padding: '6px 10px', textAlign: 'left', borderBottom: '1px solid var(--glass-border)', whiteSpace: 'nowrap', color: 'var(--muted)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {parsedPreview.map((row, ri) => (
                        <tr key={ri} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          {parsedHeaders.map(h => (
                            <td key={h} style={{ padding: '5px 10px', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.73rem' }}>
                              {String(row[h] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Mapping rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', padding: '6px 0', borderBottom: '1px solid var(--glass-border)' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Template Field</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Source Column</span>
                </div>
                {templateFieldDefs.map(f => (
                  <div key={f.field} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                      {f.isRequired && <span style={{ color: '#f87171', fontSize: '0.65rem' }}>●</span>}
                      <code style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 7px', borderRadius: '4px', fontSize: '0.8rem' }}>{f.field}</code>
                      <span style={{ fontSize: '0.7rem', color: 'var(--muted)', background: 'rgba(255,255,255,0.04)', padding: '1px 5px', borderRadius: '3px' }}>{f.type}</span>
                      {f.isRequired && <span style={{ fontSize: '0.65rem', color: '#f87171', fontWeight: 600 }}>REQUIRED</span>}
                    </div>
                    <select
                      className="form-select"
                      style={{ padding: '5px 10px', fontSize: '0.82rem' }}
                      value={columnMapping[f.field] || ''}
                      onChange={e => setColumnMapping(prev => ({ ...prev, [f.field]: e.target.value }))}
                    >
                      <option value="">— Not mapped (skip) —</option>
                      {parsedHeaders.map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div className="form-group">
                <label className="form-label">Duplicate Collision Action</label>
                <select className="form-select" value={importMode} onChange={e => setImportMode(e.target.value)}>
                  <option value="check">Dry Run — List duplicates only, do not insert</option>
                  <option value="skip">Skip duplicates — Only insert new cardholders</option>
                  <option value="update">Update existing — Overwrite details, keep photo if blank</option>
                  <option value="overwrite">Overwrite — Delete & recreate existing records</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setImportStep('source')}>← Back</button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={importLoading}
                  onClick={e => { setImportStep('confirm'); handleCsvImport(e as any); }}
                >
                  {importLoading ? 'Importing...' : 'Confirm & Run Import →'}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Importing (progress) ─────────────────────────────────── */}
          {(importStep === 'validating' || (importStep === 'confirm' && importLoading)) && (
            <div style={{ textAlign: 'center', padding: '40px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '40px', height: '40px', border: '3px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>Running import pipeline…</p>
            </div>
          )}

          {/* ── Step 4: Done ─────────────────────────────────────────────────── */}
          {importStep === 'done' && importResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '16px', background: importResult.success !== false ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', border: importResult.success !== false ? '1px solid rgba(34,197,94,0.25)' : '1px solid rgba(239,68,68,0.25)', borderRadius: '10px' }}>
                {importResult.success !== false ? (
                  <CheckCircle size={22} color="var(--success)" />
                ) : (
                  <AlertTriangle size={22} color="var(--error)" />
                )}
                <div>
                  <div style={{ fontWeight: 700, color: importResult.success !== false ? 'var(--success)' : 'var(--error)' }}>
                    {importResult.success !== false ? `Import Complete — Mode: ${importResult.mode.toUpperCase()}` : 'Import Failed — Validation Errors'}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginTop: '4px' }}>
                    {importResult.success !== false ? (
                      `${importResult.newAdded} added · ${importResult.updated} updated · ${importResult.skipped} skipped · ${importResult.duplicateCount} duplicates`
                    ) : (
                      importResult.error || 'Validation failed. No records were imported.'
                    )}
                  </div>
                </div>
              </div>

              {/* Validation errors */}
              {importValidationErrors.length > 0 && (
                <div style={{ border: '1px solid rgba(245,158,11,0.3)', borderRadius: '10px', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: 'rgba(245,158,11,0.08)', borderBottom: '1px solid rgba(245,158,11,0.2)' }}>
                    <AlertTriangle size={16} color="#f59e0b" />
                    <span style={{ fontWeight: 600, color: '#f59e0b', fontSize: '0.875rem' }}>
                      {importValidationErrors.length} rows have validation errors
                    </span>
                  </div>
                  <div style={{ overflowY: 'auto', maxHeight: '260px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                      <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                          <th style={{ padding: '7px 12px', textAlign: 'left', borderBottom: '1px solid var(--glass-border)', color: 'var(--muted)', fontWeight: 600 }}>Row</th>
                          <th style={{ padding: '7px 12px', textAlign: 'left', borderBottom: '1px solid var(--glass-border)', color: 'var(--muted)', fontWeight: 600 }}>Name</th>
                          <th style={{ padding: '7px 12px', textAlign: 'left', borderBottom: '1px solid var(--glass-border)', color: 'var(--muted)', fontWeight: 600 }}>Validation Errors / Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importValidationErrors.map((err, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                            <td style={{ padding: '6px 12px', color: 'var(--muted)' }}>{err.row}</td>
                            <td style={{ padding: '6px 12px', fontWeight: 500 }}>{err.name}</td>
                            <td style={{ padding: '6px 12px' }}>
                              {err.missingFields.map((f, fi) => (
                                <span key={fi} style={{ display: 'inline-block', background: 'rgba(239,68,68,0.12)', color: '#f87171', borderRadius: '4px', padding: '1px 7px', fontSize: '0.72rem', marginRight: '4px', marginBottom: '2px' }}>{f}</span>
                              ))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => { onCancel(); }}>View Cardholders</button>
                <button type="button" className="btn btn-primary" onClick={() => {
                  setImportStep('source');
                  setImportResult(null);
                  setImportValidationErrors([]);
                  setCsvFile(null);
                  setGoogleSheetsUrl('');
                  setColumnMapping({});
                  setParsedHeaders([]);
                  setParsedPreview([]);
                }}>
                  Import Another File
                </button>
              </div>
            </div>
          )}
        </div>
  );
}
