'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { FileText, ImageIcon, CheckCircle, AlertTriangle, Upload, FolderOpen } from 'lucide-react';
import CompileWizardModal, { CompileWizardConfig } from '@/app/components/CompileWizardModal';
import { isElectronApp } from '@/lib/isElectron';
import { normalizeGoogleDriveUrl, isImageField, isPrimaryPhotoField } from '@/lib/pdf/field-resolver';
import { saveBatch, getBatch, clearBatch } from '@/lib/clientDb';

/**
 * Batch Import — turn a one-off Excel/CSV + photo ZIP into production/proof PDFs
 * entirely on the user's machine. The batch data lives in a local IndexedDB
 * store (never the cloud DB), is reviewed/edited, then rendered locally with the
 * same client generators the Cardholders tab uses and saved into the client's
 * folder. Credits are spent through an authoritative server call. The local
 * batch data is cleared once the batch has been compiled.
 */

interface TemplateFieldDef {
  field: string;
  type: string;
  isRequired?: boolean;
  side?: string;
}

interface ClientTemplate {
  id: number | string;
  name?: string;
}

const NAME_ALIASES = ['name', 'full name', 'fullname', 'student name', 'employee name', 'cardholder name'];
const DESIG_ALIASES = ['designation', 'role', 'class', 'grade', 'job title', 'post', 'position', 'department'];
const ID_ALIASES = ['id', 'idnumber', 'id no', 'id number', 'empid', 'rollnumber', 'roll no', 'roll', 'employee id', 'unique key', 'uniquekey', 'reg no', 'adm no', 'student id', 'roll number'];
const PHOTO_ALIASES = ['photo', 'photourl', 'photo url', 'image', 'picture', 'avatar', 'profile'];

const sanitizeKey = (str: string) => (str || '').toLowerCase().replace(/[^a-z0-9_\-]/g, '_');
const norm = (s: string) => (s || '').toLowerCase().trim();
const MM_TO_PT = 2.83464567;

// 1×1 opaque WHITE PNG — written into an image field that has no resolved photo.
// The active renderer draws nothing for an empty image (so the template's own
// photo-slot art, often a coloured shape, shows through). Painting an opaque
// white pixel stretched over the field box leaves that slot visibly blank
// instead of showing the template's placeholder shape.
const BLANK_PX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAABmJLR0QA/wD/AP+gvaeTAAAADUlEQVQImWP4////fwAJ+wP9CNHoHgAAAABJRU5ErkJggg==';

const isUrlLike = (v: string) =>
  /^(https?:)?\/\//i.test(v) || v.startsWith('data:image/') || v.includes('drive.google.com') || v.includes('docs.google.com');

export function BatchCompilePanel({
  clientName,
  clientTemplates = [],
  onCancel,
}: {
  clientName?: string;
  clientTemplates?: ClientTemplate[];
  onCancel: () => void;
}) {
  const [step, setStep] = useState<'upload' | 'review' | 'done'>('upload');

  // ── Upload state ──
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [templateId, setTemplateId] = useState<string>(() =>
    clientTemplates.length > 0 ? String(clientTemplates[0].id) : '');
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeStatus, setAnalyzeStatus] = useState('');
  const [error, setError] = useState('');

  // ── Parsed / review state ──
  const [fieldDefs, setFieldDefs] = useState<TemplateFieldDef[]>([]);
  const [fieldToHeader, setFieldToHeader] = useState<Record<string, string>>({});
  const [unmatchedHeaders, setUnmatchedHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [zipMap, setZipMap] = useState<Map<string, string>>(new Map());
  const [imageOverrides, setImageOverrides] = useState<Record<string, string>>({});
  const [hydrated, setHydrated] = useState(false);

  // ── Compile state ──
  const [showWizard, setShowWizard] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [compileProgress, setCompileProgress] = useState(0);
  const [savedResult, setSavedResult] = useState<
    { count: number; type: string; parts: number; creditsCharged: number; remaining: number } | null
  >(null);

  const imageFields = useMemo(() => fieldDefs.filter(f => isImageField(f)), [fieldDefs]);
  const mappedFields = useMemo(
    () => fieldDefs.filter(f => fieldToHeader[f.field]),
    [fieldDefs, fieldToHeader]
  );

  const classifyField = (fieldName: string) => {
    const n = norm(fieldName);
    if (NAME_ALIASES.includes(n)) return 'name';
    if (DESIG_ALIASES.includes(n)) return 'designation';
    if (ID_ALIASES.includes(n)) return 'id';
    if (PHOTO_ALIASES.includes(n)) return 'photo';
    return null;
  };

  const primaryPhotoField = useMemo(() => {
    if (imageFields.length === 0) return null;
    const named = imageFields.find(f => classifyField(f.field) === 'photo');
    return (named || imageFields[0]).field;
  }, [imageFields]);

  const nameFieldName = useMemo(() => fieldDefs.find(f => classifyField(f.field) === 'name')?.field, [fieldDefs]);
  const idFieldName = useMemo(() => fieldDefs.find(f => classifyField(f.field) === 'id')?.field, [fieldDefs]);

  // Pure ZIP lookup: match a candidate string against photo filenames (with/without
  // extension, space/underscore-insensitive). Returns the photo data URL or ''.
  const zipMatch = (candidate: string): string => {
    const s = (candidate || '').trim();
    if (!s || zipMap.size === 0) return '';
    const base = s.split('/').pop() || s;
    const noExt = base.replace(/\.[^.]+$/, '');
    return (
      zipMap.get(norm(s)) || zipMap.get(norm(base)) ||
      zipMap.get(sanitizeKey(base)) || zipMap.get(sanitizeKey(noExt)) || ''
    );
  };

  // Columns shown in the review grid: every mapped field, plus the primary photo
  // field even when it has no Excel column (photos matched by ID/name).
  const reviewFields = useMemo(() => {
    const list = [...mappedFields];
    if (primaryPhotoField && !list.some(f => f.field === primaryPhotoField)) {
      const pf = fieldDefs.find(f => f.field === primaryPhotoField);
      if (pf) list.push(pf);
    }
    return list;
  }, [mappedFields, primaryPhotoField, fieldDefs]);

  // Resolve an image cell value to a renderable src (upload override → direct URL → zip match)
  const resolveImageSrc = (rowIdx: number, fieldName: string, value: string): string => {
    const override = imageOverrides[`${rowIdx}:${fieldName}`];
    if (override) return override;
    const v = (value || '').trim();
    if (!v) return '';
    // Prefer a ZIP photo matched by filename/id (the feature's intent), so a
    // spreadsheet value that merely looks like a URL doesn't shadow the real photo.
    if (zipMap.size > 0) {
      const base = v.split('/').pop() || v;
      const noExt = base.replace(/\.[^.]+$/, '');
      const m =
        zipMap.get(norm(v)) || zipMap.get(norm(base)) ||
        zipMap.get(sanitizeKey(base)) || zipMap.get(sanitizeKey(noExt));
      if (m) return m;
    }
    if (isUrlLike(v)) return normalizeGoogleDriveUrl(v) || v;
    return '';
  };

  // ── Hydrate an in-progress batch from IndexedDB on mount ──
  useEffect(() => {
    (async () => {
      try {
        const b = await getBatch();
        if (b && b.rows?.length) {
          setFieldDefs(b.fieldDefs || []);
          setFieldToHeader(b.fieldToHeader || {});
          setUnmatchedHeaders(b.unmatchedHeaders || []);
          setRows(b.rows);
          setZipMap(new Map(Object.entries(b.zip || {})));
          setImageOverrides(b.overrides || {});
          if (b.templateId) setTemplateId(b.templateId);
          setStep('review');
        }
      } catch { /* ignore — start fresh */ }
      setHydrated(true);
    })();
  }, []);

  // ── Persist edits to IndexedDB while reviewing (debounced so typing a large
  //    batch doesn't re-serialize the photo set on every keystroke) ──
  useEffect(() => {
    if (!hydrated || step !== 'review' || rows.length === 0) return;
    const t = setTimeout(() => {
      void saveBatch({
        rows,
        fieldDefs,
        fieldToHeader,
        unmatchedHeaders,
        templateId,
        zip: Object.fromEntries(zipMap),
        overrides: imageOverrides,
      });
    }, 1000);
    return () => clearTimeout(t);
  }, [hydrated, step, rows, fieldDefs, fieldToHeader, unmatchedHeaders, templateId, zipMap, imageOverrides]);

  const resetAll = () => {
    setStep('upload');
    setExcelFile(null); setZipFile(null);
    setFieldDefs([]); setFieldToHeader({}); setUnmatchedHeaders([]);
    setRows([]); setZipMap(new Map()); setImageOverrides({});
    setSavedResult(null); setError('');
  };

  // ── Step 1: parse spreadsheet + template fields + zip photos ──
  const handleAnalyze = async () => {
    if (!excelFile) { setError('Please select an Excel or CSV file.'); return; }
    if (!templateId) { setError('Please select a template.'); return; }
    setError('');
    setAnalyzing(true);
    try {
      setAnalyzeStatus('Parsing spreadsheet...');
      let parsed: Record<string, any>[] = [];
      const lower = excelFile.name.toLowerCase();
      if (lower.endsWith('.csv')) {
        const text = await excelFile.text();
        const Papa = (await import('papaparse')).default;
        parsed = (Papa.parse(text, { header: true, skipEmptyLines: true }).data as any[]) || [];
      } else {
        const ExcelJS = (await import('exceljs')).default;
        const buffer = await excelFile.arrayBuffer();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer as any);
        const sheet = workbook.worksheets[0];
        if (!sheet) throw new Error('The spreadsheet contains no sheets.');
        const headers = (sheet.getRow(1).values as (string | undefined)[]).slice(1);
        sheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return;
          const obj: Record<string, any> = {};
          (row.values as any[]).slice(1).forEach((cell, idx) => {
            const key = headers[idx];
            if (key) obj[key as string] = cell?.text ?? cell ?? '';
          });
          parsed.push(obj);
        });
      }
      if (parsed.length === 0) throw new Error('No data rows found in the spreadsheet.');
      const headers = Object.keys(parsed[0]);

      setAnalyzeStatus('Loading template fields...');
      const fRes = await fetch(`/api/templates/${templateId}/fields`);
      if (!fRes.ok) throw new Error('Failed to load template fields.');
      const fJson = await fRes.json();
      const seen = new Set<string>();
      const defs: TemplateFieldDef[] = ((fJson.fields || []) as TemplateFieldDef[]).filter(f => {
        if (!f.field || seen.has(norm(f.field))) return false;
        seen.add(norm(f.field));
        return true;
      });
      if (defs.length === 0) throw new Error('The selected template has no fields defined.');

      // Match each Excel header to a template field by name (case-insensitive)
      const f2h: Record<string, string> = {};
      const usedHeaders = new Set<string>();
      for (const def of defs) {
        const match = headers.find(h => norm(h) === norm(def.field));
        if (match) { f2h[def.field] = match; usedHeaders.add(match); }
      }
      const unmatched = headers.filter(h => !usedHeaders.has(h));

      // Extract ZIP photos → data URLs (keyed by several sanitized variants)
      const photoMap = new Map<string, string>();
      if (zipFile) {
        setAnalyzeStatus('Extracting photos from ZIP...');
        const JSZip = (await import('jszip')).default;
        const zip = await JSZip.loadAsync(await zipFile.arrayBuffer());
        const imageEntries = Object.entries(zip.files).filter(([name, entry]) => {
          if (entry.dir) return false;
          const ext = name.split('.').pop()?.toLowerCase() || '';
          return ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif'].includes(ext);
        });
        for (const [fileName, entry] of imageEntries) {
          const base = fileName.split('/').pop() || fileName;
          const noExt = base.replace(/\.[^.]+$/, '');
          const blob = await entry.async('blob');
          const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
          photoMap.set(norm(base), dataUrl);
          photoMap.set(norm(noExt), dataUrl);
          photoMap.set(sanitizeKey(base), dataUrl);
          photoMap.set(sanitizeKey(noExt), dataUrl);
        }
      }

      // Build rows keyed by template field name. When the primary photo field has
      // no Excel column, seed its match-key from the record's ID (or name) so
      // photos named e.g. "SA-2024-001.png" match by uniqueKey.
      const imgDefs = defs.filter(d => isImageField(d));
      const primaryLocal = imgDefs.length
        ? (imgDefs.find(d => PHOTO_ALIASES.includes(norm(d.field))) || imgDefs[0]).field
        : null;
      const idFieldName = defs.find(d => classifyField(d.field) === 'id' && f2h[d.field])?.field;
      const nameFieldName = defs.find(d => classifyField(d.field) === 'name' && f2h[d.field])?.field;

      const builtRows: Record<string, string>[] = parsed.map(pr => {
        const r: Record<string, string> = {};
        for (const def of defs) {
          const h = f2h[def.field];
          r[def.field] = h ? String(pr[h] ?? '').trim() : '';
        }
        if (primaryLocal && !f2h[primaryLocal]) {
          r[primaryLocal] =
            (idFieldName ? r[idFieldName] : '') || (nameFieldName ? r[nameFieldName] : '') || '';
        }
        return r;
      });

      setFieldDefs(defs);
      setFieldToHeader(f2h);
      setUnmatchedHeaders(unmatched);
      setZipMap(photoMap);
      setImageOverrides({});
      setRows(builtRows);
      setSavedResult(null);
      // Persist the fresh working set immediately.
      await saveBatch({
        rows: builtRows, fieldDefs: defs, fieldToHeader: f2h, unmatchedHeaders: unmatched,
        templateId, zip: Object.fromEntries(photoMap), overrides: {},
      });
      setStep('review');
    } catch (err: any) {
      setError(err.message || 'Failed to analyze files.');
    } finally {
      setAnalyzing(false);
      setAnalyzeStatus('');
    }
  };

  const updateCell = (rowIdx: number, fieldName: string, value: string) => {
    setRows(prev => prev.map((r, i) => (i === rowIdx ? { ...r, [fieldName]: value } : r)));
  };

  const handleImageUpload = (rowIdx: number, fieldName: string, file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setImageOverrides(prev => ({ ...prev, [`${rowIdx}:${fieldName}`]: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  // Look up a value in a row by field name, tolerating case/spacing differences
  // between the /fields names (row keys) and the template JSON field keys.
  const rowValueByName = (row: Record<string, string>, name: string): string => {
    if (row[name] !== undefined) return row[name];
    const t = norm(name);
    for (const k of Object.keys(row)) if (norm(k) === t) return row[k];
    return '';
  };
  const overrideByName = (idx: number, name: string): string => {
    const direct = imageOverrides[`${idx}:${name}`];
    if (direct) return direct;
    const t = norm(name);
    for (const k of Object.keys(imageOverrides)) {
      const sep = k.indexOf(':');
      if (Number(k.slice(0, sep)) === idx && norm(k.slice(sep + 1)) === t) return imageOverrides[k];
    }
    return '';
  };
  const resolveImageForKey = (idx: number, name: string, val: string): string => {
    const ov = overrideByName(idx, name);
    if (ov) return ov;
    const v = (val || '').trim();
    if (!v) return '';
    if (zipMap.size > 0) {
      const base = v.split('/').pop() || v;
      const noExt = base.replace(/\.[^.]+$/, '');
      const m =
        zipMap.get(norm(v)) || zipMap.get(norm(base)) ||
        zipMap.get(sanitizeKey(base)) || zipMap.get(sanitizeKey(noExt));
      if (m) return m;
    }
    if (isUrlLike(v)) return normalizeGoogleDriveUrl(v) || v;
    return '';
  };

  // ── Step 3: render locally + save into the client folder, deduct credits ──
  const handleCompile = async (cfg: CompileWizardConfig) => {
    if (!isElectronApp()) {
      setError('PDF generation runs in the Desktop (Electron) app. Please open this in the desktop client.');
      setShowWizard(false);
      return;
    }
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI?.savePdfLocally) {
      setError('Local save is unavailable in this environment.');
      setShowWizard(false);
      return;
    }
    setCompiling(true);
    setCompileProgress(3);
    setError('');
    try {
      // 1. Load the full template (for the actual front/back field keys + images) + fonts.
      const [tplRes, fontsRes] = await Promise.all([
        fetch(`/api/templates/${templateId}?_t=${Date.now()}`),
        fetch('/api/fonts').catch(() => null),
      ]);
      if (!tplRes.ok) throw new Error('Failed to load template details.');
      const template = (await tplRes.json()).template;
      if (!template) throw new Error('Template not found.');
      const pressFonts = fontsRes && fontsRes.ok ? ((await fontsRes.json()).fonts || []) : [];

      // The renderer reads field keys from the template's front/back JSON, so we
      // key customFields by those exact names (not the /fields endpoint names).
      const parseFields = (s: any): Array<{ field: string; type?: string }> => {
        try { return typeof s === 'string' ? JSON.parse(s || '[]') : (s || []); } catch { return []; }
      };
      const jsonFieldsRaw = [...parseFields(template.frontFields), ...parseFields(template.backFields)];
      const seenJf = new Set<string>();
      const jsonFields = jsonFieldsRaw.filter(f => {
        if (!f?.field || seenJf.has(f.field)) return false;
        seenJf.add(f.field);
        return true;
      });
      const imageKeys = jsonFields.filter(f => isImageField(f) || f.type === 'image').map(f => f.field);
      const primaryKey = imageKeys.find(k => isPrimaryPhotoField(k)) ?? imageKeys[0] ?? null;

      // 2. Build cardholder objects from the (edited) rows.
      const cardholders = rows.map((row, idx) => {
        const customFields: Record<string, any> = {};
        let photoUrl: string | null = null;

        for (const jf of jsonFields) {
          const key = jf.field;
          const rowVal = rowValueByName(row, key);
          if (isImageField(jf) || jf.type === 'image') {
            const src = resolveImageForKey(idx, key, rowVal);
            // No photo → opaque white so the template's placeholder shape is covered.
            customFields[key] = src || BLANK_PX;
            if (key === primaryKey && src) photoUrl = src;
          } else if (rowVal) {
            customFields[key] = rowVal;
          }
        }

        // Core props from the classified /fields columns (used for photo resolution + display).
        let name = '';
        let designation: string | null = null;
        let uniqueKey: string | null = null;
        for (const def of fieldDefs) {
          const kind = classifyField(def.field);
          const val = rowValueByName(row, def.field);
          if (kind === 'name' && val) name = val;
          else if (kind === 'designation' && val) designation = val;
          else if (kind === 'id' && val) uniqueKey = val;
        }

        return {
          id: idx + 1,
          name: name || `Record ${idx + 1}`,
          designation,
          photoUrl,
          cardSerial: null,
          uniqueKey,
          customFields,
        };
      });
      if (cardholders.length === 0) throw new Error('No records to compile.');

      // TEMP diagnostics — confirm photo data reaches the renderer.
      try {
        const c0: any = cardholders[0];
        const imgSummary = imageKeys.map(k => {
          const val = String(c0.customFields?.[k] ?? '');
          const kind = val.startsWith('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB')
            ? 'BLANK' : val.startsWith('data:') ? `data(${val.length})` : val.slice(0, 48);
          return `${k}=${kind}`;
        });
        console.log('[BatchCompile] jsonFields=', jsonFields.map(f => `${f.field}:${f.type}`).join(','));
        console.log('[BatchCompile] imageKeys=', imageKeys, 'primaryKey=', primaryKey, 'zipMap=', zipMap.size);
        console.log('[BatchCompile] card0 name=', c0.name, 'photoUrl=', c0.photoUrl ? c0.photoUrl.slice(0, 40) : null,
          'images:', imgSummary.join(' | '));
      } catch {}

      // 3. Authoritative credit deduction BEFORE the expensive render.
      setCompileProgress(8);
      const credRes = await fetch('/api/jobs/consume-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: Number(templateId),
          cardCount: cardholders.length,
          pdfType: cfg.compileType,
        }),
      });
      const credJson = await credRes.json();
      if (!credRes.ok) throw new Error(credJson.error || 'Credit deduction failed.');

      // 4. Render locally (chunked so no single file/IPC payload is too large).
      const dateStr = new Date().toISOString().slice(0, 10);
      const kind = cfg.compileType === 'PRODUCTION' ? 'production' : 'approval';
      let blobs: Blob[];

      if (cfg.compileType === 'PRODUCTION') {
        const custom =
          cfg.paperSize === 'SRA3'
            ? { w: cfg.orientation === 'PORTRAIT' ? 907.09 : 1275.59, h: cfg.orientation === 'PORTRAIT' ? 1275.59 : 907.09 }
            : cfg.paperSize === '13x19'
            ? { w: cfg.orientation === 'PORTRAIT' ? 936 : 1368, h: cfg.orientation === 'PORTRAIT' ? 1368 : 936 }
            : null;
        const { generateProductionPdfChunkedClient } = await import('@/lib/pdf/production-pdf-generator');
        blobs = await generateProductionPdfChunkedClient(
          template,
          cardholders,
          {
            paperSize: custom ? 'CUSTOM' : (cfg.paperSize as any),
            orientation: cfg.orientation,
            customWidth: custom?.w,
            customHeight: custom?.h,
            bleed: (cfg.bleed || 0) * MM_TO_PT,
            cropMarks: cfg.cropMarks,
            foldLine: cfg.foldLine,
            marginLeft: cfg.marginLeft,
            marginRight: cfg.marginRight,
            marginTop: cfg.marginTop,
            marginBottom: cfg.marginBottom,
            colGap: cfg.colGap,
            rowGap: cfg.rowGap,
            emptySlotStrategy: cfg.emptySlotStrategy === 'FILL_CUSTOM' ? 'LEAVE_BLANK' : cfg.emptySlotStrategy,
          },
          pressFonts,
          (pct) => setCompileProgress(Math.min(94, Math.max(10, Math.round(pct))))
        );
      } else {
        const { generateApprovalPdfClient } = await import('@/lib/pdf/approval-pdf-generator');
        const hasBack = !!template.backImageUrl || (template.backFields && template.backFields !== '[]');
        const perChunk = (hasBack ? 4 : 8) * 15;
        const totalChunks = Math.max(1, Math.ceil(cardholders.length / perChunk));
        blobs = [];
        for (let i = 0; i < totalChunks; i++) {
          setCompileProgress(Math.round(10 + (i / totalChunks) * 84));
          const slice = cardholders.slice(i * perChunk, (i + 1) * perChunk);
          blobs.push(await generateApprovalPdfClient(clientName || 'Client', 'Batch Import', template, slice, pressFonts));
        }
      }

      // 5. Save each chunk into the client folder.
      const total = blobs.length;
      for (let i = 0; i < total; i++) {
        const part = total > 1 ? `_part${i + 1}of${total}` : '';
        const fileName = `${kind}_batch_${cardholders.length}cards_${dateStr}${part}.pdf`;
        const bytes = new Uint8Array(await blobs[i].arrayBuffer());
        let binary = '';
        const CHUNK = 0x8000;
        for (let j = 0; j < bytes.length; j += CHUNK) {
          binary += String.fromCharCode.apply(null, bytes.subarray(j, j + CHUNK) as unknown as number[]);
        }
        const base64 = btoa(binary);
        const res = await electronAPI.savePdfLocally(fileName, base64, clientName || 'Client');
        if (res && res.success === false) throw new Error(res.error || 'Failed to save PDF.');
        setCompileProgress(Math.min(100, Math.round(94 + ((i + 1) / total) * 6)));
      }

      // 6. Batch processed — clear the local working data (do not persist).
      await clearBatch().catch(() => {});

      setSavedResult({
        count: cardholders.length,
        type: cfg.compileType,
        parts: total,
        creditsCharged: credJson.creditsCharged ?? 0,
        remaining: credJson.remainingCredits ?? 0,
      });
      setShowWizard(false);
      setStep('done');
    } catch (err: any) {
      setError(err.message || 'Compilation failed.');
    } finally {
      setCompiling(false);
    }
  };

  const renderStepIndicator = () => {
    const steps = [
      { key: 'upload', label: '1. Import & Map' },
      { key: 'review', label: '2. Review & Edit' },
      { key: 'done', label: '3. Compile PDF' },
    ];
    const order = ['upload', 'review', 'done'];
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0', marginBottom: '28px' }}>
        {steps.map((s, i) => {
          const isActive = s.key === step;
          const isDone = order.indexOf(step) > order.indexOf(s.key);
          return (
            <React.Fragment key={s.key}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 14px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600,
                background: isActive ? '#6366f1' : isDone ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.05)',
                color: isActive ? '#fff' : isDone ? '#818cf8' : 'var(--muted)',
              }}>
                {isDone && <CheckCircle size={12} />}
                {s.label}
              </div>
              {i < steps.length - 1 && <div style={{ flex: 1, height: '1px', background: 'var(--glass-border)', minWidth: '12px' }} />}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  const errorBox = error ? (
    <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f77', borderRadius: '6px', marginBottom: '20px', fontSize: '0.85rem' }}>
      {error}
    </div>
  ) : null;

  // ── STEP 1: Upload ──
  if (step === 'upload') {
    return (
      <div className="glass-panel" style={{ width: '100%' }}>
        {renderStepIndicator()}
        <div style={{ marginBottom: '16px' }}>
          <h3 style={{ margin: '0 0 6px' }}>Batch Import → PDF (local)</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: 0 }}>
            Upload a spreadsheet and a photo ZIP. The batch is processed on this machine (stored in a
            local database, not the cloud) and the PDF is saved to the client folder. Credits are
            charged as normal. The local data is cleared once the batch is compiled.
          </p>
        </div>
        {errorBox}

        <div className="form-group">
          <label className="form-label" style={{ fontWeight: 600, color: 'var(--primary)' }}>
            Template <span style={{ color: 'var(--muted)', fontWeight: 'normal', fontSize: '0.75rem' }}>(required)</span>
          </label>
          <select className="form-select" value={templateId} onChange={e => setTemplateId(e.target.value)} required>
            <option value="">— Select a Template —</option>
            {clientTemplates.map(t => (
              <option key={t.id} value={String(t.id)}>{t.name}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FileText size={16} /> Excel / CSV File
          </label>
          <input type="file" accept=".xlsx,.xls,.csv" className="form-input" onChange={e => setExcelFile(e.target.files?.[0] || null)} />
        </div>

        <div className="form-group">
          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ImageIcon size={16} /> Photos ZIP <span style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 'normal' }}>(optional)</span>
          </label>
          <input type="file" accept=".zip" className="form-input" onChange={e => setZipFile(e.target.files?.[0] || null)} />
          <p style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '4px' }}>
            Photos are matched to each record by ID / name, or by an image column value (e.g. <code>101.jpg</code>).
          </p>
        </div>

        {analyzeStatus && (
          <div style={{ fontSize: '0.8rem', color: 'var(--primary)', marginBottom: '12px' }}>{analyzeStatus}</div>
        )}

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
          <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn btn-primary" disabled={analyzing || !excelFile || !templateId} onClick={handleAnalyze}>
            {analyzing ? 'Analyzing…' : 'Next — Review Records →'}
          </button>
        </div>
      </div>
    );
  }

  // ── STEP 2: Review & Edit ──
  if (step === 'review') {
    return (
      <div className="glass-panel" style={{ width: '100%' }}>
        {renderStepIndicator()}
        {errorBox}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div style={{ fontSize: '0.85rem' }}>
            <strong>{rows.length}</strong> record(s) · <strong>{mappedFields.length}</strong> mapped field(s)
            {imageFields.length > 0 && <> · <strong>{imageFields.length}</strong> image column(s)</>}
          </div>
          {unmatchedHeaders.length > 0 && (
            <div style={{ fontSize: '0.75rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertTriangle size={13} /> Unmatched columns ignored: {unmatchedHeaders.join(', ')}
            </div>
          )}
        </div>

        <div style={{ overflow: 'auto', maxHeight: '55vh', border: '1px solid var(--glass-border)', borderRadius: '8px', marginBottom: '20px' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: '0.8rem', width: '100%' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                <th style={{ padding: '8px 10px', textAlign: 'left', position: 'sticky', top: 0, background: '#12151d' }}>#</th>
                {reviewFields.map(f => (
                  <th key={f.field} style={{ padding: '8px 10px', textAlign: 'left', whiteSpace: 'nowrap', position: 'sticky', top: 0, background: '#12151d', color: 'var(--muted)' }}>
                    {f.field}
                    <span style={{ marginLeft: '6px', fontSize: '0.65rem', background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: '3px' }}>{f.type}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '6px 10px', color: 'var(--muted)' }}>{ri + 1}</td>
                  {reviewFields.map(f => {
                    if (isImageField(f)) {
                      const src = resolveImageSrc(ri, f.field, row[f.field] || '');
                      return (
                        <td key={f.field} style={{ padding: '6px 10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {src ? (
                              <img src={src} alt="" style={{ width: '34px', height: '34px', objectFit: 'cover', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }} />
                            ) : (
                              <div style={{ width: '34px', height: '34px', borderRadius: '4px', background: 'rgba(239,68,68,0.1)', border: '1px dashed rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171', flexShrink: 0 }}>
                                <ImageIcon size={14} />
                              </div>
                            )}
                            <input
                              className="form-input"
                              style={{ padding: '4px 8px', fontSize: '0.78rem', width: '110px' }}
                              value={row[f.field] || ''}
                              placeholder="filename"
                              onChange={e => updateCell(ri, f.field, e.target.value)}
                            />
                            <label title="Upload replacement image" style={{ cursor: 'pointer', color: 'var(--muted)', display: 'inline-flex' }}>
                              <Upload size={14} />
                              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleImageUpload(ri, f.field, e.target.files?.[0] || null)} />
                            </label>
                          </div>
                        </td>
                      );
                    }
                    return (
                      <td key={f.field} style={{ padding: '6px 10px' }}>
                        <input
                          className="form-input"
                          style={{ padding: '4px 8px', fontSize: '0.78rem', minWidth: '120px' }}
                          value={row[f.field] || ''}
                          onChange={e => updateCell(ri, f.field, e.target.value)}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
          <button type="button" className="btn btn-secondary" onClick={() => setStep('upload')}>← Back</button>
          <button type="button" className="btn btn-primary" disabled={rows.length === 0} onClick={() => { setError(''); setShowWizard(true); }}>
            Compile PDF →
          </button>
        </div>

        {showWizard && (
          <CompileWizardModal
            cardCount={rows.length}
            compiling={compiling}
            progress={compileProgress}
            onClose={() => { if (!compiling) setShowWizard(false); }}
            onCompile={handleCompile}
          />
        )}
      </div>
    );
  }

  // ── STEP 3: Done ──
  return (
    <div className="glass-panel" style={{ width: '100%' }}>
      {renderStepIndicator()}
      {errorBox}
      {savedResult && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: '10px' }}>
          <CheckCircle size={22} color="var(--success)" />
          <div>
            <div style={{ fontWeight: 700, color: 'var(--success)' }}>
              {savedResult.type === 'PRODUCTION' ? 'Production' : 'Proof'} PDF saved locally
              {savedResult.parts > 1 ? ` (${savedResult.parts} parts)` : ''}
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FolderOpen size={14} />
              {savedResult.count} card(s) → saved to the client folder · {savedResult.creditsCharged} credit(s)
              charged · {savedResult.remaining} remaining.
            </div>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Close</button>
        <button type="button" className="btn btn-primary" onClick={resetAll}>New Batch</button>
      </div>
    </div>
  );
}
