import { useState, useCallback } from 'react';
import { useToast } from '@/components/ui/toast';

export interface MappedCardholder {
  /** Row index from the Excel sheet */
  rowIndex: number;
  name: string;
  designation: string;
  photoUrl: string;
  /** Whether a photo was matched from the ZIP */
  hasPhoto: boolean;
  /** The baseName key into photosMap */
  sanitizedKey: string;
  /** Raw Excel row data */
  rawData: Record<string, any>;
  /** Extra custom fields (non-standard columns) */
  customFields: Record<string, any>;
  /** Image column value from Excel (without extension) */
  imageColumnValue: string;
}

export interface BatchImportState {
  wizardStep: 1 | 2 | 3;
  excelFile: File | null;
  zipFile: File | null;
  analyzing: boolean;
  saving: boolean;
  savedCount: number;

  // Parsed data
  parsedRows: Record<string, any>[];
  columns: string[];
  imageFiles: { name: string; baseName: string; ext: string }[];
  photosMap: Map<string, { blob: Blob; url: string; dataUri?: string }>;
  mappedCardholders: MappedCardholder[];

  // Selection
  selectedIndexes: number[];

  // Search
  searchQuery: string;

  // Detail drawer
  editingCardholder: MappedCardholder | null;
  editingIndex: number | null;
  isEditingDetail: boolean;
}

export function useBatchImport(orderId: number, order: any) {
  const { toast } = useToast();

  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  const [parsedRows, setParsedRows] = useState<Record<string, any>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [imageFiles, setImageFiles] = useState<
    { name: string; baseName: string; ext: string }[]
  >([]);
  const [photosMap, setPhotosMap] = useState<
    Map<string, { blob: Blob; url: string; dataUri?: string }>
  >(new Map());
  const [mappedCardholders, setMappedCardholders] = useState<
    MappedCardholder[]
  >([]);

  const [selectedIndexes, setSelectedIndexes] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [editingCardholder, setEditingCardholder] =
    useState<MappedCardholder | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isEditingDetail, setIsEditingDetail] = useState(false);

  /**
   * Detect which template fields are of type "image".
   * Returns an array of field names like ["photo", "signature"].
   */
  const getImageFieldNames = useCallback((): string[] => {
    if (!order?.template) return ['photo'];
    const result: string[] = [];

    const parseSide = (json: string | null | undefined) => {
      if (!json) return;
      try {
        const fields = JSON.parse(json);
        if (Array.isArray(fields)) {
          fields.forEach((f: any) => {
            if (f.type === 'image' && f.field) {
              result.push(f.field);
            }
          });
        }
      } catch {
        /* ignore */
      }
    };

    parseSide(order.template.frontFields);
    parseSide(order.template.backFields);

    return result.length > 0 ? result : ['photo'];
  }, [order]);

  /**
   * Step 1 → Step 2: Parse Excel + ZIP, do client-side photo matching.
   */
  const handleAnalyze = useCallback(async () => {
    if (!excelFile) {
      toast('Please upload an Excel file', 'error');
      return;
    }

    setAnalyzing(true);
    try {
      // 1. Parse Excel via server
      const excelForm = new FormData();
      excelForm.append('file', excelFile);
      excelForm.append('orderId', String(orderId));

      const excelRes = await fetch('/api/cardholders/import', {
        method: 'POST',
        body: excelForm,
      });
      const excelData = await excelRes.json();
      if (!excelRes.ok)
        throw new Error(excelData.error || 'Failed to parse Excel');

      const rows: Record<string, any>[] = excelData.rows || [];
      const cols: string[] = excelData.columns || [];
      setParsedRows(rows);
      setColumns(cols);

      // 2. Parse ZIP client-side using JSZip (if provided)
      let localPhotosMap = new Map<
        string,
        { blob: Blob; url: string; dataUri?: string }
      >();
      let localImageFiles: { name: string; baseName: string; ext: string }[] =
        [];

      if (zipFile) {
        const JSZip = (await import('jszip')).default;
        const zipBuffer = await zipFile.arrayBuffer();
        const zip = await JSZip.loadAsync(zipBuffer);

        const validExtensions = [
          '.jpg',
          '.jpeg',
          '.png',
          '.webp',
          '.gif',
          '.bmp',
        ];

        for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
          if (zipEntry.dir) continue;
          if (relativePath.startsWith('__MACOSX') || relativePath.startsWith('.'))
            continue;

          const fileName = relativePath.split('/').pop() || '';
          if (fileName.startsWith('.')) continue;

          const dotIndex = fileName.lastIndexOf('.');
          if (dotIndex < 0) continue;
          const ext = fileName.substring(dotIndex).toLowerCase();
          if (!validExtensions.includes(ext)) continue;

          const baseName = fileName.substring(0, dotIndex);
          const blob = await zipEntry.async('blob');
          const url = URL.createObjectURL(blob);

          // Also create a data URI for preview
          const base64 = await zipEntry.async('base64');
          const mimeType =
            ext === '.png'
              ? 'image/png'
              : ext === '.webp'
                ? 'image/webp'
                : 'image/jpeg';
          const dataUri = `data:${mimeType};base64,${base64}`;

          localPhotosMap.set(baseName.toLowerCase().trim(), {
            blob,
            url,
            dataUri,
          });
          localImageFiles.push({ name: relativePath, baseName, ext });
        }
      }

      setPhotosMap(localPhotosMap);
      setImageFiles(localImageFiles);

      // 3. Map Excel rows to cardholders with photo matching
      const imageFieldNames = getImageFieldNames();

      // Determine which columns map to standard fields
      const colsLower = cols.map((c) => c.toLowerCase().trim());
      const nameColIdx = colsLower.findIndex(
        (c) =>
          c === 'name' ||
          c === 'student name' ||
          c === 'student_name' ||
          c === 'full name' ||
          c === 'full_name'
      );
      const designationColIdx = colsLower.findIndex(
        (c) =>
          c === 'designation' ||
          c === 'class' ||
          c === 'department' ||
          c === 'dept' ||
          c === 'grade' ||
          c === 'position' ||
          c === 'role'
      );

      const mapped: MappedCardholder[] = rows.map((row, rowIndex) => {
        const name =
          nameColIdx >= 0
            ? String(row[cols[nameColIdx]] || '').trim()
            : String(Object.values(row)[0] || '').trim();
        const designation =
          designationColIdx >= 0
            ? String(row[cols[designationColIdx]] || '').trim()
            : '';

        // Build custom fields from remaining columns
        const customFields: Record<string, any> = {};
        const standardCols = new Set<string>();
        if (nameColIdx >= 0) standardCols.add(cols[nameColIdx]);
        if (designationColIdx >= 0) standardCols.add(cols[designationColIdx]);
        // Also exclude image field columns from custom fields
        for (const imgField of imageFieldNames) {
          const matchCol = cols.find(
            (c) => c.toLowerCase().trim() === imgField.toLowerCase().trim()
          );
          if (matchCol) standardCols.add(matchCol);
        }

        for (const col of cols) {
          if (!standardCols.has(col) && row[col] !== undefined && row[col] !== '') {
            customFields[col] = row[col];
          }
        }

        // Photo matching: find image column value and match to ZIP
        let hasPhoto = false;
        let sanitizedKey = '';
        let imageColumnValue = '';

        for (const imgField of imageFieldNames) {
          const matchCol = cols.find(
            (c) => c.toLowerCase().trim() === imgField.toLowerCase().trim()
          );
          if (matchCol && row[matchCol]) {
            imageColumnValue = String(row[matchCol]).trim();
            const searchKey = imageColumnValue.toLowerCase().trim();

            if (localPhotosMap.has(searchKey)) {
              hasPhoto = true;
              sanitizedKey = searchKey;
              break;
            }

            // Try without common suffixes/with common variants
            const variants = [
              searchKey,
              searchKey.replace(/\s+/g, '_'),
              searchKey.replace(/\s+/g, '-'),
              searchKey.replace(/[^a-zA-Z0-9]/g, '_'),
            ];
            for (const v of variants) {
              if (localPhotosMap.has(v)) {
                hasPhoto = true;
                sanitizedKey = v;
                break;
              }
            }
            if (hasPhoto) break;
          }
        }

        // Fallback: try matching by name if no image column match
        if (!hasPhoto && name) {
          const nameKey = name.toLowerCase().trim();
          const nameVariants = [
            nameKey,
            nameKey.replace(/\s+/g, '_'),
            nameKey.replace(/\s+/g, '-'),
            nameKey.replace(/[^a-zA-Z0-9]/g, '_'),
          ];
          for (const v of nameVariants) {
            if (localPhotosMap.has(v)) {
              hasPhoto = true;
              sanitizedKey = v;
              break;
            }
          }
        }

        return {
          rowIndex,
          name,
          designation,
          photoUrl: '',
          hasPhoto,
          sanitizedKey,
          rawData: row,
          customFields,
          imageColumnValue,
        };
      });

      setMappedCardholders(mapped);
      setSelectedIndexes(mapped.map((_, i) => i)); // Select all by default
      setWizardStep(2);
      toast(
        `Parsed ${rows.length} rows, matched ${mapped.filter((m) => m.hasPhoto).length} photos`,
        'success'
      );
    } catch (err: any) {
      toast(err.message || 'Analysis failed', 'error');
      console.error('[BatchImport] Analysis error:', err);
    } finally {
      setAnalyzing(false);
    }
  }, [excelFile, zipFile, orderId, getImageFieldNames, toast]);

  /**
   * Step 2 → Step 3: Upload photos and save cardholders to the order.
   */
  const handleSave = useCallback(async () => {
    const selected = mappedCardholders.filter((_, idx) =>
      selectedIndexes.includes(idx)
    );
    if (selected.length === 0) {
      toast('No cardholders selected', 'error');
      return;
    }

    setSaving(true);
    try {
      // 1. Upload photos for matched cardholders
      const cardholdersToCreate: {
        name: string;
        designation: string | null;
        photoUrl: string | null;
        customFields: Record<string, any>;
      }[] = [];

      for (let i = 0; i < selected.length; i++) {
        const ch = selected[i];
        let photoUrl: string | null = null;

        if (ch.hasPhoto && ch.sanitizedKey && photosMap.has(ch.sanitizedKey)) {
          const photoData = photosMap.get(ch.sanitizedKey)!;
          try {
            // Upload the photo blob to the server
            const uploadForm = new FormData();
            const fileName = `${ch.sanitizedKey}.jpg`;
            const file = new File([photoData.blob], fileName, {
              type: 'image/jpeg',
            });
            uploadForm.append('file', file);
            uploadForm.append('type', 'cardholder');

            const uploadRes = await fetch('/api/upload', {
              method: 'POST',
              body: uploadForm,
            });
            if (uploadRes.ok) {
              const uploadData = await uploadRes.json();
              photoUrl = uploadData.url || uploadData.originalUrl || null;
            }
          } catch (uploadErr) {
            console.warn(
              `[BatchImport] Photo upload failed for ${ch.name}:`,
              uploadErr
            );
          }
        }

        cardholdersToCreate.push({
          name: ch.name || 'Unnamed',
          designation: ch.designation || null,
          photoUrl,
          customFields: ch.customFields,
        });
      }

      // 2. Bulk create via the batch-import API
      const res = await fetch(`/api/orders/${orderId}/batch-import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardholders: cardholdersToCreate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save cardholders');

      setSavedCount(data.count || cardholdersToCreate.length);
      setWizardStep(3);
      toast(
        `Successfully imported ${data.count || cardholdersToCreate.length} cardholders`,
        'success'
      );
    } catch (err: any) {
      toast(err.message || 'Failed to save', 'error');
      console.error('[BatchImport] Save error:', err);
    } finally {
      setSaving(false);
    }
  }, [mappedCardholders, selectedIndexes, photosMap, orderId, toast]);

  /**
   * Save inline edits to a cardholder in the review table.
   */
  const handleSaveCardholderEdit = useCallback(() => {
    if (editingIndex === null || !editingCardholder) return;

    const updated = [...mappedCardholders];
    updated[editingIndex] = { ...editingCardholder };

    // Re-check photo matching for the edited record
    const key =
      editingCardholder.imageColumnValue?.toLowerCase().trim() ||
      editingCardholder.name?.toLowerCase().trim().replace(/\s+/g, '_');
    if (key && photosMap.has(key)) {
      updated[editingIndex].hasPhoto = true;
      updated[editingIndex].sanitizedKey = key;
    }

    setMappedCardholders(updated);
    setEditingCardholder(updated[editingIndex]);
    setIsEditingDetail(false);
  }, [editingIndex, editingCardholder, mappedCardholders, photosMap]);

  /**
   * Reset the wizard back to step 1.
   */
  const resetWizard = useCallback(() => {
    // Revoke object URLs
    photosMap.forEach((entry) => {
      if (entry.url.startsWith('blob:')) URL.revokeObjectURL(entry.url);
    });

    setWizardStep(1);
    setExcelFile(null);
    setZipFile(null);
    setParsedRows([]);
    setColumns([]);
    setImageFiles([]);
    setPhotosMap(new Map());
    setMappedCardholders([]);
    setSelectedIndexes([]);
    setSearchQuery('');
    setEditingCardholder(null);
    setEditingIndex(null);
    setIsEditingDetail(false);
    setSavedCount(0);
  }, [photosMap]);

  return {
    // Step
    wizardStep,
    setWizardStep,

    // Files
    excelFile,
    setExcelFile,
    zipFile,
    setZipFile,

    // Loading states
    analyzing,
    saving,
    savedCount,

    // Parsed data
    parsedRows,
    columns,
    imageFiles,
    photosMap,
    mappedCardholders,
    setMappedCardholders,

    // Selection
    selectedIndexes,
    setSelectedIndexes,

    // Search
    searchQuery,
    setSearchQuery,

    // Detail drawer
    editingCardholder,
    setEditingCardholder,
    editingIndex,
    setEditingIndex,
    isEditingDetail,
    setIsEditingDetail,

    // Actions
    handleAnalyze,
    handleSave,
    handleSaveCardholderEdit,
    resetWizard,
  };
}
