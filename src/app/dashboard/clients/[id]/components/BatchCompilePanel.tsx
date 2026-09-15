'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FileText, ImageIcon, CheckCircle, AlertTriangle, Upload, FolderOpen, Search, X, Link as LinkIcon, HelpCircle, Eye, Trash2 } from 'lucide-react';
import CompileWizardModal, { CompileWizardConfig } from '@/app/components/CompileWizardModal';
import { isElectronApp } from '@/lib/isElectron';
import {
  normalizeGoogleDriveUrl,
  isImageField,
  parseTemplateFields,
  pickPrimaryPhotoKey,
  type TemplateFieldDef,
} from '@/lib/pdf/field-resolver';
import { saveBatch, getBatch, clearBatch, type BatchKey } from '@/lib/clientDb';
import { remapAfterRowDelete } from './batchRows';
import { uint8ArrayToBase64 } from '@/lib/downloadHelper';

/**
 * Batch Import — turn a one-off Excel/CSV + photo ZIP into production/proof PDFs
 * entirely on the user's machine. The batch data lives in a local IndexedDB
 * store (never the cloud DB), is reviewed/edited, then rendered locally with the
 * same client generators the Cardholders tab uses and saved into the client's
 * folder. Credits are spent through an authoritative server call. The local
 * batch data is cleared once the batch has been compiled.
 */

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

// Photo formats accepted from the ZIP. Limited to what a Chromium renderer can
// decode, because that decode is what turns the file into PDF-embeddable bytes —
// a format the browser cannot read (tiff, heic) would silently print blank.
// Matching itself ignores the extension: every entry is also keyed by its bare
// stem, so "101" in the spreadsheet finds 101.jpg, 101.JPEG or 101.webp alike.
const IMAGE_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'jfif', 'png', 'apng', 'webp', 'avif', 'bmp', 'gif',
]);

/** The template shape the client renderer needs for a preview. */
type TemplateForRender = {
  cardWidth: number;
  cardHeight: number;
  frontImageUrl: string;
  backImageUrl: string | null;
  frontFields: string;
  backFields: string;
};

const isUrlLike = (v: string) =>
  /^(https?:)?\/\//i.test(v) || v.startsWith('data:image/') || v.includes('drive.google.com') || v.includes('docs.google.com');

export function BatchCompilePanel({
  clientName,
  clientTemplates = [],
  onCancel,
  source = 'files',
}: {
  clientName?: string;
  clientTemplates?: ClientTemplate[];
  onCancel: () => void;
  /**
   * Where step 1 gets its rows. 'files' is a local spreadsheet + optional photo
   * ZIP; 'googleForm' is a link-shared Google Sheet (the sheet a Google Form
   * writes responses to), whose photo columns are Drive URLs instead of a ZIP.
   * Everything from the review grid onwards is identical.
   */
  source?: 'files' | 'googleForm';
}) {
  const isGoogleForm = source === 'googleForm';
  // Each surface owns its own IndexedDB slot so a batch in progress on one tab
  // is not overwritten by the other.
  const batchKey: BatchKey = isGoogleForm ? 'gform' : 'current';
  const [step, setStep] = useState<'upload' | 'review' | 'done'>('upload');

  // ── Upload state ──
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [templateId, setTemplateId] = useState<string>(() =>
    clientTemplates.length > 0 ? String(clientTemplates[0].id) : '');
  const [sheetUrl, setSheetUrl] = useState('');
  // ── Row preview ──
  const [previewRow, setPreviewRow] = useState<number | null>(null);
  const [previewSide, setPreviewSide] = useState<'front' | 'back'>('front');
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [previewHasBack, setPreviewHasBack] = useState(false);
  // Template + fonts are the same for every row, so fetch once and reuse.
  const previewAssets = useRef<{
    templateId: string;
    template: TemplateForRender;
    fonts: Array<{ name: string; fileUrl: string }>;
  } | null>(null);
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
  // Indices of the rows to compile. Rows are index-keyed throughout this panel
  // (imageOverrides uses `${rowIdx}:${fieldName}`) and none are added or removed
  // after import, so indices are stable identifiers.
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  // Review-grid filter. Narrows what is shown; never changes the selection, so a
  // row selected under one query stays selected (and still compiles) under another.
  const [search, setSearch] = useState('');
  const [hydrated, setHydrated] = useState(false);

  // ── Compile state ──
  const [showWizard, setShowWizard] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [compileProgress, setCompileProgress] = useState(0);
  const [savedResult, setSavedResult] = useState<
    { count: number; type: string; parts: number; creditsCharged: number; remaining: number; savedPath: string } | null
  >(null);
  // Set when the operator has been shown the missing-photo count and chose to proceed.
  const [ackMissingPhotos, setAckMissingPhotos] = useState(false);

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

  // Must match the renderer's own choice exactly — see pickPrimaryPhotoKey.
  const primaryPhotoField = useMemo(
    () => pickPrimaryPhotoKey(imageFields),
    [imageFields]
  );

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

  // ── Hydrate an in-progress batch from IndexedDB on mount ──
  useEffect(() => {
    (async () => {
      try {
        const b = await getBatch(batchKey);
        if (b && b.rows?.length) {
          setFieldDefs(b.fieldDefs || []);
          setFieldToHeader(b.fieldToHeader || {});
          setUnmatchedHeaders(b.unmatchedHeaders || []);
          setRows(b.rows);
          setZipMap(new Map(Object.entries(b.zip || {})));
          setImageOverrides(b.overrides || {});
          setSelectedRows(b.selectedRows ?? b.rows.map((_, i) => i));
          if (b.templateId) setTemplateId(b.templateId);
          setStep('review');
        }
      } catch { /* ignore — start fresh */ }
      setHydrated(true);
    })();
  }, [batchKey]);

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
        selectedRows,
      }, batchKey);
    }, 1000);
    return () => clearTimeout(t);
  }, [hydrated, step, rows, fieldDefs, fieldToHeader, unmatchedHeaders, templateId, zipMap, imageOverrides, selectedRows, batchKey]);

  const resetAll = () => {
    setStep('upload');
    setExcelFile(null); setZipFile(null);
    setFieldDefs([]); setFieldToHeader({}); setUnmatchedHeaders([]);
    setRows([]); setZipMap(new Map()); setImageOverrides({});
    setSelectedRows([]); setSearch(''); setSheetUrl('');
    setSavedResult(null); setError(''); setAckMissingPhotos(false);
  };

  // ── Step 1: parse spreadsheet + template fields + zip photos ──
  const handleAnalyze = async () => {
    if (isGoogleForm) {
      if (!sheetUrl.trim()) { setError('Paste the link to the form\u2019s responses sheet.'); return; }
    } else if (!excelFile) {
      setError('Please select an Excel or CSV file.'); return;
    }
    if (!templateId) { setError('Please select a template.'); return; }
    setError('');
    setAnalyzing(true);
    try {
      let parsed: Record<string, any>[] = [];
      if (isGoogleForm) {
        setAnalyzeStatus('Fetching responses from Google Sheets\u2026');
        // Server-side: Google's /export endpoint sends no CORS headers.
        const res = await fetch('/api/import/google-sheet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: sheetUrl.trim() }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || 'Failed to fetch that sheet.');
        parsed = json.rows || [];
      } else {
      setAnalyzeStatus('Parsing spreadsheet...');
      const lower = excelFile!.name.toLowerCase();
      if (lower.endsWith('.csv')) {
        const text = await excelFile!.text();
        const Papa = (await import('papaparse')).default;
        parsed = (Papa.parse(text, { header: true, skipEmptyLines: true }).data as any[]) || [];
      } else {
        const ExcelJS = (await import('exceljs')).default;
        const buffer = await excelFile!.arrayBuffer();
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
      }
      if (parsed.length === 0) throw new Error('No data rows found in the spreadsheet.');
      const headers = Object.keys(parsed[0]);

      setAnalyzeStatus('Loading template fields...');
      const fRes = await fetch(`/api/templates/${templateId}?_t=${Date.now()}`);
      if (!fRes.ok) throw new Error('Failed to load template fields.');
      const defs = parseTemplateFields((await fRes.json()).template);
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
          const base = name.split('/').pop() || name;
          // Skip the AppleDouble resource forks macOS adds when zipping on a Mac.
          // They carry the same names as the real photos but hold no image data.
          if (name.startsWith('__MACOSX/') || base.startsWith('._')) return false;
          const ext = base.split('.').pop()?.toLowerCase() || '';
          return IMAGE_EXTENSIONS.has(ext);
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
      const primaryLocal = pickPrimaryPhotoKey(defs.filter(d => isImageField(d)));
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
      const allSelected = builtRows.map((_, i) => i);
      setSelectedRows(allSelected);
      setSavedResult(null);
      // Persist the fresh working set immediately.
      await saveBatch({
        rows: builtRows, fieldDefs: defs, fieldToHeader: f2h, unmatchedHeaders: unmatched,
        templateId, zip: Object.fromEntries(photoMap), overrides: {},
        selectedRows: allSelected,
      }, batchKey);
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

  // ── Review-grid filter ──
  // Holds ORIGINAL row indices, never grid positions: overrides, updateCell,
  // toggleRow and photoStats are all keyed on the original index.
  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all = rows.map((_, i) => i);
    if (!q) return all;
    return all.filter(i => {
      const row = rows[i];
      if (!row) return false;
      if (String(i + 1) === q) return true; // match the displayed row number
      return reviewFields.some(f => {
        const v = rowValueByName(row, f.field);
        return v && v.toLowerCase().includes(q);
      });
    });
  }, [rows, search, reviewFields]);

  const isFiltering = search.trim().length > 0;

  // ── Row selection (only selected rows are rendered, charged and saved) ──
  const selectedSet = useMemo(() => new Set(selectedRows), [selectedRows]);
  const selectedCount = selectedRows.length;
  const isRowSelected = (i: number) => selectedSet.has(i);

  // Bulk actions act on what is currently shown: with a query active, "select
  // all" means the matches, not the rows the operator cannot see.
  const allVisibleSelected = visibleRows.length > 0 && visibleRows.every(i => selectedSet.has(i));
  const someVisibleSelected = visibleRows.some(i => selectedSet.has(i));

  const toggleRow = (i: number) =>
    setSelectedRows(prev => (prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]));

  const selectVisible = () =>
    setSelectedRows(prev => Array.from(new Set([...prev, ...visibleRows])));

  const deselectVisible = () => {
    const hide = new Set(visibleRows);
    setSelectedRows(prev => prev.filter(i => !hide.has(i)));
  };

  const toggleAllRows = () => (allVisibleSelected ? deselectVisible() : selectVisible());

  /**
   * Remove a row from the batch.
   *
   * Rows are identified by position, and both `imageOverrides` (keyed
   * `${rowIdx}:${field}`) and `selectedRows` hold those positions — so removing a
   * row has to shift every index above it in the same update. Skipping that would
   * silently re-attach uploaded photos to the wrong people.
   */
  const deleteRow = (del: number) => {
    setRows(prev => prev.filter((_, i) => i !== del));
    setSelectedRows(prev => remapAfterRowDelete(del, prev, {}).selectedRows);
    setImageOverrides(prev => remapAfterRowDelete(del, [], prev).imageOverrides);

    // The previewed row would otherwise point at whatever shifted into its place.
    setPreviewRow(prev => (prev === null ? null : prev === del ? null : prev > del ? prev - 1 : prev));
  };

  // A photo the ZIP never matched is invisible in the output — the field is simply
  // painted blank — so the miss has to surface here, before credits are charged.
  const photoStats = useMemo(() => {
    if (!primaryPhotoField || selectedRows.length === 0) return null;
    const missing: number[] = [];
    selectedRows.forEach(i => {
      const row = rows[i];
      if (!row) return;
      if (!resolveImageForKey(i, primaryPhotoField, rowValueByName(row, primaryPhotoField))) {
        missing.push(i + 1);
      }
    });
    // selectedRows is append-ordered, but the warning lists row numbers.
    missing.sort((a, b) => a - b);
    return { matched: selectedRows.length - missing.length, missing };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, selectedRows, primaryPhotoField, zipMap, imageOverrides]);

  /**
   * Build the cardholder object for one row, exactly as the compile does — so a
   * preview shows what will actually print rather than an approximation.
   * `idx` is the original row index: image overrides are keyed on it.
   */
  const buildCardholderForRow = (
    idx: number,
    jsonFields: TemplateFieldDef[],
    primaryKey: string | null
  ) => {
    const row = rows[idx];
    const customFields: Record<string, string> = {};
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
  };

  // Draw the previewed row onto the modal canvas. Re-runs when the row, the side
  // or the row's own data changes, so edits in the grid show up immediately.
  useEffect(() => {
    if (previewRow === null) return;
    let cancelled = false;

    (async () => {
      setPreviewBusy(true);
      setPreviewError('');
      try {
        if (!previewAssets.current || previewAssets.current.templateId !== templateId) {
          const [tplRes, fontsRes] = await Promise.all([
            fetch(`/api/templates/${templateId}?_t=${Date.now()}`),
            fetch('/api/fonts').catch(() => null),
          ]);
          if (!tplRes.ok) throw new Error('Failed to load the template.');
          const template = (await tplRes.json()).template;
          if (!template) throw new Error('Template not found.');
          const fonts = fontsRes && fontsRes.ok ? ((await fontsRes.json()).fonts || []) : [];
          previewAssets.current = { templateId, template, fonts };
        }
        setPreviewHasBack(Boolean(previewAssets.current.template.backImageUrl));
        const { template, fonts } = previewAssets.current;

        const jsonFields = parseTemplateFields(template);
        const primaryKey = pickPrimaryPhotoKey(jsonFields.filter(f => isImageField(f)));
        const cardholder = buildCardholderForRow(previewRow, jsonFields, primaryKey);

        const canvas = previewCanvasRef.current;
        if (cancelled || !canvas) return;

        const { renderCardSideClient } = await import('@/lib/pdf/card-renderer-client');
        if (cancelled) return;
        await renderCardSideClient(
          canvas,
          template,
          { ...cardholder, customFields: JSON.stringify(cardholder.customFields) },
          previewSide,
          null,
          fonts,
          2
        );
      } catch (err: unknown) {
        if (!cancelled) {
          setPreviewError(err instanceof Error ? err.message : 'Could not render this card.');
        }
      } finally {
        if (!cancelled) setPreviewBusy(false);
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewRow, previewSide, templateId, rows, imageOverrides, zipMap]);

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

      // Same parse the review rows were keyed by. If the template was edited in
      // between (or the batch was hydrated from IndexedDB against a newer one),
      // the keys no longer line up and every photo would render blank — so stop
      // here rather than charge credits for a run of empty cards.
      const jsonFields = parseTemplateFields(template);
      if (jsonFields.map(f => f.field).join('\u0000') !== fieldDefs.map(f => f.field).join('\u0000')) {
        throw new Error(
          'This template has changed since the batch was imported, so the columns no longer line up. Go back and re-run the import.'
        );
      }
      const primaryKey = pickPrimaryPhotoKey(jsonFields.filter(f => isImageField(f)));

      // 2. Build cardholder objects from the (edited) rows the operator selected.
      //    Iterate the full row list so `idx` stays the original row index —
      //    resolveImageForKey/overrideByName key uploaded overrides on it, so
      //    filtering the array first would mis-resolve every override.
      const cardholders = rows.flatMap((_row, idx) =>
        selectedSet.has(idx) ? [buildCardholderForRow(idx, jsonFields, primaryKey)] : []
      );
      if (cardholders.length === 0) throw new Error('No records to compile.');

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
      let savedPath = '';
      for (let i = 0; i < total; i++) {
        const part = total > 1 ? `_part${i + 1}of${total}` : '';
        const fileName = `${kind}_batch_${cardholders.length}cards_${dateStr}${part}.pdf`;
        const base64 = uint8ArrayToBase64(new Uint8Array(await blobs[i].arrayBuffer()));
        const res = await electronAPI.savePdfLocally(fileName, base64, clientName || 'Client');
        if (res && res.success === false) throw new Error(res.error || 'Failed to save PDF.');
        if (!savedPath && res?.path) savedPath = res.path;
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
        savedPath,
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
          <h3 style={{ margin: '0 0 6px' }}>
            {isGoogleForm ? 'Google Form → PDF (local)' : 'Batch Import → PDF (local)'}
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: 0 }}>
            {isGoogleForm
              ? 'Pull the live responses from a Google Form\u2019s linked sheet and print cards straight from them. Responses are held on this machine (a local database, not the cloud) and the PDF is saved to the client folder; no cardholder records are created. Credits are charged as normal, and the local copy is cleared once the batch is compiled.'
              : 'Upload a spreadsheet and a photo ZIP. The batch is processed on this machine (stored in a local database, not the cloud) and the PDF is saved to the client folder. Credits are charged as normal. The local data is cleared once the batch is compiled.'}
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

        {isGoogleForm ? (
          <>
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <LinkIcon size={16} /> Google Form responses sheet
              </label>
              <input
                type="url"
                className="form-input"
                placeholder="https://docs.google.com/spreadsheets/d/..."
                value={sheetUrl}
                onChange={e => setSheetUrl(e.target.value)}
              />
              <p style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '6px' }}>
                Responses are read live each time you load, so re-loading picks up new submissions.
              </p>
            </div>

            <div style={{ padding: '12px 14px', borderRadius: '8px', fontSize: '0.78rem', lineHeight: 1.6, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)', marginBottom: '16px' }}>
              <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <HelpCircle size={14} /> Paste the responses sheet, not the form link
              </strong>
              Google only lets the form&rsquo;s owner read its responses, so a{' '}
              <code>/forms/d/...</code> link cannot be used directly. One-time setup:
              open the form &rarr; <strong>Responses</strong> &rarr; <strong>Link to Sheets</strong>,
              then share that sheet (<em>Anyone with the link &rarr; Viewer</em>) and paste its link above.
              {' '}If the form collects photo uploads, share the response folder in Google&nbsp;Drive the
              same way &mdash; otherwise those cards print with a blank photo box.
            </div>
          </>
        ) : (
          <>
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
          </>
        )}

        {analyzeStatus && (
          <div style={{ fontSize: '0.8rem', color: 'var(--primary)', marginBottom: '12px' }}>{analyzeStatus}</div>
        )}

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
          <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={analyzing || !templateId || (isGoogleForm ? !sheetUrl.trim() : !excelFile)}
            onClick={handleAnalyze}
          >
            {analyzing ? 'Analyzing…' : isGoogleForm ? 'Load responses →' : 'Next — Review Records →'}
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
          <div style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span>
              <strong>{selectedCount}</strong> of <strong>{rows.length}</strong> record(s) selected ·{' '}
              <strong>{mappedFields.length}</strong> mapped field(s)
              {imageFields.length > 0 && <> · <strong>{imageFields.length}</strong> image column(s)</>}
            </span>
            {isFiltering && (
              <span style={{ color: 'var(--muted)' }}>
                · showing <strong>{visibleRows.length}</strong> match(es)
              </span>
            )}
            <span style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={selectVisible}
                disabled={allVisibleSelected}
                style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: '0.75rem', color: allVisibleSelected ? 'var(--muted)' : 'var(--primary)', cursor: allVisibleSelected ? 'default' : 'pointer', textDecoration: 'underline' }}
              >
                {isFiltering ? `Select ${visibleRows.length} shown` : 'Select all'}
              </button>
              <button
                type="button"
                onClick={deselectVisible}
                disabled={!someVisibleSelected}
                style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: '0.75rem', color: !someVisibleSelected ? 'var(--muted)' : 'var(--primary)', cursor: !someVisibleSelected ? 'default' : 'pointer', textDecoration: 'underline' }}
              >
                {isFiltering ? 'Deselect shown' : 'Select none'}
              </button>
            </span>
          </div>
          {unmatchedHeaders.length > 0 && (
            <div style={{ fontSize: '0.75rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertTriangle size={13} /> Unmatched columns ignored: {unmatchedHeaders.join(', ')}
            </div>
          )}
          {photoStats && (
            photoStats.missing.length === 0 ? (
              <div style={{ fontSize: '0.75rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle size={13} /> All {photoStats.matched} selected record(s) matched a photo
              </div>
            ) : (
              <div style={{ fontSize: '0.75rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertTriangle size={13} />
                {photoStats.matched} of {selectedCount} selected matched a photo — {photoStats.missing.length} missing
                {' '}(row{photoStats.missing.length > 1 ? 's' : ''} {photoStats.missing.slice(0, 12).join(', ')}
                {photoStats.missing.length > 12 ? `, +${photoStats.missing.length - 12} more` : ''})
              </div>
            )
          )}
        </div>

        {isGoogleForm && imageFields.length > 0 && (
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '10px', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
            <AlertTriangle size={13} style={{ marginTop: '2px', flexShrink: 0, color: '#f59e0b' }} />
            <span>
              A photo cell that holds a link counts as matched — a Drive link that is broken or not shared
              cannot be told apart from a working one without opening it. Check the thumbnails below: any row
              without one will print with a blank photo box.
            </span>
          </div>
        )}

        <div style={{ position: 'relative', marginBottom: '12px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '38px', paddingRight: search ? '34px' : undefined, width: '100%' }}
            placeholder="Search records — any mapped field, or a row number"
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Search records"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Clear search"
              title="Clear search"
              style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', padding: 0, display: 'inline-flex', color: 'var(--muted)', cursor: 'pointer' }}
            >
              <X size={15} />
            </button>
          )}
        </div>

        {isFiltering && selectedCount > visibleRows.filter(i => isRowSelected(i)).length && (
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '10px' }}>
            Selection is not affected by the search — {selectedCount} record(s) are selected in total and
            will all be compiled, including those hidden by the current query.
          </div>
        )}

        <div style={{ overflow: 'auto', maxHeight: '55vh', border: '1px solid var(--glass-border)', borderRadius: '8px', marginBottom: '20px' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: '0.8rem', width: '100%' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                <th style={{ padding: '8px 10px', textAlign: 'left', position: 'sticky', top: 0, background: '#12151d', width: '1%' }}>
                  <input
                    type="checkbox"
                    aria-label={allVisibleSelected ? 'Deselect shown records' : 'Select shown records'}
                    title={allVisibleSelected ? 'Deselect shown' : 'Select shown'}
                    checked={allVisibleSelected}
                    // React has no `indeterminate` prop — it is DOM-only.
                    ref={el => { if (el) el.indeterminate = someVisibleSelected && !allVisibleSelected; }}
                    onChange={toggleAllRows}
                    disabled={visibleRows.length === 0}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                <th style={{ padding: '8px 10px', textAlign: 'left', position: 'sticky', top: 0, background: '#12151d' }}>#</th>
                {reviewFields.map(f => (
                  <th key={f.field} style={{ padding: '8px 10px', textAlign: 'left', whiteSpace: 'nowrap', position: 'sticky', top: 0, background: '#12151d', color: 'var(--muted)' }}>
                    {f.field}
                    <span style={{ marginLeft: '6px', fontSize: '0.65rem', background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: '3px' }}>{f.type}</span>
                  </th>
                ))}
                <th style={{ padding: '8px 10px', textAlign: 'right', whiteSpace: 'nowrap', position: 'sticky', top: 0, background: '#12151d', color: 'var(--muted)', width: '1%' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map(ri => {
                const row = rows[ri];
                return (
                <tr
                  key={ri}
                  style={{
                    borderTop: '1px solid rgba(255,255,255,0.05)',
                    opacity: isRowSelected(ri) ? 1 : 0.45,
                  }}
                >
                  <td style={{ padding: '6px 10px' }}>
                    <input
                      type="checkbox"
                      aria-label={`Include record ${ri + 1} in the compile`}
                      checked={isRowSelected(ri)}
                      onChange={() => toggleRow(ri)}
                      style={{ cursor: 'pointer' }}
                    />
                  </td>
                  <td style={{ padding: '6px 10px', color: 'var(--muted)' }}>{ri + 1}</td>
                  {reviewFields.map(f => {
                    if (isImageField(f)) {
                      const src = resolveImageForKey(ri, f.field, rowValueByName(row, f.field));
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
                  <td style={{ padding: '6px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'inline-flex', gap: '4px' }}>
                      <button
                        type="button"
                        onClick={() => { setPreviewSide('front'); setPreviewRow(ri); }}
                        title={`Preview record ${ri + 1}`}
                        aria-label={`Preview record ${ri + 1}`}
                        style={{ background: 'none', border: '1px solid var(--glass-border)', borderRadius: '6px', padding: '4px 6px', color: 'var(--muted)', cursor: 'pointer', display: 'inline-flex' }}
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteRow(ri)}
                        title={`Remove record ${ri + 1} from this batch`}
                        aria-label={`Remove record ${ri + 1} from this batch`}
                        style={{ background: 'none', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', padding: '4px 6px', color: '#f87171', cursor: 'pointer', display: 'inline-flex' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
              {visibleRows.length === 0 && (
                <tr>
                  <td
                    colSpan={reviewFields.length + 3}
                    style={{ padding: '24px 10px', textAlign: 'center', color: 'var(--muted)' }}
                  >
                    No records match “{search.trim()}”.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {photoStats && photoStats.missing.length > 0 && (
          <label style={{
            display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '14px', cursor: 'pointer',
            padding: '10px 14px', borderRadius: '6px', fontSize: '0.8rem',
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
          }}>
            <input
              type="checkbox"
              checked={ackMissingPhotos}
              onChange={e => setAckMissingPhotos(e.target.checked)}
              style={{ marginTop: '2px' }}
            />
            <span>
              <strong>{photoStats.missing.length} selected record(s) have no photo.</strong> Deselect them,
              {isGoogleForm ? ' fix the photo link, ' : ' fix the filename, '}
              or upload an image in the rows marked above, or tick this box to compile anyway — those cards will
              print with a blank photo box, and credits are charged for them either way.
            </span>
          </label>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
          <button type="button" className="btn btn-secondary" onClick={() => setStep('upload')}>← Back</button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={selectedCount === 0 || (!!photoStats && photoStats.missing.length > 0 && !ackMissingPhotos)}
            onClick={() => { setError(''); setShowWizard(true); }}
          >
            Compile PDF ({selectedCount}) →
          </button>
        </div>

        {previewRow !== null && rows[previewRow] && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Preview of record ${previewRow + 1}`}
            onClick={() => setPreviewRow(null)}
            style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(3,6,15,0.78)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{ background: 'rgba(13,16,27,0.98)', border: '1px solid var(--glass-border)', borderTop: '2px solid var(--primary)', borderRadius: '16px', padding: '20px', maxWidth: '560px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <strong style={{ fontSize: '0.95rem' }}>Record {previewRow + 1}</strong>
                  <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                    Rendered with the same engine that compiles the PDF.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewRow(null)}
                  aria-label="Close preview"
                  style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', display: 'inline-flex' }}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                {(['front', 'back'] as const).map(sideKey => (
                  <button
                    key={sideKey}
                    type="button"
                    onClick={() => setPreviewSide(sideKey)}
                    disabled={sideKey === 'back' && !previewHasBack}
                    style={{
                      padding: '5px 12px', borderRadius: '7px', fontSize: '0.78rem', cursor: 'pointer',
                      textTransform: 'capitalize',
                      background: previewSide === sideKey ? 'rgba(99,102,241,0.15)' : 'transparent',
                      border: `1px solid ${previewSide === sideKey ? 'var(--primary)' : 'var(--glass-border)'}`,
                      color: previewSide === sideKey ? '#fff' : 'var(--muted)',
                    }}
                  >
                    {sideKey}
                  </button>
                ))}
              </div>

              <div style={{ position: 'relative', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: '10px', padding: '12px', display: 'flex', justifyContent: 'center' }}>
                <canvas
                  ref={previewCanvasRef}
                  style={{ maxWidth: '100%', height: 'auto', borderRadius: '6px', display: previewError ? 'none' : 'block' }}
                />
                {previewBusy && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', color: 'var(--muted)', background: 'rgba(13,16,27,0.6)' }}>
                    Rendering…
                  </div>
                )}
                {previewError && (
                  <div style={{ fontSize: '0.8rem', color: '#f87171', padding: '20px', textAlign: 'center' }}>{previewError}</div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', gap: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '0.8rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={isRowSelected(previewRow)} onChange={() => toggleRow(previewRow)} />
                  Include in this compile
                </label>
                <button
                  type="button"
                  onClick={() => deleteRow(previewRow)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'none', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '6px 12px', color: '#f87171', fontSize: '0.78rem', cursor: 'pointer' }}
                >
                  <Trash2 size={14} /> Remove record
                </button>
              </div>
            </div>
          </div>
        )}

        {showWizard && (
          <CompileWizardModal
            cardCount={selectedCount}
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
              {savedResult.count} card(s) · {savedResult.creditsCharged} credit(s) charged ·{' '}
              {savedResult.remaining} remaining.
            </div>
            {savedResult.savedPath && (
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '6px', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                {savedResult.savedPath}
              </div>
            )}
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
