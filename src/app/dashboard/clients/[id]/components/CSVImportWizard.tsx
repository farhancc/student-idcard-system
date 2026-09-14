'use client';

import React, { useState } from 'react';
import { Download, CheckCircle, AlertTriangle, FileSpreadsheet, ImageIcon, HelpCircle, ExternalLink, Printer, Zap, FileText, Layers, Monitor } from 'lucide-react';
import { isElectronApp } from '@/lib/isElectron';

interface CSVImportResult {
  mode: string;
  totalRows: number;
  newAdded: number;
  updated: number;
  skipped: number;
  duplicateCount: number;
  success?: boolean;
  error?: string;
  insertedIds?: number[];
}

interface CSVImportWizardProps {
  clientId: string | number;
  clientTemplates?: any[];
  onImported?: () => void;
  onComplete?: () => void;
  onCancel: () => void;
  orgToken?: string;
  onPrintImported?: (cardholderIds: number[], templateId: number | null) => void;
}

export default function CSVImportWizard({
  clientId,
  clientTemplates = [],
  onImported,
  onComplete,
  onCancel,
  orgToken,
  onPrintImported,
}: CSVImportWizardProps) {
  const handleSuccess = () => {
    if (onImported) onImported();
    if (onComplete) onComplete();
  };
  const [sourceType, setSourceType] = useState<'file' | 'google_form'>('file');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [googleSheetsUrl, setGoogleSheetsUrl] = useState('');
  const [showGoogleFormHelp, setShowGoogleFormHelp] = useState(false);
  const [importMode, setImportMode] = useState('check');
  const [importTemplateId, setImportTemplateId] = useState<string>(() => {
    return clientTemplates && clientTemplates.length > 0 ? String(clientTemplates[0].id) : '';
  });

  React.useEffect(() => {
    if (clientTemplates && clientTemplates.length > 0 && !importTemplateId) {
      setImportTemplateId(String(clientTemplates[0].id));
    }
  }, [clientTemplates, importTemplateId]);
  const [importResult, setImportResult] = useState<CSVImportResult | null>(null);
  const [photoMatchResult, setPhotoMatchResult] = useState<any>(null);
  const [importError, setImportError] = useState('');
  const [importLoading, setImportLoading] = useState(false);

  const [importStep, setImportStep] = useState<'source' | 'mapping' | 'validating' | 'confirm' | 'done' | 'print'>('source');
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  const [parsedPreview, setParsedPreview] = useState<any[]>([]);
  const [parsedAllRows, setParsedAllRows] = useState<any[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [importValidationErrors, setImportValidationErrors] = useState<Array<{ row: number; name: string; missingFields: string[] }>>([]);
  const [zipPhotosMap, setZipPhotosMap] = useState<Map<string, string>>(new Map());
  const [parseLoading, setParseLoading] = useState(false);
  const [templateFieldDefs, setTemplateFieldDefs] = useState<Array<{ field: string; type: string; isRequired: boolean }>>([]);

  // ── Print step state ──────────────────────────────────────────────────
  const [printPdfType, setPrintPdfType] = useState<'PRODUCTION' | 'APPROVAL'>('PRODUCTION');
  const [printPaperSize, setPrintPaperSize] = useState('A4');
  const [printOrientation, setPrintOrientation] = useState<'PORTRAIT' | 'LANDSCAPE'>('PORTRAIT');
  const [printBleedMm, setPrintBleedMm] = useState('3');
  const [printCropMarks, setPrintCropMarks] = useState(true);
  const [printFoldLine, setPrintFoldLine] = useState(true);
  const [printMarginLeft, setPrintMarginLeft] = useState(40);
  const [printMarginRight, setPrintMarginRight] = useState(40);
  const [printMarginTop, setPrintMarginTop] = useState(40);
  const [printMarginBottom, setPrintMarginBottom] = useState(40);
  const [printColGap, setPrintColGap] = useState(15);
  const [printRowGap, setPrintRowGap] = useState(15);
  const [printUnitMode, setPrintUnitMode] = useState<'MM' | 'PT'>('MM');
  const [printEmptySlotStrategy, setPrintEmptySlotStrategy] = useState<'LEAVE_BLANK' | 'REPEAT_LAST' | 'REPEAT_FIRST'>('LEAVE_BLANK');
  const [printGenerating, setPrintGenerating] = useState(false);
  const [printProgress, setPrintProgress] = useState(0);
  const [printError, setPrintError] = useState('');

  const PT_TO_MM = 25.4 / 72;
  const MM_TO_PT = 72 / 25.4;
  const ptToMm = (pt: number) => Number((pt * PT_TO_MM).toFixed(1));
  const mmToPt = (mm: number) => Math.round(mm * MM_TO_PT);

  const isFormLinkInput = googleSheetsUrl.toLowerCase().includes('/forms/d/');

  // Convert parsed CSV rows to cardholder-like objects using column mapping
  const buildCardholdersFromCSV = (rows: any[]) => {
    const nameCol = columnMapping['name'] || '';
    const designationCol = columnMapping['designation'] || '';
    const photoCol = columnMapping['photo'] || columnMapping['photourl'] || '';
    const idCol = columnMapping['id'] || columnMapping['uniquekey'] || '';

    const sanitizeKey = (str: string) => str.toLowerCase().replace(/[^a-z0-9_\-]/g, '_');

    return rows.map((row, idx) => {
      const name = nameCol ? String(row[nameCol] || '').trim() : '';
      const designation = designationCol ? String(row[designationCol] || '').trim() : null;
      let rawPhotoUrl = photoCol ? String(row[photoCol] || '').trim() || null : null;
      const uniqueKey = idCol ? String(row[idCol] || '').trim() || null : null;

      // Check ZIP photos map for matching image filename
      let resolvedPhotoUrl = rawPhotoUrl;
      if (zipPhotosMap.size > 0) {
        if (rawPhotoUrl) {
          const baseName = rawPhotoUrl.split('/').pop() || rawPhotoUrl;
          const nameWithoutExt = baseName.replace(/\.[^.]+$/, '');
          const matched =
            zipPhotosMap.get(rawPhotoUrl.toLowerCase().trim()) ||
            zipPhotosMap.get(baseName.toLowerCase().trim()) ||
            zipPhotosMap.get(sanitizeKey(baseName)) ||
            zipPhotosMap.get(sanitizeKey(nameWithoutExt));

          if (matched) resolvedPhotoUrl = matched;
        }

        // Fallback match using ID or Name if no photoUrl specified
        if (!resolvedPhotoUrl) {
          const candidates = [uniqueKey, name].filter(Boolean) as string[];
          for (const cand of candidates) {
            const cleanCand = cand.toLowerCase().trim();
            const matched = zipPhotosMap.get(cleanCand) || zipPhotosMap.get(sanitizeKey(cleanCand));
            if (matched) {
              resolvedPhotoUrl = matched;
              break;
            }
          }
        }
      }

      // Build customFields from remaining mapped columns
      const customFields: Record<string, any> = {};
      for (const [field, srcCol] of Object.entries(columnMapping)) {
        if (['name', 'designation', 'photo', 'photourl', 'id', 'uniquekey'].includes(field.toLowerCase())) continue;
        if (srcCol && row[srcCol] !== undefined) {
          customFields[field] = String(row[srcCol] || '');
        }
      }

      return {
        id: idx + 1,
        name: name || `Record ${idx + 1}`,
        designation,
        photoUrl: resolvedPhotoUrl,
        uniqueKey,
        cardSerial: null,
        customFields: Object.keys(customFields).length > 0 ? JSON.stringify(customFields) : null,
      };
    }).filter(ch => ch.name && ch.name !== `Record ${0}`);
  };

  // Calculate print sheet capacity
  const calcPrintSlots = () => {
    let pw: number, ph: number;
    switch (printPaperSize) {
      case 'A4': pw = 595.27; ph = 841.89; break;
      case 'A3': pw = 841.89; ph = 1190.55; break;
      case 'SRA3': pw = 907.09; ph = 1275.59; break;
      case '13x19': pw = 936; ph = 1368; break;
      default: pw = 907.09; ph = 1275.59;
    }
    if (printOrientation === 'LANDSCAPE') { const tmp = pw; pw = ph; ph = tmp; }

    const bleedPt = Number(printBleedMm || 0) * 2.83464567;
    const cw = 153 + bleedPt * 2;
    const ch = 242.6 + bleedPt * 2;
    const cols = Math.max(1, Math.floor((pw - printMarginLeft - printMarginRight + printColGap) / (cw + printColGap)));
    const rows = Math.max(1, Math.floor((ph - printMarginTop - printMarginBottom + printRowGap) / (ch + printRowGap)));
    const perPage = cols * rows;
    const totalCards = parsedAllRows.length;
    const pages = Math.ceil(totalCards / perPage) || 1;
    const totalSlots = pages * perPage;
    const emptySlots = Math.max(0, totalSlots - totalCards);

    const cardW_mm = Number((54.0 + (Number(printBleedMm) || 0) * 2).toFixed(1));
    const cardH_mm = Number((85.6 + (Number(printBleedMm) || 0) * 2).toFixed(1));
    const sheetW_mm = Number((pw * PT_TO_MM).toFixed(1));
    const sheetH_mm = Number((ph * PT_TO_MM).toFixed(1));

    return { cols, rows, perPage, pages, totalCards, totalSlots, emptySlots, cardW_mm, cardH_mm, sheetW_mm, sheetH_mm, pw, ph, cw, ch };
  };

  // Handle direct PDF generation from CSV data
  const handleDirectPrint = async () => {
    if (!isElectronApp()) {
      setPrintError('PDF generation is restricted exclusively to the Desktop (Electron) App.');
      return;
    }
    if (!importTemplateId || parsedAllRows.length === 0) return;
    setPrintGenerating(true);
    setPrintProgress(0);
    setPrintError('');

    try {
      // 1. Fetch full template
      const tplRes = await fetch(`/api/templates/${importTemplateId}?_t=${Date.now()}`);
      if (!tplRes.ok) throw new Error('Failed to fetch template details');
      const tplData = await tplRes.json();
      const template = tplData.template;
      if (!template) throw new Error('Template not found');

      // 2. Fetch press fonts
      let pressFonts: any[] = [];
      try {
        const fontsRes = await fetch('/api/fonts');
        if (fontsRes.ok) {
          const fontsData = await fontsRes.json();
          pressFonts = fontsData.fonts || [];
        }
      } catch {}

      // 3. Build cardholder objects from CSV
      const cardholders = buildCardholdersFromCSV(parsedAllRows);
      if (cardholders.length === 0) throw new Error('No valid records to print');

      setPrintProgress(10);

      // 4. Generate PDF
      let pdfBlob: Blob;

      if (printPdfType === 'PRODUCTION') {
        // 1. Get or create cardholder IDs
        let targetCardholderIds: number[] = importResult?.insertedIds || [];

        if (targetCardholderIds.length === 0) {
          // Cardholders not saved to DB yet — import them now to get database IDs
          const formData = new FormData();
          formData.append('clientId', String(clientId));
          if (orgToken) formData.append('orgToken', orgToken);
          formData.append('mode', importMode === 'check' ? 'insert' : importMode);
          if (importTemplateId) formData.append('templateId', importTemplateId);
          if (Object.keys(columnMapping).length > 0) {
            formData.append('columnMapping', JSON.stringify(columnMapping));
          }
          if (csvFile) {
            formData.append('file', csvFile);
          } else if (googleSheetsUrl.trim()) {
            formData.append('googleSheetsUrl', googleSheetsUrl.trim());
          } else {
            throw new Error('No CSV file or Google Sheets URL available to save records');
          }

          const saveRes = await fetch('/api/cardholders/import', {
            method: 'POST',
            body: formData,
          });
          const saveJson = await saveRes.json();
          if (!saveRes.ok) throw new Error(saveJson.error || 'Failed to save cardholders for production compile');
          targetCardholderIds = saveJson.insertedIds || [];
          setImportResult(saveJson);
        }

        if (targetCardholderIds.length === 0) {
          throw new Error('No saved cardholders available for production compile');
        }

        // 2. Create Order in database
        const orderRes = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId: Number(clientId),
            templateId: Number(importTemplateId),
            cardholderIds: targetCardholderIds,
            status: 'APPROVED',
            ...(orgToken ? { orgToken } : {}),
          }),
        });
        const orderData = await orderRes.json();
        if (!orderRes.ok) throw new Error(orderData.error || 'Failed to create order for production compile');

        // 3. Queue production PDF job (locks credits and registers job for ProductionDaemon)
        const MM_TO_PT = 2.8346;
        let customWidth: number | undefined;
        let customHeight: number | undefined;

        if (printPaperSize === 'SRA3') {
          customWidth = printOrientation === 'PORTRAIT' ? 907.09 : 1275.59;
          customHeight = printOrientation === 'PORTRAIT' ? 1275.59 : 907.09;
        } else if (printPaperSize === '13x19') {
          customWidth = printOrientation === 'PORTRAIT' ? 936 : 1368;
          customHeight = printOrientation === 'PORTRAIT' ? 1368 : 936;
        }

        const jobRes = await fetch('/api/jobs/production-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: orderData.order.id,
            pdfType: 'PRODUCTION',
            paperSize: (printPaperSize === 'SRA3' || printPaperSize === '13x19') ? 'CUSTOM' : printPaperSize,
            orientation: printOrientation,
            bleed: Number(printBleedMm || 0) * MM_TO_PT,
            cropMarks: printCropMarks,
            foldLine: printFoldLine,
            customWidth,
            customHeight,
            marginLeft: printMarginLeft,
            marginRight: printMarginRight,
            marginTop: printMarginTop,
            marginBottom: printMarginBottom,
            colGap: printColGap,
            rowGap: printRowGap,
            emptySlotStrategy: printEmptySlotStrategy,
            ...(orgToken ? { orgToken } : {}),
          }),
        });
        const jobData = await jobRes.json();
        if (!jobRes.ok) throw new Error(jobData.error || 'Failed to queue production job');

        // 4. Notify app & ProductionDaemon, then complete wizard
        window.dispatchEvent(new Event('refresh-profile'));
        if (onImported) onImported();
        setPrintGenerating(false);
        if (onComplete) onComplete();
        onCancel();
        return;
      } else {
        const { generateApprovalPdfClient } = await import('@/lib/pdf/approval-pdf-generator');
        const clientName = clientTemplates.find((t: any) => String(t.id) === importTemplateId)?.name || 'Client';
        pdfBlob = await generateApprovalPdfClient(
          clientName,
          'CSV Import',
          template,
          cardholders,
          pressFonts
        );
      }

      setPrintProgress(100);

      // 5. Silent native save in Electron or browser download fallback
      const timestamp = new Date().toISOString().slice(0, 10);
      const fileName = `approval_csv_${cardholders.length}cards_${timestamp}.pdf`;
      const clientName = clientTemplates.find((t: any) => String(t.id) === importTemplateId)?.name || 'Client';

      const electronAPI = typeof window !== 'undefined' ? (window as any).electronAPI : null;
      if (electronAPI?.savePdfLocally) {
        const arrayBuffer = await pdfBlob.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binaryStr = '';
        const len = bytes.byteLength;
        const CHUNK_SIZE = 0x8000;
        for (let i = 0; i < len; i += CHUNK_SIZE) {
          const chunk = bytes.subarray(i, i + CHUNK_SIZE);
          binaryStr += String.fromCharCode.apply(null, chunk as unknown as number[]);
        }
        const base64Data = btoa(binaryStr);
        await electronAPI.savePdfLocally(fileName, base64Data, clientName);
      } else {
        const url = URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      console.error('Direct print error:', err);
      setPrintError(err.message || 'PDF generation failed');
    } finally {
      setPrintGenerating(false);
    }
  };

  const handleParseFile = async () => {
    if (!csvFile && !googleSheetsUrl.trim()) {
      setImportError('Please upload a spreadsheet file or paste a Google Sheet / Form response URL.');
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
        if (googleSheetsUrl.includes('/forms/d/')) {
          throw new Error(
            "Google Form link detected! Google Forms store all responses in a linked Google Sheet. Please open your Google Form -> click the 'Responses' tab -> click 'Link to Sheets' (green icon) -> set Share access to 'Anyone with link' -> paste that Google Sheet link here."
          );
        }
        const regex = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;
        const match = googleSheetsUrl.match(regex);
        if (!match) throw new Error('Invalid Google Sheets URL format. Example: https://docs.google.com/spreadsheets/d/...');
        const exportUrl = `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv`;
        const res = await fetch(exportUrl);
        if (!res.ok) throw new Error('Failed to fetch Google Sheet. Make sure link sharing is on (Anyone with link can view).');
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
      setParsedAllRows(rows); // Store ALL rows for direct print

      // Extract ZIP archive if provided
      const photoMap = new Map<string, string>();
      if (zipFile) {
        try {
          const JSZip = (await import('jszip')).default;
          const zipBuffer = await zipFile.arrayBuffer();
          const zip = await JSZip.loadAsync(zipBuffer);

          const sanitizeKey = (str: string) => str.toLowerCase().replace(/[^a-z0-9_\-]/g, '_');

          const imageEntries = Object.entries(zip.files).filter(([name, entry]) => {
            if (entry.dir) return false;
            const ext = name.split('.').pop()?.toLowerCase() || '';
            return ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif', 'svg'].includes(ext);
          });

          for (const [fileName, entry] of imageEntries) {
            const baseName = fileName.split('/').pop() || fileName;
            const nameWithoutExt = baseName.replace(/\.[^.]+$/, '');

            const blob = await entry.async('blob');
            const dataUrl = await new Promise<string>((res) => {
              const reader = new FileReader();
              reader.onloadend = () => res(reader.result as string);
              reader.readAsDataURL(blob);
            });

            photoMap.set(baseName.toLowerCase().trim(), dataUrl);
            photoMap.set(nameWithoutExt.toLowerCase().trim(), dataUrl);
            photoMap.set(sanitizeKey(baseName), dataUrl);
            photoMap.set(sanitizeKey(nameWithoutExt), dataUrl);
          }
        } catch (zipErr) {
          console.warn('[CSVImportWizard] ZIP extraction error:', zipErr);
        }
      }
      setZipPhotosMap(photoMap);

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
    setPhotoMatchResult(null);
    setImportLoading(true);

    try {
      const formData = new FormData();
      formData.append('clientId', String(clientId));
      if (orgToken) formData.append('orgToken', orgToken);
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

      // If a photos ZIP file was provided and import is not dry-run, process photos ZIP
      if (zipFile && importMode !== 'check') {
        try {
          const photoFormData = new FormData();
          photoFormData.append('file', zipFile);
          photoFormData.append('clientId', String(clientId));
          if (orgToken) photoFormData.append('orgToken', orgToken);
          photoFormData.append('matchBy', 'uniqueKey');

          const photoRes = await fetch('/api/cardholders/import-photos', {
            method: 'POST',
            body: photoFormData,
          });
          if (photoRes.ok) {
            const photoJson = await photoRes.json();
            setPhotoMatchResult(photoJson.results || photoJson);
          }
        } catch (photoErr) {
          console.error('Failed to import photos ZIP:', photoErr);
        }
      }

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

  // Determine which steps to show in the step indicator
  const stepIndicatorItems = importStep === 'print'
    ? [
        { key: 'source', label: '1. Source' },
        { key: 'mapping', label: '2. Map Columns' },
        { key: 'print', label: '3. Print PDF' },
      ]
    : [
        { key: 'source', label: '1. Source & Photos' },
        { key: 'mapping', label: '2. Map Columns' },
        { key: 'confirm', label: '3. Confirm' },
        { key: 'done', label: '4. Done' },
      ];

  return (
    <div className="glass-panel" style={{ maxWidth: importStep === 'print' ? '900px' : '780px' }}>
      {/* Step indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0', marginBottom: '28px' }}>
        {stepIndicatorItems.map((step, i, arr) => {
          const allSteps = importStep === 'print'
            ? ['source', 'mapping', 'print']
            : ['source', 'mapping', 'validating', 'confirm', 'done'];
          const currentIdx = allSteps.indexOf(importStep);
          const displaySteps = importStep === 'print'
            ? ['source', 'mapping', 'print']
            : ['source', 'mapping', 'confirm', 'done'];
          const stepIdx = displaySteps.indexOf(step.key);
          const isDone = importStep === 'print'
            ? stepIdx < displaySteps.indexOf('print')
            : currentIdx > stepIdx + (step.key === 'confirm' ? 1 : 0);
          const isActive = step.key === importStep || (importStep === 'validating' && step.key === 'confirm');
          return (
            <React.Fragment key={step.key}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 14px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600,
                background: isActive ? '#6366f1' : isDone ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.05)',
                color: isActive ? '#ffffff' : isDone ? '#818cf8' : 'var(--muted)',
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
            <h3 style={{ marginBottom: '6px' }}>Batch Data & Photos Import</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: 0 }}>
              Import student details from a CSV/Excel file or live Google Form responses, assign a card template, and optionally match student photos via a ZIP archive.
            </p>
          </div>

          {/* Source Type Switcher */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div
              onClick={() => { setSourceType('file'); setGoogleSheetsUrl(''); }}
              style={{
                padding: '12px 16px',
                borderRadius: '8px',
                border: sourceType === 'file' ? '2px solid var(--primary)' : '1px solid rgba(255,255,255,0.08)',
                background: sourceType === 'file' ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.02)',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px' }}>
                <FileSpreadsheet size={18} color="var(--primary)" />
                Spreadsheet Upload
              </div>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--muted)' }}>
                Upload a local .csv, .xlsx, or .xls file
              </p>
            </div>

            <div
              onClick={() => { setSourceType('google_form'); setCsvFile(null); }}
              style={{
                padding: '12px 16px',
                borderRadius: '8px',
                border: sourceType === 'google_form' ? '2px solid var(--primary)' : '1px solid rgba(255,255,255,0.08)',
                background: sourceType === 'google_form' ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.02)',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px' }}>
                <ExternalLink size={18} color="#10b981" />
                Google Form / Sheet Link
              </div>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--muted)' }}>
                Live responses stream directly into template
              </p>
            </div>
          </div>

          {/* Local File Section */}
          {sourceType === 'file' && (
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label className="form-label" style={{ margin: 0 }}>Spreadsheet File (.csv, .xlsx)</label>
                <a href="/api/cardholders/import/sample" download style={{ fontSize: '0.8rem', color: 'var(--primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '500' }}>
                  <Download size={12} /> Sample Template
                </a>
              </div>
              <input type="file" accept=".csv,.xlsx,.xls" className="form-input"
                onChange={e => { setCsvFile(e.target.files?.[0] || null); setGoogleSheetsUrl(''); }}
              />
            </div>
          )}

          {/* Google Form / Sheet Section */}
          {sourceType === 'google_form' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label className="form-label" style={{ margin: 0 }}>Google Sheet / Form Responses Link</label>
                  <button
                    type="button"
                    style={{ background: 'transparent', border: 'none', color: 'var(--primary)', fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                    onClick={() => setShowGoogleFormHelp(!showGoogleFormHelp)}
                  >
                    <HelpCircle size={14} /> {showGoogleFormHelp ? 'Hide Form Link Guide' : 'How to get Google Form link?'}
                  </button>
                </div>
                <input type="text" className="form-input"
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  value={googleSheetsUrl}
                  onChange={e => { setGoogleSheetsUrl(e.target.value); setCsvFile(null); }}
                />
              </div>

              {/* Google Form Detected Notice */}
              {isFormLinkInput && (
                <div style={{ padding: '12px 16px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '8px', fontSize: '0.82rem', color: '#f59e0b' }}>
                  <div style={{ fontWeight: 600, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertTriangle size={16} /> Google Form Link Detected
                  </div>
                  Google Forms store all incoming responses in a <strong>linked Google Sheet</strong>. To import live responses:
                  <ol style={{ margin: '8px 0 0 18px', padding: 0 }}>
                    <li>Open your Google Form {'→'} click the <strong>Responses</strong> tab.</li>
                    <li>Click the green <strong>Link to Sheets</strong> button.</li>
                    <li>Click <strong>Share</strong> (top right) {'→'} set access to <strong>Anyone with link can view</strong>.</li>
                    <li>Paste that Google Sheet link here!</li>
                  </ol>
                </div>
              )}

              {/* Instructions Guide Accordion */}
              {(showGoogleFormHelp || !googleSheetsUrl) && !isFormLinkInput && (
                <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--muted)' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>💡 Quick Tip for Google Forms:</div>
                  Google Form responses are stored in a linked Google Sheet. Click <strong>Responses {'→'} Link to Sheets</strong> in your Google Form, set sharing to <strong>Anyone with the link can view</strong>, and paste the sheet URL above.
                </div>
              )}
            </div>
          )}

          {/* Option A: Student Photos ZIP Archive */}
          <div className="form-group" style={{ background: 'rgba(255,255,255,0.02)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
              <ImageIcon size={16} color="var(--primary)" /> Photos ZIP Archive <span style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 'normal' }}>(Optional — Option A)</span>
            </label>
            <input type="file" accept=".zip" className="form-input" onChange={e => setZipFile(e.target.files?.[0] || null)} />
            <p style={{ fontSize: '0.73rem', color: 'var(--muted)', marginTop: '4px', margin: 0 }}>
              Upload a ZIP file containing photos named by Student ID (e.g. <code>101.jpg</code>) or Name (e.g. <code>john_doe.png</code>). Photos are auto-matched during import.
            </p>
          </div>

          {/* Template Selection */}
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

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setImportStep('source')}>← Back</button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid rgba(139,92,246,0.4)', color: '#a78bfa', background: 'rgba(139,92,246,0.08)' }}
              disabled={parsedAllRows.length === 0}
              onClick={() => { setPrintError(''); setImportStep('print'); }}
            >
              <Printer size={14} /> Direct Print (Skip Upload) →
            </button>
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

          {/* Photo Match Summary Badge if ZIP was uploaded */}
          {photoMatchResult && (
            <div style={{ padding: '12px 16px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '8px', fontSize: '0.82rem' }}>
              <div style={{ fontWeight: 600, color: '#10b981', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ImageIcon size={16} /> Photos ZIP Processed
              </div>
              <div>
                Matched & Uploaded: <strong>{photoMatchResult.matched ?? 0} photos</strong> · Unmatched: {photoMatchResult.unmatched ?? 0}
              </div>
            </div>
          )}

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

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-secondary" onClick={() => { onCancel(); }}>View Cardholders</button>
            {onPrintImported && importResult.mode !== 'check' && importResult.insertedIds && importResult.insertedIds.length > 0 && (
              <button
                type="button"
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}
                onClick={() => onPrintImported(importResult.insertedIds!, importTemplateId ? Number(importTemplateId) : null)}
              >
                <Printer size={15} /> Print Imported Cards ({importResult.insertedIds.length})
              </button>
            )}
            {parsedAllRows.length > 0 && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid rgba(139,92,246,0.4)', color: '#a78bfa', background: 'rgba(139,92,246,0.08)' }}
                onClick={() => { setPrintError(''); setImportStep('print'); }}
              >
                <Printer size={14} /> Print from CSV Data
              </button>
            )}
            <button type="button" className="btn btn-secondary" onClick={() => {
              setImportStep('source');
              setImportResult(null);
              setPhotoMatchResult(null);
              setImportValidationErrors([]);
              setCsvFile(null);
              setZipFile(null);
              setGoogleSheetsUrl('');
              setColumnMapping({});
              setParsedHeaders([]);
              setParsedPreview([]);
              setParsedAllRows([]);
            }}>
              Import Another File
            </button>
          </div>
        </div>
      )}

      {/* ── Step 5: Direct Print from CSV ─────────────────────────────────── */}
      {importStep === 'print' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <h3 style={{ marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Printer size={20} color="var(--primary)" /> Direct Print from CSV
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: 0 }}>
              Generate PDF directly from <strong style={{ color: 'var(--text)' }}>{parsedAllRows.length} parsed records</strong> — no cloud upload required. Images referenced by URL in the CSV will be fetched automatically.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* Left: PDF Configuration */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* PDF Type */}
              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 600, marginBottom: '8px', display: 'block' }}>PDF Type</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setPrintPdfType('PRODUCTION')}
                    style={{
                      flex: 1, padding: '10px', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.15s',
                      border: printPdfType === 'PRODUCTION' ? '2px solid var(--primary)' : '1px solid rgba(255,255,255,0.08)',
                      background: printPdfType === 'PRODUCTION' ? 'rgba(99,102,241,0.12)' : 'transparent',
                      color: printPdfType === 'PRODUCTION' ? '#fff' : 'var(--muted)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '0.85rem' }}>
                      <Zap size={14} color={printPdfType === 'PRODUCTION' ? 'var(--primary)' : 'var(--muted)'} /> Production
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '2px' }}>Print-ready grid with crop marks</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintPdfType('APPROVAL')}
                    style={{
                      flex: 1, padding: '10px', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.15s',
                      border: printPdfType === 'APPROVAL' ? '2px solid var(--primary)' : '1px solid rgba(255,255,255,0.08)',
                      background: printPdfType === 'APPROVAL' ? 'rgba(99,102,241,0.12)' : 'transparent',
                      color: printPdfType === 'APPROVAL' ? '#fff' : 'var(--muted)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '0.85rem' }}>
                      <FileText size={14} color={printPdfType === 'APPROVAL' ? '#94a3b8' : 'var(--muted)'} /> Approval Proof
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '2px' }}>Watermarked proof for sign-off</div>
                  </button>
                </div>
              </div>

              {/* Paper Size (production only) */}
              {printPdfType === 'PRODUCTION' && (
                <>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.78rem' }}>Paper Sheet Size</label>
                    <select className="form-select" value={printPaperSize} onChange={e => setPrintPaperSize(e.target.value)}>
                      <option value="A4">A4 — 210×297mm ★ Recommended</option>
                      <option value="SRA3">SRA3 — 320×450mm</option>
                      <option value="13x19">13×19 inch — 330×483mm</option>
                      <option value="A3">A3 — 297×420mm</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.78rem' }}>Sheet Orientation</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {(['PORTRAIT', 'LANDSCAPE'] as const).map(o => (
                        <button
                          key={o}
                          type="button"
                          onClick={() => setPrintOrientation(o)}
                          style={{
                            flex: 1, padding: '8px', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.15s',
                            border: `1px solid ${printOrientation === o ? 'var(--primary)' : 'var(--glass-border)'}`,
                            background: printOrientation === o ? 'rgba(99,102,241,0.08)' : 'transparent',
                            color: printOrientation === o ? '#fff' : 'var(--muted)', fontSize: '0.82rem',
                          }}
                        >
                          {o.charAt(0) + o.slice(1).toLowerCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Unit Mode Toggle */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '4px 0 2px' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 600 }}>Units</span>
                    <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.3)', padding: '2px', borderRadius: '6px' }}>
                      <button
                        type="button"
                        onClick={() => setPrintUnitMode('MM')}
                        style={{
                          padding: '3px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer',
                          background: printUnitMode === 'MM' ? 'var(--primary)' : 'transparent',
                          color: printUnitMode === 'MM' ? '#fff' : 'var(--muted)', border: 'none'
                        }}
                      >
                        mm
                      </button>
                      <button
                        type="button"
                        onClick={() => setPrintUnitMode('PT')}
                        style={{
                          padding: '3px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer',
                          background: printUnitMode === 'PT' ? 'var(--primary)' : 'transparent',
                          color: printUnitMode === 'PT' ? '#fff' : 'var(--muted)', border: 'none'
                        }}
                      >
                        pt
                      </button>
                    </div>
                  </div>

                  {/* Margins */}
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>Margins ({printUnitMode === 'MM' ? 'mm' : 'pt'})</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      {[
                        ['Left', printMarginLeft, setPrintMarginLeft],
                        ['Right', printMarginRight, setPrintMarginRight],
                        ['Top', printMarginTop, setPrintMarginTop],
                        ['Bottom', printMarginBottom, setPrintMarginBottom]
                      ].map(([label, valPt, setter]: any) => {
                        const displayVal = printUnitMode === 'MM' ? ptToMm(valPt) : valPt;
                        return (
                          <label key={label} style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.72rem', color: 'var(--muted)' }}>
                            <span>{label}</span>
                            <input
                              type="number"
                              min={0}
                              step={printUnitMode === 'MM' ? 0.5 : 1}
                              value={displayVal}
                              onChange={e => {
                                const num = Number(e.target.value);
                                setter(printUnitMode === 'MM' ? mmToPt(num) : num);
                              }}
                              className="form-input"
                              style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Gaps & Bleed */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                    {[
                      ['Col Gap', printColGap, setPrintColGap, false],
                      ['Row Gap', printRowGap, setPrintRowGap, false],
                      ['Bleed', printBleedMm, setPrintBleedMm, true]
                    ].map(([label, val, setter, isBleedMm]: any) => {
                      let displayVal: any;
                      if (isBleedMm) {
                        displayVal = val;
                      } else {
                        displayVal = printUnitMode === 'MM' ? ptToMm(val) : val;
                      }

                      return (
                        <label key={label} style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.72rem', color: 'var(--muted)' }}>
                          <span>{label} {isBleedMm ? '(mm)' : `(${printUnitMode === 'MM' ? 'mm' : 'pt'})`}</span>
                          <input
                            type="number"
                            min={0}
                            step={0.5}
                            value={displayVal}
                            onChange={e => {
                              const num = Number(e.target.value);
                              if (isBleedMm) {
                                setter(String(num));
                              } else {
                                setter(printUnitMode === 'MM' ? mmToPt(num) : num);
                              }
                            }}
                            className="form-input"
                            style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                          />
                        </label>
                      );
                    })}
                  </div>

                  {/* Print Marks Checkboxes */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.82rem' }}>
                      <input type="checkbox" checked={printCropMarks} onChange={e => setPrintCropMarks(e.target.checked)} />
                      <span>Crop Marks (Cutting Guides)</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.82rem' }}>
                      <input type="checkbox" checked={printFoldLine} onChange={e => setPrintFoldLine(e.target.checked)} />
                      <span>Center Fold / Creasing Line</span>
                    </label>
                  </div>

                  {/* Empty Slot Strategy */}
                  <div className="form-group" style={{ marginTop: '4px' }}>
                    <label className="form-label" style={{ fontSize: '0.78rem' }}>Empty Slot Handling Strategy</label>
                    <select className="form-select" value={printEmptySlotStrategy} onChange={e => setPrintEmptySlotStrategy(e.target.value as any)}>
                      <option value="LEAVE_BLANK">Leave Blank (White Space)</option>
                      <option value="REPEAT_LAST">Repeat Last Card</option>
                      <option value="REPEAT_FIRST">Repeat First Card (Calibration)</option>
                    </select>
                  </div>
                </>
              )}
            </div>

            {/* Right: Sheet Capacity Analysis */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Sheet Capacity Banner */}
              {printPdfType === 'PRODUCTION' && (() => {
                const { cols, rows, perPage, pages, totalCards, totalSlots, emptySlots } = calcPrintSlots();
                return (
                  <div style={{
                    padding: '14px',
                    borderRadius: '10px',
                    background: 'rgba(99,102,241,0.08)',
                    border: '1px solid rgba(99,102,241,0.25)',
                    display: 'flex', flexDirection: 'column', gap: '10px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 600, color: '#a5b4fc' }}>
                      <Layers size={16} /> Sheet Capacity Analysis
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.8rem' }}>
                      <div>Grid: <strong>{cols} × {rows}</strong></div>
                      <div>Per Sheet: <strong>{perPage} cards</strong></div>
                      <div>Total Cards: <strong>{totalCards}</strong></div>
                      <div>Total Sheets: <strong>{pages}</strong></div>
                      <div>Total Slots: <strong>{totalSlots}</strong></div>
                      <div>Empty Slots: <strong style={{ color: emptySlots > 0 ? '#f59e0b' : '#10b981' }}>{emptySlots}</strong></div>
                    </div>
                  </div>
                );
              })()}

              {printPdfType === 'APPROVAL' && (
                <div style={{
                  padding: '14px',
                  borderRadius: '10px',
                  background: 'rgba(148,163,184,0.08)',
                  border: '1px solid rgba(148,163,184,0.2)',
                  display: 'flex', flexDirection: 'column', gap: '8px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8' }}>
                    <FileText size={16} /> Approval Proof Info
                  </div>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--muted)' }}>
                    Generates an A4 watermarked proof PDF showing each card front & back with field details for client sign-off.
                    <br /><strong>{parsedAllRows.length} card(s)</strong> will be rendered.
                  </p>
                </div>
              )}

              {/* Template info */}
              <div style={{
                padding: '12px 14px', borderRadius: '8px',
                background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                fontSize: '0.8rem',
              }}>
                <div style={{ color: 'var(--muted)', marginBottom: '4px', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>Template</div>
                <div style={{ fontWeight: 600, color: '#fff' }}>
                  {clientTemplates.find((t: any) => String(t.id) === importTemplateId)?.name || 'Unknown'}
                </div>
              </div>

              {/* Records summary */}
              <div style={{
                padding: '12px 14px', borderRadius: '8px',
                background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)',
                fontSize: '0.8rem',
              }}>
                <div style={{ color: '#10b981', fontWeight: 600, marginBottom: '4px' }}>Ready to Print</div>
                <div style={{ color: 'var(--muted)' }}>
                  <strong style={{ color: '#fff' }}>{parsedAllRows.length}</strong> records parsed from CSV · Images will be fetched from URLs in your data
                </div>
              </div>
            </div>
          </div>

          {/* Progress / Error */}
          {printGenerating && (
            <div style={{ padding: '16px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#a5b4fc' }}>
                  Generating {printPdfType} PDF...
                </span>
                <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>{printProgress}%</span>
              </div>
              <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ height: '100%', background: 'var(--primary)', width: `${printProgress}%`, transition: 'width 0.3s' }} />
              </div>
              <p style={{ margin: '8px 0 0', fontSize: '0.75rem', color: 'var(--muted)' }}>
                Rendering {parsedAllRows.length} card(s)... Do not close this window.
              </p>
            </div>
          )}

          {printError && (
            <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f77', borderRadius: '6px', fontSize: '0.85rem' }}>
              {printError}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setImportStep('mapping')}
              disabled={printGenerating}
            >
              ← Back to Mapping
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                opacity: printGenerating ? 0.6 : 1,
              }}
              disabled={!isElectronApp() || printGenerating || parsedAllRows.length === 0}
              onClick={handleDirectPrint}
            >
              {printGenerating ? (
                <>
                  <div style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  Generating...
                </>
              ) : (
                <>
                  <Printer size={15} /> Generate {printPdfType === 'PRODUCTION' ? 'Production' : 'Approval'} PDF
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
