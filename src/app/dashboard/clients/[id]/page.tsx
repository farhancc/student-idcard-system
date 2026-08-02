'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import ConfirmDialog from '@/app/components/ConfirmDialog';
import CompileWizardModal from '@/app/components/CompileWizardModal';
import PdfCompileLoadingAnimation from '@/app/components/PdfCompileLoadingAnimation';
import { getResolvedFieldValue, isPlaceholderStaticValue, formatFieldLabel } from '@/lib/pdf/card-renderer-client';
import {
  Building2,
  ArrowLeft,
  Plus,
  FileSpreadsheet,
  Image as ImageIcon,
  Search,
  Trash2,
  ListOrdered,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  FileCheck,
  Download,
  Copy,
  X,
  Zap,
  FileText,
  Settings2,
  RefreshCw,
  CreditCard,
  UserCheck,
  UserX,
  Shuffle,
} from 'lucide-react';

interface Client {
  id: number;
  name: string;
}

interface Cardholder {
  id: number;
  name: string;
  designation?: string;
  photoUrl?: string;
  uniqueKey?: string;
  cardSerial?: string;
  createdAt: string;
  resolvedTemplateId?: number;
  templateName?: string;
  customFields?: string; // JSON string
}

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

interface ZipDetail {
  fileName: string;
  status: string;
  cardholderName?: string;
  message?: string;
  errors?: string[];
  warnings?: string[];
}

interface ZIPImportResult {
  summary?: {
    totalFiles: number;
    matchedCount: number;
    failedValidationCount: number;
    unmatchedCount: number;
  };
  details?: ZipDetail[];
}

interface SerialResult {
  assignedCount: number;
  lastAllocated: number;
}

interface QuickTemplate {
  id: number | string;
  name: string;
}

interface QuickJobResult {
  id: string | number;
  pdfType: string;
  status: string;
  progress: number;
  isLocalJob?: boolean;
  downloadUrl?: string;
  errorMsg?: string;
  orderId?: number;
}

const getCustomFieldValueCaseInsensitive = (parsedCustom: Record<string, any>, key: string): any => {
  if (!parsedCustom) return undefined;
  if (parsedCustom[key] !== undefined && parsedCustom[key] !== null) {
    return parsedCustom[key];
  }
  const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const targetClean = clean(key);
  for (const k of Object.keys(parsedCustom)) {
    if (clean(k) === targetClean) {
      return parsedCustom[k];
    }
  }
  return undefined;
};

const getEffectivePhotoUrl = (ch: any): string | null => {
  if (!ch) return null;
  if (ch.photoUrl && typeof ch.photoUrl === 'string' && ch.photoUrl.trim() !== '' && ch.photoUrl !== 'null' && ch.photoUrl !== 'undefined') {
    return ch.photoUrl.trim();
  }
  if (ch.customFields) {
    try {
      const parsed = typeof ch.customFields === 'string' ? JSON.parse(ch.customFields) : ch.customFields;
      if (parsed && typeof parsed === 'object') {
        for (const photoKey of ['photo', 'photoUrl', 'photo_url', 'avatar', 'image', 'picture', 'student_photo', 'employee_photo']) {
          const val = getCustomFieldValueCaseInsensitive(parsed, photoKey);
          if (val && typeof val === 'string' && val.trim() !== '' && val !== 'null' && val !== 'undefined') {
            return val.trim();
          }
        }
        for (const [key, val] of Object.entries(parsed)) {
          if (val && typeof val === 'string') {
            const cleanVal = val.trim();
            if (
              cleanVal.startsWith('http://') ||
              cleanVal.startsWith('https://') ||
              cleanVal.startsWith('data:image/') ||
              cleanVal.startsWith('/uploads/') ||
              cleanVal.startsWith('/api/uploads/') ||
              cleanVal.startsWith('blob:')
            ) {
              return cleanVal;
            }
          }
        }
      }
    } catch (e) {}
  }
  return null;
};

const cleanFieldKey = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');


/**
 * CardLivePreview — renders a cardholder's ID card onto a <canvas> using
 * the same renderCardSideClient pipeline used for production PDFs.
 */
function CardLivePreview({
  template,
  cardholder,
  side,
}: {
  template: any;
  cardholder: any;
  side: 'front' | 'back';
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [rendering, setRendering] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!canvasRef.current || !template) return;
    let cancelled = false;
    setRendering(true);
    setError(null);

    (async () => {
      try {
        const { renderCardSideClient } = await import('@/lib/pdf/card-renderer-client');
        if (cancelled) return;
        await renderCardSideClient(
          canvasRef.current!,
          {
            id: template.id,
            cardWidth: template.cardWidth,
            cardHeight: template.cardHeight,
            frontImageUrl: template.frontImageUrl || '',
            backImageUrl: template.backImageUrl || null,
            frontOriginalUrl: template.frontOriginalUrl || null,
            backOriginalUrl: template.backOriginalUrl || null,
            frontFields: template.frontFields || '[]',
            backFields: template.backFields || '[]',
          },
          {
            id: cardholder.id,
            name: cardholder.name,
            designation: cardholder.designation,
            photoUrl: cardholder.photoUrl,
            cardSerial: cardholder.cardSerial,
            uniqueKey: cardholder.uniqueKey,
            customFields: cardholder.customFields,
          },
          side,
          null,  // validTillDate — will be resolved from customFields by renderer
          [],    // pressFonts — would need separate fetch; renderer falls back to system fonts
          2      // 2× scale for crisp display
        );
        if (!cancelled) setRendering(false);
      } catch (err: any) {
        if (!cancelled) {
          setError('Preview unavailable');
          setRendering(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [template, cardholder, side]);

  const cardW = template?.cardWidth ?? 320;
  const cardH = template?.cardHeight ?? 200;
  // Scale canvas to fit within ~480px width
  const maxDisplayW = 480;
  const displayScale = Math.min(1, maxDisplayW / cardW);
  const displayW = cardW * displayScale;
  const displayH = cardH * displayScale;

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <canvas
        ref={canvasRef}
        style={{
          width: `${displayW}px`,
          height: `${displayH}px`,
          borderRadius: '10px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          display: 'block',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      />
      {rendering && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '10px',
          background: 'rgba(13,16,27,0.85)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          color: 'var(--muted)', fontSize: '0.8rem', gap: '8px',
        }}>
          <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          Rendering…
        </div>
      )}
      {error && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '10px',
          background: 'rgba(13,16,27,0.85)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          color: '#f87171', fontSize: '0.8rem',
        }}>
          {error}
        </div>
      )}
    </div>
  );
}

export default function ClientDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = Number(params.id);
  const { toast } = useToast();

  const [client, setClient] = useState<Client | null>(null);
  const [cardholders, setCardholders] = useState<Cardholder[]>([]);
  const [clientTemplates, setClientTemplates] = useState<any[]>([]);
  const [filterWarningsOnly, setFilterWarningsOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // UI Tabs / Toggles
  const [activeTab, setActiveTab] = useState<'list' | 'add' | 'csv' | 'zip' | 'serials' | 'portal'>('list');

  // Single Add State
  const [name, setName] = useState('');
  const [designation, setDesignation] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [uniqueKey, setUniqueKey] = useState('');
  const [customFields, setCustomFields] = useState('');
  const [addError, setAddError] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [addTemplateId, setAddTemplateId] = useState('');

  // CSV Import State
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [googleSheetsUrl, setGoogleSheetsUrl] = useState('');
  const [importMode, setImportMode] = useState('check'); // check | skip | update | overwrite
  const [importTemplateId, setImportTemplateId] = useState('');
  const [importResult, setImportResult] = useState<CSVImportResult | null>(null);
  const [importError, setImportError] = useState('');
  const [importLoading, setImportLoading] = useState(false);

  // Column mapping multi-step state
  const [importStep, setImportStep] = useState<'source' | 'mapping' | 'validating' | 'confirm' | 'done'>('source');
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  const [parsedPreview, setParsedPreview] = useState<any[]>([]); // first 3 rows for preview
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({}); // fieldKey -> sourceColumn
  const [importValidationErrors, setImportValidationErrors] = useState<Array<{ row: number; name: string; missingFields: string[] }>>([]);
  const [parseLoading, setParseLoading] = useState(false);
  const [templateFieldDefs, setTemplateFieldDefs] = useState<Array<{ field: string; type: string; isRequired: boolean }>>([]);

  // ZIP Photo Import State
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [zipResult, setZipResult] = useState<ZIPImportResult | null>(null);
  const [zipError, setZipError] = useState('');
  const [zipLoading, setZipLoading] = useState(false);

  // Serials Assign State
  const [serialPrefix, setSerialPrefix] = useState('STU');
  const [serialStart, setSerialStart] = useState('1');
  const [serialPad, setSerialPad] = useState('4');
  const [serialResult, setSerialResult] = useState<SerialResult | null>(null);
  const [serialError, setSerialError] = useState('');
  const [serialLoading, setSerialLoading] = useState(false);

  // Quick-compile from cardholder tab
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Bulk operation state
  const [showBulkReassignModal, setShowBulkReassignModal] = useState(false);
  const [bulkReassignTemplateId, setBulkReassignTemplateId] = useState('');
  const [bulkOperationLoading, setBulkOperationLoading] = useState(false);
  const [searchId, setSearchId] = useState('');
  const [filterTemplate, setFilterTemplate] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [quickTemplates, setQuickTemplates] = useState<QuickTemplate[]>([]);
  const [showCompileModal, setShowCompileModal] = useState(false);
  // Compile Wizard multi-step state
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [wizardCompileType, setWizardCompileType] = useState<'APPROVAL' | 'PRODUCTION' | null>(null);
  const [wizardPaperSize, setWizardPaperSize] = useState('A3');
  const [wizardOrientation, setWizardOrientation] = useState<'PORTRAIT' | 'LANDSCAPE'>('PORTRAIT');
  const [wizardMarginLeft, setWizardMarginLeft] = useState(40);
  const [wizardMarginRight, setWizardMarginRight] = useState(40);
  const [wizardMarginTop, setWizardMarginTop] = useState(40);
  const [wizardMarginBottom, setWizardMarginBottom] = useState(40);
  const [wizardColGap, setWizardColGap] = useState(15);
  const [wizardRowGap, setWizardRowGap] = useState(15);
  const [wizardBleed, setWizardBleed] = useState(0);
  const [wizardCropMarks, setWizardCropMarks] = useState(true);
  const [wizardFoldLine, setWizardFoldLine] = useState(true);
  const [wizardEmptySlotStrategy, setWizardEmptySlotStrategy] = useState<'LEAVE_BLANK' | 'REPEAT_LAST' | 'REPEAT_FIRST' | 'FILL_CUSTOM'>('LEAVE_BLANK');
  const [wizardCustomCards, setWizardCustomCards] = useState<any[]>([]);
  const [wizardSelectedCustomCardId, setWizardSelectedCustomCardId] = useState('');
  const [wizardUploadingCard, setWizardUploadingCard] = useState(false);

  const [qTemplateId, setQTemplateId] = useState('');
  const [qPricePerCard, setQPricePerCard] = useState('50');
  // Legacy aliases kept for inner helpers
  const qCropMarks = wizardCropMarks;
  const qFoldLine = wizardFoldLine;
  const qBleed = wizardBleed;
  const [qCompiling, setQCompiling] = useState<string | null>(null);
  const [qJobResult, setQJobResult] = useState<QuickJobResult | null>(null);
  const [qTemplateMixed, setQTemplateMixed] = useState(false);
  const [qDetectedTemplateName, setQDetectedTemplateName] = useState<string | null>(null);

  // Pre-print Validation Modals for Quick Compile
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [showEmptySlotModal, setShowEmptySlotModal] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [emptySlotStrategy, setEmptySlotStrategy] = useState<'LEAVE_BLANK' | 'REPEAT_LAST' | 'REPEAT_FIRST' | 'FILL_CUSTOM'>('LEAVE_BLANK');
  const [pendingCompileType, setPendingCompileType] = useState<'APPROVAL' | 'PRODUCTION' | null>(null);
  const [pendingPaperSize, setPendingPaperSize] = useState('A3');
  const [pendingOrientation, setPendingOrientation] = useState<'PORTRAIT' | 'LANDSCAPE'>('PORTRAIT');
  const [pendingLayoutConfig, setPendingLayoutConfig] = useState<{ marginLeft: number; marginRight: number; marginTop: number; marginBottom: number; colGap: number; rowGap: number; bleed: number; cropMarks: boolean; foldLine: boolean; } | null>(null);
  const [pendingCustomCardId, setPendingCustomCardId] = useState<string | undefined>(undefined);

  // Load local custom cards list for wizard step 4
  const loadWizardCustomCards = async () => {
    try {
      const { getCustomCards } = await import('@/lib/clientDb');
      const list = await getCustomCards();
      setWizardCustomCards(list);
      if (list.length > 0 && !wizardSelectedCustomCardId) {
        setWizardSelectedCustomCardId(list[0].id);
      }
    } catch {}
  };

  const handleWizardCustomCardUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') { toast('Please upload a PDF file only.', 'error'); return; }
    setWizardUploadingCard(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const b64 = (reader.result as string).split(',')[1];
        const { saveCustomCard } = await import('@/lib/clientDb');
        const saved = await saveCustomCard(file.name, b64);
        toast(`"${file.name}" saved locally!`, 'success');
        setWizardSelectedCustomCardId(saved.id);
        await loadWizardCustomCards();
      } catch (err: any) {
        toast(err.message || 'Failed to save', 'error');
      } finally { setWizardUploadingCard(false); }
    };
    reader.readAsDataURL(file);
  };

  const handleWizardCustomCardDelete = async (id: string) => {
    if (!confirm('Delete this custom PDF card?')) return;
    try {
      const { deleteCustomCard } = await import('@/lib/clientDb');
      await deleteCustomCard(id);
      toast('Custom PDF card deleted.', 'success');
      if (wizardSelectedCustomCardId === id) setWizardSelectedCustomCardId('');
      await loadWizardCustomCards();
    } catch (err: any) { toast(err.message || 'Failed to delete', 'error'); }
  };

  // View / Edit Cardholder Details Modals State
  const [viewingCardholder, setViewingCardholder] = useState<Cardholder | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<any | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewSide, setPreviewSide] = useState<'front' | 'back'>('front');
  const [editingCardholder, setEditingCardholder] = useState<Cardholder | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesignation, setEditDesignation] = useState('');
  const [editUniqueKey, setEditUniqueKey] = useState('');
  const [editPhotoUrl, setEditPhotoUrl] = useState('');
  // Structured custom field editor: { fieldKey -> fieldValue }
  const [editCustomFieldsMap, setEditCustomFieldsMap] = useState<Record<string, string>>({});
  const [editTemplateFields, setEditTemplateFields] = useState<any[]>([]);
  const [uploadingCustomImages, setUploadingCustomImages] = useState<Record<string, boolean>>({});
  const [editHasName, setEditHasName] = useState(true);
  const [editHasDesignation, setEditHasDesignation] = useState(true);
  const [editHasPhoto, setEditHasPhoto] = useState(true);
  const [editHasUniqueKey, setEditHasUniqueKey] = useState(true);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [uploadingEditPhoto, setUploadingEditPhoto] = useState(false);

  // Confirm dialog state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    variant: 'danger' | 'warning';
    onConfirm: () => void;
  } | null>(null);

  const showConfirm = (cfg: typeof confirmConfig) => {
    setConfirmConfig(cfg);
    setConfirmOpen(true);
  };
  const closeConfirm = () => { setConfirmOpen(false); setConfirmConfig(null); };

  const [zipping, setZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState('');

  const handleDownloadAllDataZip = async (targetCardholders?: any[], templateName?: string) => {
    try {
      const listToExport = targetCardholders || cardholders;
      if (listToExport.length === 0) {
        toast('No cardholders to export.', 'warning');
        return;
      }

      setZipping(true);
      setZipProgress('Deducting credits...');

      // Deduct 20 credits for ZIP export (or ZIP Export reason)
      const deductRes = await fetch('/api/press/deduct-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: 20,
          reason: 'ZIP Export'
        })
      });

      if (!deductRes.ok) {
        const deductData = await deductRes.json();
        toast(deductData.error || 'Failed to deduct credits for ZIP export.', 'error');
        setZipping(false);
        return;
      }

      window.dispatchEvent(new CustomEvent('refresh-profile'));

      setZipProgress('Preparing Excel spreadsheet...');

      const escapeFormula = (val: any): any => {
        if (typeof val === 'string' && /^[=\+\-\@\t\r\n]/.test(val)) {
          return `'${val}`;
        }
        return val;
      };

      // 1. Pre-generate unique image IDs for each cardholder to guarantee exact mapping and unique filename in ZIP
      const usedNames = new Set<string>();
      const cardholderImageIds = listToExport.map((ch: any) => {
        let baseName = '';
        
        if (ch.uniqueKey && ch.uniqueKey.trim() !== '') {
          baseName = ch.uniqueKey.trim();
        } else if (ch.customFields) {
          try {
            const parsed = typeof ch.customFields === 'string' ? JSON.parse(ch.customFields) : ch.customFields;
            if (parsed && typeof parsed === 'object') {
              const targetKeys = [
                'roll number', 'rollno', 'roll no', 'rollnumber',
                'employee id', 'empid', 'emp id', 'employeeid',
                'student id', 'studentid', 'student_id',
                'id', 'admission number', 'admissionno'
              ];
              
              for (const targetKey of targetKeys) {
                const matchedKey = Object.keys(parsed).find(
                  k => k.toLowerCase().trim() === targetKey
                );
                if (matchedKey && parsed[matchedKey] && String(parsed[matchedKey]).trim() !== '') {
                  baseName = String(parsed[matchedKey]).trim();
                  break;
                }
              }
            }
          } catch (e) {
            console.error('Error parsing custom fields for image filename', e);
          }
        }

        if (!baseName || baseName === '') {
          baseName = ch.name || `student_${ch.id}`;
        }

        // Build a unique and clean filename
        const cleanKey = baseName.replace(/[^a-zA-Z0-9_\-]/g, '_');
        
        let finalName = cleanKey;
        let counter = 1;
        while (usedNames.has(finalName.toLowerCase())) {
          finalName = `${cleanKey}_${counter}`;
          counter++;
        }
        usedNames.add(finalName.toLowerCase());
        
        return {
          cardholderId: ch.id,
          imageId: finalName
        };
      });

      const imageIdMap = new Map(cardholderImageIds.map(x => [x.cardholderId, x.imageId]));

      // Format data for Excel
      const formattedData = listToExport.map((ch: any) => {
        const imageId = imageIdMap.get(ch.id) || '';
        const row: any = {
          'Name': escapeFormula(ch.name),
          'Image ID': escapeFormula(imageId),
          'Date of Adding': ch.createdAt ? new Date(ch.createdAt).toLocaleDateString() : '',
          'Template Name': escapeFormula(ch.templateName || ''),
          'Photo URL': escapeFormula(ch.photoUrl || ''),
        };

        // Flatten custom fields
        if (ch.customFields) {
          try {
            const parsed = typeof ch.customFields === 'string' ? JSON.parse(ch.customFields) : ch.customFields;
            if (parsed && typeof parsed === 'object') {
              Object.entries(parsed).forEach(([key, val]) => {
                row[`Field: ${key}`] = escapeFormula(val);
              });
            }
          } catch (e) {
            console.error('Failed to parse custom fields for excel export', e);
          }
        }
        return row;
      });

      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Cardholders');

      const sample = formattedData[0] || {};
      sheet.columns = Object.keys(sample).map(key => ({
        header: key,
        key: key,
        width: 20
      }));

      formattedData.forEach(row => {
        sheet.addRow(row);
      });

      const xlsxBuffer = await workbook.xlsx.writeBuffer();

      // Load JSZip
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      // Add the Excel spreadsheet
      zip.file('cardholders.xlsx', xlsxBuffer);

      // Add photos folder
      const photosFolder = zip.folder('photos');

      // Helper to identify if a custom field value is an image path, URL, or Base64 URI
      const isImageUrl = (val: any): boolean => {
        if (typeof val !== 'string') return false;
        const cleanVal = val.trim().toLowerCase();
        
        const isPathOrUrl = cleanVal.startsWith('http://') || 
                            cleanVal.startsWith('https://') || 
                            cleanVal.startsWith('/uploads/') || 
                            cleanVal.startsWith('/api/uploads/') ||
                            cleanVal.startsWith('/') ||
                            cleanVal.startsWith('data:image/');
                            
        const hasImageExtension = cleanVal.endsWith('.jpg') || 
                                  cleanVal.endsWith('.jpeg') || 
                                  cleanVal.endsWith('.png') || 
                                  cleanVal.endsWith('.webp') ||
                                  cleanVal.endsWith('.gif') ||
                                  cleanVal.includes('.png?') ||
                                  cleanVal.includes('.jpg?') ||
                                  cleanVal.includes('.jpeg?') ||
                                  cleanVal.includes('.webp?');

        return isPathOrUrl || hasImageExtension;
      };

      const base64ToBlob = (base64Data: string): Blob => {
        const parts = base64Data.split(';base64,');
        const contentType = parts[0].split(':')[1];
        const raw = window.atob(parts[1]);
        const rawLength = raw.length;
        const uInt8Array = new Uint8Array(rawLength);
        for (let i = 0; i < rawLength; ++i) {
          uInt8Array[i] = raw.charCodeAt(i);
        }
        return new Blob([uInt8Array], { type: contentType });
      };

      // Gather download tasks (both main photo and custom image fields like signatures)
      const downloadTasks: { cardholder: any; key: string; url: string; isCustom: boolean }[] = [];
      let totalImages = 0;

      listToExport.forEach((ch: any) => {
        if (ch.photoUrl) {
          downloadTasks.push({ cardholder: ch, key: 'photo', url: ch.photoUrl, isCustom: false });
          totalImages++;
        }

        if (ch.customFields) {
          try {
            const parsed = typeof ch.customFields === 'string' ? JSON.parse(ch.customFields) : ch.customFields;
            if (parsed && typeof parsed === 'object') {
              Object.entries(parsed).forEach(([key, val]) => {
                if (isImageUrl(val)) {
                  downloadTasks.push({ cardholder: ch, key, url: val as string, isCustom: true });
                  totalImages++;
                }
              });
            }
          } catch (e) {
            console.error('Failed to parse custom fields for zip export tasks', e);
          }
        }
      });

      let processedCount = 0;
      await Promise.all(
        downloadTasks.map(async (task) => {
          const { cardholder: ch, key, url: imageUrl } = task;
          try {
            let blob: Blob;
            let ext = '.png';

            if (imageUrl.startsWith('data:image/')) {
              blob = base64ToBlob(imageUrl);
              const match = imageUrl.match(/data:image\/([a-zA-Z0-9+]+);base64/);
              if (match && match[1]) {
                ext = `.${match[1].replace('jpeg', 'jpg')}`;
              }
            } else {
              const res = await fetch(imageUrl);
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              blob = await res.blob();

              const cleanUrl = imageUrl.split('?')[0].split('#')[0].toLowerCase();
              if (cleanUrl.endsWith('.jpg') || cleanUrl.endsWith('.jpeg')) {
                ext = '.jpg';
              } else if (cleanUrl.endsWith('.webp')) {
                ext = '.webp';
              } else if (cleanUrl.endsWith('.gif')) {
                ext = '.gif';
              }
            }

            const finalName = imageIdMap.get(ch.id);
            if (finalName) {
              const filename = task.isCustom ? `${finalName}_${key}${ext}` : `${finalName}${ext}`;
              photosFolder?.file(filename, blob);
            }
          } catch (err) {
            console.error(`Failed to download image for cardholder ${ch.id} (${key}):`, err);
          } finally {
            processedCount++;
            setZipProgress(`Downloading images (${processedCount}/${totalImages})...`);
          }
        })
      );

      setZipProgress('Compiling ZIP archive...');
      const zipBlob = await zip.generateAsync({ type: 'blob' });

      const safeClientName = (client?.name || 'export').replace(/\s+/g, '_');
      const safeTemplateName = templateName ? `_${templateName.replace(/\s+/g, '_')}` : '';
      const fileName = `Client_${safeClientName}${safeTemplateName}_Data.zip`;
      const url = window.URL.createObjectURL(zipBlob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      window.URL.revokeObjectURL(url);

      toast('ZIP downloaded successfully!', 'success');
    } catch (err: any) {
      console.error('Failed to export ZIP:', err);
      toast('Error exporting ZIP: ' + err.message, 'error');
    } finally {
      setZipping(false);
      setZipProgress('');
    }
  };

  const handlePurgeClient = () => {
    showConfirm({
      title: 'DANGER: Permanently Purge Client?',
      message: 'This will permanently delete all cardholders, templates, completed PDF jobs, and local backup assets associated with this client. In addition, all student/employee photos and PDFs stored in Cloudinary will be permanently destroyed. This action cannot be undone. Are you absolutely sure?',
      confirmLabel: 'Purge Permanently',
      variant: 'danger',
      onConfirm: async () => {
        closeConfirm();
        try {
          toast('Purging client data and assets...', 'info');
          const deleteRes = await fetch(`/api/clients/${clientId}`, {
            method: 'DELETE',
          });

          if (!deleteRes.ok) {
            const deleteData = await deleteRes.json();
            toast(deleteData.error || 'Failed to purge client data.', 'error');
            return;
          }

          toast('Client and all associated data purged permanently!', 'success');
          router.push('/dashboard/clients');
        } catch (err: any) {
          console.error('Failed to purge client:', err);
          toast('Error purging client: ' + err.message, 'error');
        }
      }
    });
  };

  const fetchData = async () => {
    try {
      const clientRes = await fetch(`/api/clients/${clientId}`);
      if (!clientRes.ok) throw new Error('Client not found');
      const clientData = await clientRes.json();
      setClient(clientData.client);

      const cardholdersRes = await fetch(`/api/clients/${clientId}/cardholders`);
      if (cardholdersRes.ok) {
        const cardholdersData = await cardholdersRes.json();
        setCardholders(cardholdersData.cardholders || []);
        if (cardholdersData.templates) {
          setClientTemplates(cardholdersData.templates);
        }
      }
    } catch (err) {
      console.error(err);
      router.push('/dashboard/clients');
    } finally {
      setLoading(false);
    }
  };

  const fetchQuickTemplates = async () => {
    try {
      const res = await fetch(`/api/templates?_t=${Date.now()}`);
      if (res.ok) {
        const json = await res.json();
        const list = [
          ...(json.templates || []),
          ...(json.globalTemplates || []).map((t: any) => ({ ...t, name: `⭐ ${t.name} (Starter)` }))
        ];
        setQuickTemplates(list);
        if (list.length > 0) setQTemplateId(String(list[0].id));
      }
    } catch (err) { console.error(err); }
  };

  const handleRefresh = async () => {
    setLoading(true);
    await Promise.all([
      fetchData(),
      fetchQuickTemplates()
    ]);
  };

  useEffect(() => {
    fetchData();
    fetchQuickTemplates();
  }, [clientId]);

  // Fetch template for the live preview when view modal opens
  useEffect(() => {
    if (!viewingCardholder) {
      setPreviewTemplate(null);
      return;
    }
    const templateId = viewingCardholder.resolvedTemplateId;
    if (!templateId) {
      setPreviewTemplate(null);
      return;
    }
    setPreviewLoading(true);
    setPreviewSide('front');
    fetch(`/api/templates/${templateId}?_t=${Date.now()}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.template) setPreviewTemplate(data.template);
        else setPreviewTemplate(null);
      })
      .catch(() => setPreviewTemplate(null))
      .finally(() => setPreviewLoading(false));
  }, [viewingCardholder]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'photo');

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to upload photo');

      setPhotoUrl(data.url);
    } catch (err: any) {
      toast(err.message || 'Failed to upload photo', 'error');
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Single Add handler
  const handleAddCardholder = async (e?: React.FormEvent, force: boolean = false) => {
    if (e) e.preventDefault();
    setAddError('');
    setAddLoading(true);

    try {
      let customJson = null;
      if (customFields.trim()) {
        customJson = JSON.parse(customFields);
      }

      const res = await fetch(`/api/clients/${clientId}/cardholders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          designation,
          photoUrl,
          uniqueKey,
          customFields: customJson,
          ignoreDuplicate: force,
          ...(addTemplateId ? { templateId: Number(addTemplateId) } : {}),
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        if (json.duplicate && !force) {
          const confirmAdd = window.confirm(
            `${json.message || 'A cardholder with this name and designation already exists.'}\n\nDo you want to add them anyway?`
          );
          if (confirmAdd) {
            setAddLoading(false);
            handleAddCardholder(undefined, true);
            return;
          } else {
            throw new Error(json.message || 'Duplicate cardholder entry cancelled.');
          }
        }
        throw new Error(json.error || json.message || 'Failed to add cardholder');
      }

      // Reset
      setName('');
      setDesignation('');
      setPhotoUrl('');
      setUniqueKey('');
      setCustomFields('');
      setAddTemplateId('');
      setActiveTab('list');
      fetchData();
    } catch (err: any) {
      setAddError(err.message || 'JSON parsing or server error occurred');
    } finally {
      setAddLoading(false);
    }
  };

  // CSV Import handler
  // Step 1→2: Parse file client-side to detect headers and build mapping UI
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

  // CSV Import handler (step confirm → done)
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
        fetchData();
      }
    } catch (err: any) {
      setImportError(err.message || 'Import failed');
    } finally {
      setImportLoading(false);
    }
  };

  // ZIP Photo Import handler
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
      fetchData();
    } catch (err: any) {
      setZipError(err.message || 'ZIP import failed');
    } finally {
      setZipLoading(false);
    }
  };

  // Assign Serials handler
  const handleAssignSerials = async (e: React.FormEvent) => {
    e.preventDefault();
    setSerialError('');
    setSerialResult(null);
    setSerialLoading(true);

    try {
      const res = await fetch(`/api/clients/${clientId}/assign-serials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prefix: serialPrefix.trim(),
          startSeq: Number(serialStart) || 1,
          padLen: Number(serialPad) || 4,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to assign serials');

      setSerialResult(json);
      fetchData();
    } catch (err: any) {
      setSerialError(err.message || 'Serials assignment failed');
    } finally {
      setSerialLoading(false);
    }
  };

  // Cardholder deletion
  const handleDeleteCardholder = (id: number) => {
    showConfirm({
      title: 'Delete Cardholder',
      message: 'This will permanently delete the cardholder and all their card data. This action cannot be undone.',
      confirmLabel: 'Delete',
      variant: 'danger',
      onConfirm: async () => {
        closeConfirm();
        try {
          const res = await fetch(`/api/cardholders/${id}`, { method: 'DELETE' });
          if (res.ok) {
            setSelectedIds(prev => prev.filter(x => x !== id));
            fetchData();
          }
        } catch (err) { console.error(err); }
      },
    });
  };

  // Individual Compile PDF trigger
  const handleCompileIndividual = (ch: any) => {
    setSelectedIds([ch.id]);
    if (ch.resolvedTemplateId) {
      setQTemplateId(String(ch.resolvedTemplateId));
      const tpl = quickTemplates.find(t => t.id === ch.resolvedTemplateId);
      setQDetectedTemplateName(tpl?.name || null);
      setQTemplateMixed(false);
    } else {
      setQDetectedTemplateName(null);
      setQTemplateMixed(false);
      if (quickTemplates.length > 0) {
        setQTemplateId(String(quickTemplates[0].id));
      }
    }
    setQJobResult(null);
    setWizardStep(1);
    setWizardCompileType(null);
    setWizardPaperSize('A3');
    setWizardOrientation('PORTRAIT');
    setWizardEmptySlotStrategy('LEAVE_BLANK');
    setShowCompileModal(true);
  };

  // View Details trigger
  const handleViewDetails = (ch: any) => {
    setViewingCardholder(ch);
  };

  // Edit Details trigger
  const handleEditDetails = (ch: any) => {
    setEditingCardholder(ch);
    setEditName(ch.name || '');
    setEditDesignation(ch.designation || '');
    setEditUniqueKey(ch.uniqueKey || '');
    setEditPhotoUrl(ch.photoUrl || '');
    
    // Find active template coordinates
    const tmpl = clientTemplates.find(t => t.id === ch.resolvedTemplateId) || 
                 clientTemplates.find(t => t.name === ch.templateName) ||
                 clientTemplates[0];

    // Determine field visibility based on template coordinates
    let hasName = true;
    let hasDesignation = true;
    let hasPhoto = true;
    let hasUniqueKey = true;
    let parsedMap: Record<string, string> = {};

    let allFields: any[] = [];

    if (tmpl) {
      try {
        const front = JSON.parse(tmpl.frontFields || '[]');
        const back = JSON.parse(tmpl.backFields || '[]');
        allFields = [...front, ...back];
        const cleanFieldKey = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
        const mappedFields = allFields.map(f => cleanFieldKey(f.field));

        hasName = mappedFields.includes('name') || mappedFields.includes('fullname') || mappedFields.includes('studentname');
        hasDesignation = mappedFields.includes('designation') || mappedFields.includes('role');
        
        const imageFields = allFields.filter(f => f.type === 'image');
        const mainPhoto = imageFields.find(f => {
          const clean = cleanFieldKey(f.field);
          return clean === 'photo' || 
            clean === 'avatar' || 
            clean === 'photourl' ||
            clean.includes('photo') || 
            clean.includes('avatar') || 
            clean.includes('profile');
        }) || null;
        hasPhoto = mainPhoto !== null;
        
        hasUniqueKey = false;

        // Extract customFields map from record but ONLY keep those in the template
        let existingCustom: Record<string, any> = {};
        if (ch.customFields) {
          try {
            existingCustom = typeof ch.customFields === 'string' ? JSON.parse(ch.customFields) : ch.customFields;
          } catch {}
        }

        allFields.forEach(f => {
          const isMainPhotoField = mainPhoto && f.field === mainPhoto.field;
          const clean = cleanFieldKey(f.field);
          if (
            clean !== 'photo' &&
            clean !== 'avatar' &&
            clean !== 'photourl' &&
            clean !== 'validtill' &&
            clean !== 'validtilldate' &&
            clean !== 'cardserial' &&
            !isMainPhotoField
          ) {
            const foundVal = getCustomFieldValueCaseInsensitive(existingCustom, f.field);
            let val = foundVal !== undefined ? String(foundVal) : '';
            if (!val) {
              if (clean === 'name' || clean === 'fullname' || clean === 'studentname') {
                val = ch.name || '';
              } else if (clean === 'designation' || clean === 'role') {
                val = ch.designation || '';
              }
            }
            parsedMap[f.field] = val;
          }
        });
      } catch (e) {
        console.error('Error parsing template for editing:', e);
      }
    } else {
      // Fallback: if no template is defined/resolved, show all fields currently on the record
      if (ch.customFields) {
        try {
          const parsed = typeof ch.customFields === 'string' ? JSON.parse(ch.customFields) : ch.customFields;
          if (parsed && typeof parsed === 'object') {
            Object.entries(parsed).forEach(([k, v]) => {
              parsedMap[k] = String(v ?? '');
            });
          }
        } catch {}
      }
    }

    setEditTemplateFields(allFields);
    setEditHasName(hasName);
    setEditHasDesignation(hasDesignation);
    setEditHasPhoto(hasPhoto);
    setEditHasUniqueKey(hasUniqueKey);
    setEditCustomFieldsMap(parsedMap);
    setEditError('');
  };

  // Save Cardholder Edit
  const handleSaveEditCardholder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCardholder) return;
    setEditError('');
    setEditLoading(true);

    try {
      // Build customFields from the structured map (skip empty values)
      const customJson: Record<string, string> | null =
        Object.keys(editCustomFieldsMap).length > 0
          ? Object.fromEntries(Object.entries(editCustomFieldsMap).filter(([, v]) => v.trim() !== ''))
          : null;

      const res = await fetch(`/api/cardholders/${editingCardholder.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          designation: editHasDesignation ? editDesignation : null,
          photoUrl: editHasPhoto ? editPhotoUrl : null,
          customFields: customJson,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update cardholder');

      setEditingCardholder(null);
      toast('Cardholder updated successfully', 'success');
      fetchData();
    } catch (err: any) {
      setEditError(err.message || 'Server error occurred');
    } finally {
      setEditLoading(false);
    }
  };

  // Edit photo upload handler
  const handleEditPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingEditPhoto(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'photo');

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to upload photo');

      setEditPhotoUrl(data.url);
    } catch (err: any) {
      toast(err.message || 'Failed to upload photo', 'error');
    } finally {
      setUploadingEditPhoto(false);
    }
  };

  const handleCustomImageUpload = async (key: string, file: File) => {
    setUploadingCustomImages(prev => ({ ...prev, [key]: true }));
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'photo');

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to upload image');
      const uploadedUrl = data.url || '';
      if (!uploadedUrl) throw new Error('Upload succeeded but no URL was returned');

      setEditCustomFieldsMap(prev => ({ ...prev, [key]: uploadedUrl }));
    } catch (err: any) {
      toast(err.message || `Failed to upload ${key}`, 'error');
    } finally {
      setUploadingCustomImages(prev => ({ ...prev, [key]: false }));
    }
  };

  // Auto-detect template from selected cardholders and open compile modal
  const handleOpenCompileModal = () => {
    setQJobResult(null);
    const selectedCardholders = cardholders.filter((ch: any) => selectedIds.includes(ch.id));
    const templateIds = [...new Set(
      selectedCardholders
        .map((ch: any) => ch.resolvedTemplateId)
        .filter(Boolean)
    )] as number[];

    if (templateIds.length === 1) {
      setQTemplateId(String(templateIds[0]));
      const tpl = quickTemplates.find(t => t.id === templateIds[0]);
      setQDetectedTemplateName(tpl?.name || null);
      setQTemplateMixed(false);
    } else if (templateIds.length > 1) {
      setQTemplateId(String(templateIds[0]));
      setQDetectedTemplateName(null);
      setQTemplateMixed(true);
    } else {
      setQDetectedTemplateName(null);
      setQTemplateMixed(false);
      if (quickTemplates.length > 0 && !qTemplateId) {
        setQTemplateId(String(quickTemplates[0].id));
      }
    }
    // Reset wizard state
    setWizardStep(1);
    setWizardCompileType(null);
    setWizardPaperSize('A3');
    setWizardOrientation('PORTRAIT');
    setWizardMarginLeft(40); setWizardMarginRight(40);
    setWizardMarginTop(40); setWizardMarginBottom(40);
    setWizardColGap(15); setWizardRowGap(15);
    setWizardBleed(0); setWizardCropMarks(true); setWizardFoldLine(true);
    setWizardEmptySlotStrategy('LEAVE_BLANK');
    setShowCompileModal(true);
  };

  const proceedWithQuickCompile = async (
    type: 'APPROVAL' | 'PRODUCTION',
    skipValidation = false,
    selectedStrategy: 'LEAVE_BLANK' | 'REPEAT_LAST' | 'REPEAT_FIRST' | 'FILL_CUSTOM' = 'LEAVE_BLANK',
    overridePaperSize?: string,
    overrideOrientation?: string,
    layoutConfig?: {
      marginLeft: number; marginRight: number; marginTop: number; marginBottom: number;
      colGap: number; rowGap: number; bleed: number; cropMarks: boolean; foldLine: boolean;
    },
    customCardId?: string
  ) => {
    if (!qTemplateId || selectedIds.length === 0) return;
    setQCompiling(type);
    setQJobResult(null);
    try {
      const targetPaperSize = overridePaperSize || 'A3';
      const targetOrientation = overrideOrientation || 'PORTRAIT';
      const lc = layoutConfig || { marginLeft: 40, marginRight: 40, marginTop: 40, marginBottom: 40, colGap: 15, rowGap: 15, bleed: 0, cropMarks: true, foldLine: true };

      // 1. Create order
      const orderRes = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          templateId: Number(qTemplateId),
          cardholderIds: selectedIds,
          pricePerCard: Number(qPricePerCard) || 0,
          status: type === 'PRODUCTION' ? 'APPROVED' : 'DRAFT',
        }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.error || 'Failed to create order');

      // 2. Queue job with full layout config
      const jobBody: any = {
        orderId: orderData.order.id,
        pdfType: type,
        paperSize: (targetPaperSize === 'SRA3' || targetPaperSize === '13x19') ? 'CUSTOM' : targetPaperSize,
        orientation: targetOrientation,
        bleed: lc.bleed,
        cropMarks: lc.cropMarks,
        foldLine: lc.foldLine,
        marginLeft: lc.marginLeft,
        marginRight: lc.marginRight,
        marginTop: lc.marginTop,
        marginBottom: lc.marginBottom,
        colGap: lc.colGap,
        rowGap: lc.rowGap,
        emptySlotStrategy: selectedStrategy,
        bypassValidation: skipValidation,
      };
      if (selectedStrategy === 'FILL_CUSTOM' && customCardId) {
        jobBody.emptySlotCustomCardId = customCardId;
      }
      if (targetPaperSize === 'SRA3') {
        jobBody.customWidth = targetOrientation === 'PORTRAIT' ? 907.09 : 1275.59;
        jobBody.customHeight = targetOrientation === 'PORTRAIT' ? 1275.59 : 907.09;
      } else if (targetPaperSize === '13x19') {
        jobBody.customWidth = targetOrientation === 'PORTRAIT' ? 936 : 1368;
        jobBody.customHeight = targetOrientation === 'PORTRAIT' ? 1368 : 936;
      }

      const jobRes = await fetch('/api/jobs/production-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jobBody),
      });
      const jobData = await jobRes.json();
      if (!jobRes.ok) throw new Error(jobData.error || 'Failed to queue PDF job');

      setQJobResult({
        id: jobData.jobId,
        pdfType: type,
        status: 'PENDING',
        progress: 0,
        isLocalJob: true,
        orderId: orderData.order.id,
      });
      
      window.dispatchEvent(new Event('refresh-profile'));
    } catch (e: any) {
      toast(e.message || 'Compile failed', 'error');
    } finally {
      setQCompiling(null);
    }
  };

  // Quick-compile handler (with validation flow)
  const handleQuickCompile = async (type: 'APPROVAL' | 'PRODUCTION', cfg?: {
    paperSize: string; orientation: 'PORTRAIT'|'LANDSCAPE';
    marginLeft: number; marginRight: number; marginTop: number; marginBottom: number;
    colGap: number; rowGap: number; bleed: number; cropMarks: boolean; foldLine: boolean;
    emptySlotStrategy: 'LEAVE_BLANK'|'REPEAT_LAST'|'REPEAT_FIRST'|'FILL_CUSTOM';
    customCardId?: string;
  }) => {
    const livePaper = cfg?.paperSize ?? wizardPaperSize;
    const liveOri = cfg?.orientation ?? wizardOrientation;
    const liveML = cfg?.marginLeft ?? wizardMarginLeft;
    const liveMR = cfg?.marginRight ?? wizardMarginRight;
    const liveMT = cfg?.marginTop ?? wizardMarginTop;
    const liveMB = cfg?.marginBottom ?? wizardMarginBottom;
    const liveCG = cfg?.colGap ?? wizardColGap;
    const liveRG = cfg?.rowGap ?? wizardRowGap;
    const liveBl = cfg?.bleed ?? wizardBleed;
    const liveCrp = cfg?.cropMarks ?? wizardCropMarks;
    const liveFl = cfg?.foldLine ?? wizardFoldLine;
    const liveStrategy = cfg?.emptySlotStrategy ?? wizardEmptySlotStrategy;
    const liveCustomId = cfg?.customCardId ?? wizardSelectedCustomCardId;
    if (!qTemplateId || selectedIds.length === 0) return;
    setQCompiling(type);
    setQJobResult(null);
    try {
      // Fetch cardholders to validate
      const selectedCards = cardholders.filter(c => selectedIds.includes(c.id));

      // Fetch template details for fields & layout
      const tempRes = await fetch(`/api/templates/${qTemplateId}`);
      if (!tempRes.ok) throw new Error('Failed to fetch template details for validation');
      const tempData = await tempRes.json();
      const template = tempData.template;

      // 1. Fetch template field requirements
      const fieldsRes = await fetch(`/api/templates/${qTemplateId}/fields`);
      if (!fieldsRes.ok) throw new Error('Failed to fetch template fields for validation');
      const fieldsData = await fieldsRes.json();
      const templateFields = fieldsData.fields || [];

      // 2. Scan cardholders for missing required fields
      const missingList: { cardholderName: string; missingFields: string[]; cardholderId: number }[] = [];
      const requiredFields = templateFields.filter((f: any) => f.isRequired);

      for (const ch of selectedCards) {
        const missingFields: string[] = [];
        let custom: Record<string, any> = {};
        if (ch.customFields) {
          try { custom = typeof ch.customFields === 'string' ? JSON.parse(ch.customFields) : ch.customFields; } catch {}
        }
        for (const f of requiredFields) {
          let hasValue = false;
          const fieldName = f.field.toLowerCase();
          if (fieldName === 'name' || fieldName === 'fullname') {
            hasValue = !!ch.name && ch.name.trim().length > 0;
          } else if (fieldName === 'designation' || fieldName === 'role') {
            const hasCustomDesignation = Object.entries(custom).some(([k, v]) => {
              const kc = k.toLowerCase().replace(/[^a-z0-9]/g, '');
              return (kc === 'designation' || kc === 'role' || kc === 'class' || kc === 'grade' || kc === 'standard' || kc === 'position' || kc === 'post') &&
                     v !== undefined && v !== null && String(v).trim().length > 0;
            });
            hasValue = (!!ch.designation && ch.designation.trim().length > 0) || hasCustomDesignation;
          } else if (fieldName === 'photo' || fieldName === 'photourl' || fieldName === 'avatar' || fieldName === 'profile') {
            hasValue = !!ch.photoUrl && ch.photoUrl.trim().length > 0;
          } else if (fieldName === 'uniquekey' || fieldName === 'id' || f.type === 'id') {
            const hasCustomId = Object.entries(custom).some(([k, v]) => {
              const kc = k.toLowerCase().replace(/[^a-z0-9]/g, '');
              return (kc === 'uniquekey' || kc === 'id' || kc === 'unique_key') &&
                     v !== undefined && v !== null && String(v).trim().length > 0;
            });
            hasValue = (!!ch.uniqueKey && ch.uniqueKey.trim().length > 0) || hasCustomId;
          } else {
            const targetLower = f.field.toLowerCase().trim();
            let val = undefined;
            for (const [key, v] of Object.entries(custom)) {
              if (key.toLowerCase().trim() === targetLower) { val = v; break; }
            }
            hasValue = val !== undefined && val !== null && String(val).trim().length > 0;
          }
          if (!hasValue) missingFields.push(f.prefix || f.field);
        }
        if (missingFields.length > 0) {
          missingList.push({ cardholderName: ch.name || `Cardholder #${ch.id}`, missingFields, cardholderId: ch.id });
        }
      }

      // 3. Calculate empty slots using live wizard config
      let pageWidth: number;
      let pageHeight: number;
      if (livePaper === 'SRA3') {
        pageWidth = liveOri === 'PORTRAIT' ? 907.09 : 1275.59;
        pageHeight = liveOri === 'PORTRAIT' ? 1275.59 : 907.09;
      } else if (livePaper === '13x19') {
        pageWidth = liveOri === 'PORTRAIT' ? 936 : 1368;
        pageHeight = liveOri === 'PORTRAIT' ? 1368 : 936;
      } else if (livePaper === 'A4') {
        pageWidth = liveOri === 'PORTRAIT' ? 595.27 : 841.89;
        pageHeight = liveOri === 'PORTRAIT' ? 841.89 : 595.27;
      } else {
        pageWidth = liveOri === 'PORTRAIT' ? 841.89 : 1190.55;
        pageHeight = liveOri === 'PORTRAIT' ? 1190.55 : 841.89;
      }

      const bleedPt = (liveBl || 0) * 2.83464567;
      const isPortraitTemplate = (template.cardWidth || 673) < (template.cardHeight || 1039);
      const cardBaseWidth = isPortraitTemplate ? 153 : 242.6;
      const cardBaseHeight = isPortraitTemplate ? 242.6 : 153;
      const cWidth = cardBaseWidth + bleedPt * 2;
      const cHeight = cardBaseHeight + bleedPt * 2;

      const marginX = liveML; const marginXR = liveMR;
      const marginY = liveMT; const marginYB = liveMB;
      const colGap = liveCG; const rowGap = liveRG;

      const foldGap = 10;
      const isSingleSided = !template.backImageUrl || (template.backFields === '[]' || !template.backFields);
      const cols = Math.floor((pageWidth - marginX - marginXR + colGap) / (cWidth + colGap)) || 1;

      let cardsPerPage: number;
      if (isSingleSided) {
        const fullHeight = pageHeight - marginY - marginYB;
        const rowsPerPage = Math.floor((fullHeight + rowGap) / (cHeight + rowGap)) || 1;
        cardsPerPage = cols * rowsPerPage;
      } else {
        const centerY = pageHeight / 2;
        const halfHeight = centerY - Math.max(marginY, marginYB);
        const rowsPerHalf = Math.floor((halfHeight - foldGap + rowGap) / (cHeight + rowGap)) || 1;
        cardsPerPage = cols * rowsPerHalf;
      }

      const totalCards = selectedCards.length;
      const totalPages = Math.ceil(totalCards / cardsPerPage);
      const totalSlots = totalPages * cardsPerPage;

      const layoutConfig = {
        marginLeft: liveML, marginRight: liveMR,
        marginTop: liveMT, marginBottom: liveMB,
        colGap: liveCG, rowGap: liveRG,
        bleed: liveBl, cropMarks: liveCrp, foldLine: liveFl,
      };

      setValidationResult({ missingFields: missingList, totalCards, totalSlots });
      setPendingCompileType(type);
      setPendingPaperSize(livePaper);
      setPendingOrientation(liveOri);
      setPendingLayoutConfig(layoutConfig);
      setPendingCustomCardId(liveCustomId);
      setQCompiling(null);

      if (missingList.length > 0) {
        setShowValidationModal(true);
      } else if (totalSlots > totalCards && !cfg) {
        // Only show the legacy empty-slot modal when NOT coming from the wizard
        // (wizard already captured the strategy in Step 4)
        setShowEmptySlotModal(true);
      } else {
        await proceedWithQuickCompile(type, false, liveStrategy, livePaper, liveOri, layoutConfig, liveCustomId);
      }
    } catch (err: any) {
      toast(err.message || 'Validation failed', 'error');
      setQCompiling(null);
    }
  };

  // Poll for active quick compile job
  useEffect(() => {
    if (!qJobResult || qJobResult.status === 'COMPLETED' || qJobResult.status === 'FAILED') return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${qJobResult.id}`);
        const data = await res.json();
        if (data.success && data.job) {
          setQJobResult((prev: any) => {
            if (!prev) return null;
            return {
              ...prev,
              status: data.job.status,
              progress: data.job.progress,
              errorMsg: data.job.errorMsg,
              isLocalJob: data.job.isLocalJob,
              downloadUrl: data.job.downloadUrl,
            };
          });
          
          if (data.job.status === 'COMPLETED' || data.job.status === 'FAILED') {
            window.dispatchEvent(new Event('refresh-profile'));
          }
        }
      } catch (e) {
        console.error('Error polling quick compile job:', e);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [qJobResult]);

  // Lost card reporter
  const handleMarkLost = async (id: number) => {
    const reason = prompt('Please enter the reprint reason/remarks (e.g. Lost in classroom, Damaged chip):');
    if (reason === null) return; // cancel

    try {
      const res = await fetch(`/api/cardholders/${id}/lost`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remarks: reason }),
      });
      if (res.ok) {
        toast('Card marked as LOST. Print cache stale for future individual re-printing.', 'warning');
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  function getTemplateColumns(tmpl: any) {
    if (!tmpl) return [];
    try {
      const front = JSON.parse(tmpl.frontFields || '[]');
      const back = JSON.parse(tmpl.backFields || '[]');
      const all = [...front, ...back];
      
      const seen = new Set<string>();
      const cols: { key: string; label: string; type: string }[] = [];

      all.forEach((f: any) => {
        if (!f.field || seen.has(f.field) || f.type === 'qr' || f.type === 'barcode') return;
        seen.add(f.field);

        let label = (f.label || f.name || f.field).trim();
        if (!f.label && !f.name) {
          label = formatFieldLabel(f.field);
        }

        cols.push({
          key: f.field,
          label,
          type: f.type || 'text',
        });
      });

      return cols;
    } catch (e) {
      return [];
    }
  }

  function getFieldValue(ch: any, colKey: string): string {
    if (!ch) return '';
    if (colKey === 'name' || colKey === 'fullName') return ch.name || '';
    if (colKey === 'designation' || colKey === 'role') return ch.designation || '';
    if (colKey === 'uniqueKey') {
      const custom = ch.customFields ? (typeof ch.customFields === 'string' ? JSON.parse(ch.customFields) : ch.customFields) : {};
      return ch.uniqueKey || custom.uniqueKey || custom.id || custom.unique_key || '';
    }
    if (colKey === 'photoUrl' || colKey === 'photo' || colKey === 'avatar') return getEffectivePhotoUrl(ch) || '';

    if (ch.customFields) {
      try {
        const parsed = typeof ch.customFields === 'string' ? JSON.parse(ch.customFields) : ch.customFields;
        const val = getCustomFieldValueCaseInsensitive(parsed, colKey);
        if (val !== undefined && val !== null && String(val).trim() !== '') return String(val);
      } catch (e) {}
    }

    const cleanKey = colKey.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleanKey.includes('photo') || cleanKey.includes('avatar') || cleanKey.includes('image') || cleanKey.includes('picture')) {
      return getEffectivePhotoUrl(ch) || '';
    }

    return '';
  }

  const getCardholderWarnings = (ch: Cardholder) => {
    const warnings: string[] = [];
    
    // Find the template by resolvedTemplateId or templateName
    const tmpl = clientTemplates.find(t => t.id === ch.resolvedTemplateId) || 
                 clientTemplates.find(t => t.name === ch.templateName) ||
                 clientTemplates[0];
                 
    if (!tmpl) return [];
    
    try {
      const front = JSON.parse(tmpl.frontFields || '[]');
      const back = JSON.parse(tmpl.backFields || '[]');
      const allFields: any[] = [...front, ...back];

      // Parse custom fields
      let parsedCustom: Record<string, any> = {};
      if (ch.customFields) {
        parsedCustom = typeof ch.customFields === 'string' ? JSON.parse(ch.customFields) : ch.customFields;
      }

      const cardholderData = {
        name: ch.name,
        designation: ch.designation,
        uniqueKey: ch.uniqueKey || parsedCustom.uniqueKey || parsedCustom.id || parsedCustom.unique_key || '',
        photoUrl: ch.photoUrl,
        cardSerial: ch.cardSerial,
        customFields: parsedCustom
      };

      const checkedFields = new Set<string>();

      allFields.forEach((f: any) => {
        if (!f || !f.field) return;

        // Skip static text/image overrides explicitly hardcoded on template background canvas
        if (f.staticValue !== undefined && f.staticValue !== null && !isPlaceholderStaticValue(f.staticValue, f.field)) {
          return;
        }

        // Skip auto-generated system metadata fields
        const fieldClean = f.field.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (fieldClean === 'validtill' || fieldClean === 'validtilldate' || fieldClean === 'cardserial') {
          return;
        }

        // Avoid duplicate warnings for fields placed multiple times on canvas
        if (checkedFields.has(f.field)) return;
        checkedFields.add(f.field);

        // Standard name field check
        if (fieldClean === 'name' || fieldClean === 'fullname' || fieldClean === 'studentname') {
          const nameVal = getResolvedFieldValue(f.field, cardholderData, ch) || ch.name;
          if (!nameVal || String(nameVal).trim() === '') {
            warnings.push('Name is required');
          }
          return;
        }

        // Standard designation field check
        if (fieldClean === 'designation' || fieldClean === 'role') {
          const desVal = getResolvedFieldValue(f.field, cardholderData, ch) || ch.designation;
          if (!desVal || String(desVal).trim() === '') {
            warnings.push('Designation is missing');
          }
          return;
        }

        // ── ID / Unique Key check ───────────────────────────────────────────
        // IMPORTANT: Do NOT fall back to cardSerial here — cardSerial is
        // auto-generated and is NOT a user-provided ID. If it's the only
        // thing present, the ID field is genuinely missing for the user.
        if (f.type === 'id' || fieldClean === 'uniquekey' || fieldClean === 'id' || fieldClean === 'studentid' || fieldClean === 'rollnumber' || fieldClean === 'admissionnumber') {
          // Check for a real user-provided ID value (not just cardSerial fallback)
          const idFromCustom = parsedCustom.uniqueKey || parsedCustom.id || parsedCustom.unique_key ||
            // Also check all custom fields for any explicit ID-like key
            Object.entries(parsedCustom).find(([k]) => {
              const kc = k.toLowerCase().replace(/[^a-z0-9]/g, '');
              return kc === 'id' || kc === 'studentid' || kc === 'rollno' || kc === 'rollnumber' || kc === 'admno' || kc === 'admissionnumber' || kc === 'empid' || kc === 'employeeid';
            })?.[1];
          const idVal = ch.uniqueKey || idFromCustom;
          if (!idVal || String(idVal).trim() === '' || String(idVal) === 'null' || String(idVal) === 'undefined') {
            const label = formatFieldLabel(f.field);
            warnings.push(`${label} is missing`);
          }
          return;
        }

        // Image field check (profile photo or custom image like signature)
        if (f.type === 'image') {
          const imgVal = getResolvedFieldValue(f.field, cardholderData, ch) || (fieldClean.includes('photo') || fieldClean.includes('avatar') || fieldClean.includes('profile') ? ch.photoUrl : null);
          if (!imgVal || String(imgVal).trim() === '' || String(imgVal) === 'null' || String(imgVal) === 'undefined') {
            const label = formatFieldLabel(f.field);
            warnings.push(`${label} is missing`);
          }
          return;
        }

        // ── All other fields: text, number, date, etc. ──────────────────────
        // Use resolveFieldRawValue to match the exact same resolution as the renderer
        const val = getResolvedFieldValue(f.field, cardholderData, ch);
        const valStr = val === undefined || val === null ? '' : String(val).trim();
        if (valStr === '' || valStr === 'null' || valStr === 'undefined') {
          const label = formatFieldLabel(f.field);
          warnings.push(`${label} is missing`);
        }
      });
    } catch (e) {
      console.error('Error validating cardholder', e);
    }
    
    return warnings;
  };

  const filteredCardholders = cardholders.filter((c: any) => {
    // 1. General search: Name, Designation
    const matchesSearch = !search.trim() || 
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.designation && c.designation.toLowerCase().includes(search.toLowerCase()));

    // 2. ID / Unique key search (searchId)
    const matchesSearchId = !searchId.trim() || (() => {
      const custom = c.customFields ? (typeof c.customFields === 'string' ? JSON.parse(c.customFields) : c.customFields) : {};
      const idVal = c.uniqueKey || custom.uniqueKey || custom.id || custom.unique_key || '';
      return String(idVal).toLowerCase().includes(searchId.toLowerCase());
    })();

    // 3. Template filter
    const matchesTemplate = !filterTemplate ||
      String(c.resolvedTemplateId) === filterTemplate ||
      (c.templateName && c.templateName.toLowerCase() === filterTemplate.toLowerCase());

    // 4. Date range filter (filterStartDate and filterEndDate are 'YYYY-MM-DD')
    let matchesDate = true;
    if (filterStartDate || filterEndDate) {
      const chDate = new Date(c.createdAt).toLocaleDateString('en-CA'); // 'YYYY-MM-DD' format
      if (filterStartDate && chDate < filterStartDate) {
        matchesDate = false;
      }
      if (filterEndDate && chDate > filterEndDate) {
        matchesDate = false;
      }
    }

    // 5. Warnings filter
    const matchesWarnings = !filterWarningsOnly || getCardholderWarnings(c).length > 0;

    return matchesSearch && matchesSearchId && matchesTemplate && matchesDate && matchesWarnings;
  });

  const handleExportExcel = async (targetList?: Cardholder[], tableTitle?: string) => {
    try {
      const exportList = targetList && targetList.length > 0
        ? targetList
        : (selectedIds.length > 0
            ? cardholders.filter((c: any) => selectedIds.includes(c.id))
            : filteredCardholders);

      if (exportList.length === 0) {
        toast('No cardholders to export.', 'warning');
        return;
      }

      // Deduct 20 credits for Excel export (per user requirement)
      const deductRes = await fetch('/api/press/deduct-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: 20,
          reason: 'Excel Export'
        })
      });

      if (!deductRes.ok) {
        const deductData = await deductRes.json();
        toast(deductData.error || 'Failed to deduct credits for Excel export.', 'error');
        return;
      }

      window.dispatchEvent(new CustomEvent('refresh-profile'));

      const escapeFormula = (val: any): any => {
        if (typeof val === 'string' && /^[=\+\-\@\t\r\n]/.test(val)) {
          return `'${val}`;
        }
        return val;
      };

      // Format data for Excel
      const formattedData = exportList.map((ch: any) => {
        const row: any = {
          'Name': escapeFormula(ch.name),
          'Date of Adding': ch.createdAt ? new Date(ch.createdAt).toLocaleDateString() : '',
          'Template Name': escapeFormula(ch.templateName || ''),
          'Photo URL': escapeFormula(ch.photoUrl || ''),
        };

        // Flatten custom fields
        if (ch.customFields) {
          try {
            const parsed = typeof ch.customFields === 'string' ? JSON.parse(ch.customFields) : ch.customFields;
            if (parsed && typeof parsed === 'object') {
              Object.entries(parsed).forEach(([key, val]) => {
                row[`Field: ${key}`] = escapeFormula(val);
              });
            }
          } catch (e) {
            console.error('Failed to parse custom fields for excel export', e);
          }
        }
        return row;
      });

      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      const sheetName = (tableTitle || 'Cardholders').substring(0, 30);
      const sheet = workbook.addWorksheet(sheetName);

      // Define columns dynamically based on the first object's keys
      const sample = formattedData[0] || {};
      sheet.columns = Object.keys(sample).map(key => ({
        header: key,
        key: key,
        width: 20
      }));

      // Add rows
      formattedData.forEach(row => {
        sheet.addRow(row);
      });

      // Write workbook to a buffer/array
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      const titleClean = (tableTitle || 'Cardholders').replace(/[^a-zA-Z0-9_\-]/g, '_');
      const clientClean = (client?.name || 'export').replace(/[^a-zA-Z0-9_\-]/g, '_');
      const fileName = `${clientClean}_${titleClean}.xlsx`;
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Failed to export Excel:', err);
      toast('Error exporting Excel: ' + err.message, 'error');
    }
  };

  const handleCompileTable = (targetCardholders: Cardholder[], targetTemplate?: any) => {
    if (!targetCardholders || targetCardholders.length === 0) {
      toast('No cardholders to compile.', 'warning');
      return;
    }
    const ids = targetCardholders.map(c => c.id);
    setSelectedIds(ids);

    if (targetTemplate && targetTemplate.id) {
      setQTemplateId(String(targetTemplate.id));
      setQDetectedTemplateName(targetTemplate.name || null);
      setQTemplateMixed(false);
    } else {
      const templateIds = [...new Set(targetCardholders.map((ch: any) => ch.resolvedTemplateId).filter(Boolean))];
      if (templateIds.length === 1) {
        setQTemplateId(String(templateIds[0]));
        const tpl = quickTemplates.find(t => t.id === templateIds[0]);
        setQDetectedTemplateName(tpl?.name || null);
        setQTemplateMixed(false);
      } else if (templateIds.length > 1) {
        setQTemplateId(String(templateIds[0]));
        setQDetectedTemplateName(null);
        setQTemplateMixed(true);
      } else {
        setQDetectedTemplateName(null);
        setQTemplateMixed(false);
        if (quickTemplates.length > 0 && !qTemplateId) {
          setQTemplateId(String(quickTemplates[0].id));
        }
      }
    }

    setQJobResult(null);
    setWizardStep(1);
    setWizardCompileType(null);
    setWizardPaperSize('A3');
    setWizardOrientation('PORTRAIT');
    setWizardEmptySlotStrategy('LEAVE_BLANK');
    setShowCompileModal(true);
  };

  // ── Bulk Operations ───────────────────────────────────────────────────────
  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    showConfirm({
      title: 'Bulk Delete Cardholders',
      message: `Permanently delete ${selectedIds.length} selected cardholder(s)? This cannot be undone.`,
      confirmLabel: `Delete ${selectedIds.length} Records`,
      variant: 'danger',
      onConfirm: async () => {
        try {
          setBulkOperationLoading(true);
          const res = await fetch('/api/cardholders/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: selectedIds, action: 'delete' }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Bulk delete failed');
          toast(`Deleted ${data.affected} cardholder(s) successfully.`, 'success');
          setSelectedIds([]);
          handleRefresh();
        } catch (err: any) {
          toast(err.message || 'Bulk delete failed', 'error');
        } finally {
          setBulkOperationLoading(false);
          closeConfirm();
        }
      },
    });
  };

  const handleBulkStatusToggle = (activate: boolean) => {
    if (selectedIds.length === 0) return;
    const action = activate ? 'activate' : 'deactivate';
    const label = activate ? 'Activate' : 'Deactivate';
    showConfirm({
      title: `Bulk ${label} Cardholders`,
      message: `${label} ${selectedIds.length} selected cardholder(s)?`,
      confirmLabel: `${label} ${selectedIds.length} Records`,
      variant: 'warning',
      onConfirm: async () => {
        try {
          setBulkOperationLoading(true);
          const res = await fetch('/api/cardholders/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: selectedIds, action }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || `Bulk ${action} failed`);
          toast(`${label}d ${data.affected} cardholder(s) successfully.`, 'success');
          setSelectedIds([]);
          handleRefresh();
        } catch (err: any) {
          toast(err.message || `Bulk ${action} failed`, 'error');
        } finally {
          setBulkOperationLoading(false);
          closeConfirm();
        }
      },
    });
  };

  const handleBulkReassign = async () => {
    if (!bulkReassignTemplateId || selectedIds.length === 0) return;
    try {
      setBulkOperationLoading(true);
      const res = await fetch('/api/cardholders/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: selectedIds,
          action: 'reassign_template',
          templateId: Number(bulkReassignTemplateId),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Bulk reassign failed');
      toast(`Reassigned ${data.affected} cardholder(s) to new template.`, 'success');
      setSelectedIds([]);
      setShowBulkReassignModal(false);
      setBulkReassignTemplateId('');
      handleRefresh();
    } catch (err: any) {
      toast(err.message || 'Bulk reassign failed', 'error');
    } finally {
      setBulkOperationLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '100px 0' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Header breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <a href="/dashboard/clients" style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            border: '1px solid var(--glass-border)',
            background: 'rgba(255,255,255,0.02)',
            color: '#fff'
          }}>
            <ArrowLeft size={16} />
          </a>
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--muted)', textTransform: 'uppercase' }}>Client Directory</span>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '2px', fontSize: '1.75rem' }}>
              <Building2 size={24} color="var(--primary)" /> {client?.name}
            </h1>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            className="btn btn-secondary"
            style={{
              fontSize: '0.85rem',
              padding: '8px 14px',
              gap: '6px',
              background: 'rgba(16,185,129,0.1)',
              border: '1px solid rgba(16,185,129,0.3)',
              color: '#34d399',
              cursor: 'pointer'
            }}
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw 
              size={14} 
              style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}
            />
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>

        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--glass-border)',
        gap: '8px',
        marginBottom: '32px'
      }}>
        <button 
          id="btn-list-tab"
          onClick={() => setActiveTab('list')}
          style={{
            padding: '12px 20px',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'list' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'list' ? '#fff' : 'var(--muted)',
            cursor: 'pointer',
            fontWeight: activeTab === 'list' ? '600' : '400',
            fontSize: '0.9rem'
          }}
        >
          Cardholders ({cardholders.length})
        </button>

        <button 
          id="btn-portal-tab"
          onClick={() => setActiveTab('portal')}
          style={{
            padding: '12px 20px',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'portal' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'portal' ? '#fff' : 'var(--muted)',
            cursor: 'pointer',
            fontWeight: activeTab === 'portal' ? '600' : '400',
            fontSize: '0.9rem'
          }}
        >
          <Building2 size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Client Portal Links
        </button>
      </div>

      {activeTab === 'list' && (
        <>
          {/* Automatic Review Warnings Banner */}
          {(() => {
            const problematicCount = cardholders.filter(c => getCardholderWarnings(c).length > 0).length;
            if (problematicCount > 0) {
              return (
                <div 
                  className="glass-panel animate-pulse-subtle" 
                  style={{ 
                    background: 'rgba(245, 158, 11, 0.04)', 
                    border: '1px solid rgba(245, 158, 11, 0.25)', 
                    padding: '16px 20px', 
                    marginBottom: '20px', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    borderRadius: '12px',
                    gap: '16px',
                    flexWrap: 'wrap'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <AlertTriangle size={22} style={{ color: '#fbbf24', flexShrink: 0 }} />
                    <div>
                      <h4 style={{ color: '#fff', fontSize: '0.95rem', margin: '0 0 2px 0', fontWeight: '600' }}>Automatic Review Warnings</h4>
                      <p style={{ color: 'var(--muted)', fontSize: '0.82rem', margin: 0 }}>
                        We detected <strong>{problematicCount}</strong> cardholder record(s) with empty or missing fields required by their assigned card layouts.
                      </p>
                    </div>
                  </div>
                  <button
                    className="btn"
                    onClick={() => setFilterWarningsOnly(!filterWarningsOnly)}
                    style={{
                      fontSize: '0.8rem',
                      padding: '6px 12px',
                      background: filterWarningsOnly ? '#fbbf24' : 'rgba(245, 158, 11, 0.12)',
                      color: filterWarningsOnly ? '#000' : '#fbbf24',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      fontWeight: '600',
                      transition: 'all 0.2s'
                    }}
                  >
                    {filterWarningsOnly ? 'Show All Cardholders' : 'Filter Issues Only'}
                  </button>
                </div>
              );
            }
            return null;
          })()}

          {/* Advanced Filter Panel */}
          <div className="glass-panel" style={{ padding: '20px', marginBottom: '24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '6px', opacity: 0.8 }}>Search Name / Designation</label>
                <div style={{ position: 'relative' }}>
                  <Search size={14} color="var(--muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    className="form-input"
                    style={{ paddingLeft: '32px' }}
                    placeholder="Name or role..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
              </div>
              
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '6px', opacity: 0.8 }}>Search ID (Includes)</label>
                <div style={{ position: 'relative' }}>
                  <Search size={14} color="var(--muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    className="form-input"
                    style={{ paddingLeft: '32px' }}
                    placeholder="Cardholder ID includes..."
                    value={searchId}
                    onChange={e => setSearchId(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '6px', opacity: 0.8 }}>Filter by Template</label>
                <select
                  className="form-input"
                  value={filterTemplate}
                  onChange={e => setFilterTemplate(e.target.value)}
                >
                  <option value="">All Templates</option>
                  {quickTemplates.map((t: any) => (
                    <option key={t.id} value={String(t.id)}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '6px', opacity: 0.8 }}>Filter by Date Range</label>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <input
                    type="date"
                    className="form-input"
                    value={filterStartDate}
                    onChange={e => setFilterStartDate(e.target.value)}
                    onClick={(e) => {
                      try { (e.target as any).showPicker(); } catch (err) {}
                    }}
                    style={{ flex: 1, minWidth: '0' }}
                  />
                  <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>to</span>
                  <input
                    type="date"
                    className="form-input"
                    value={filterEndDate}
                    onChange={e => setFilterEndDate(e.target.value)}
                    onClick={(e) => {
                      try { (e.target as any).showPicker(); } catch (err) {}
                    }}
                    style={{ flex: 1, minWidth: '0' }}
                  />
                  {(filterStartDate || filterEndDate) && (
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '0 8px', height: '36px', fontSize: '0.75rem' }}
                      onClick={() => {
                        setFilterStartDate('');
                        setFilterEndDate('');
                      }}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Batch Actions and Counters */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--glass-border)', paddingTop: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                Showing <strong>{filteredCardholders.length}</strong> of <strong>{cardholders.length}</strong> cardholders
                {selectedIds.length > 0 && <> (<strong>{selectedIds.length}</strong> selected)</>}
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                {selectedIds.length > 0 ? (
                  <>
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: '0.85rem', padding: '8px 14px' }}
                      onClick={() => setSelectedIds([])}
                    >
                      Deselect All
                    </button>
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: '0.85rem', padding: '8px 14px', gap: '6px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8' }}
                      onClick={() => setShowBulkReassignModal(true)}
                      title="Reassign selected cardholders to a different template"
                    >
                      <Shuffle size={14} /> Reassign Template ({selectedIds.length})
                    </button>
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: '0.85rem', padding: '8px 14px', gap: '6px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399' }}
                      onClick={() => handleBulkStatusToggle(true)}
                      title="Activate selected cardholders"
                    >
                      <UserCheck size={14} /> Activate ({selectedIds.length})
                    </button>
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: '0.85rem', padding: '8px 14px', gap: '6px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: '#fbbf24' }}
                      onClick={() => handleBulkStatusToggle(false)}
                      title="Deactivate selected cardholders"
                    >
                      <UserX size={14} /> Deactivate ({selectedIds.length})
                    </button>
                    <button
                      className="btn btn-danger"
                      style={{ fontSize: '0.85rem', padding: '8px 14px', gap: '6px' }}
                      onClick={handleBulkDelete}
                      disabled={bulkOperationLoading}
                    >
                      <Trash2 size={14} /> Delete ({selectedIds.length})
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          {filteredCardholders.length === 0 ? (
            <div className="glass-panel" style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--muted)' }}>
              No cardholders match the criteria. Import or add some above!
            </div>
          ) : (
            <div>
              {(() => {
                const rawTemplates = clientTemplates.length > 0 ? clientTemplates : [{ id: 0, name: 'Default Template', frontFields: '[]', backFields: '[]' }];
                
                const normalizeTemplateName = (name: string) => {
                  if (!name) return 'default template';
                  return name
                    .trim()
                    .toLowerCase()
                    .replace(/\s+/g, ' ')
                    .replace(/\s*\(v\d+(\.\d+)?\)$/i, '')
                    .replace(/\s*v\d+(\.\d+)?$/i, '');
                };

                // Group templates by normalized name to consolidate template updates/versions into a single table
                const templateGroupsMap = new Map<string, {
                  latestTemplate: any;
                  allTemplateIds: Set<string | number>;
                }>();

                rawTemplates.forEach(tmpl => {
                  const normName = normalizeTemplateName(tmpl.name);
                  if (!templateGroupsMap.has(normName)) {
                    templateGroupsMap.set(normName, {
                      latestTemplate: tmpl,
                      allTemplateIds: new Set([tmpl.id]),
                    });
                  } else {
                    const existing = templateGroupsMap.get(normName)!;
                    existing.allTemplateIds.add(tmpl.id);

                    const curVer = Number(tmpl.version) || 0;
                    const exVer = Number(existing.latestTemplate.version) || 0;
                    const curTime = tmpl.updatedAt ? new Date(tmpl.updatedAt).getTime() : (tmpl.createdAt ? new Date(tmpl.createdAt).getTime() : 0);
                    const exTime = existing.latestTemplate.updatedAt ? new Date(existing.latestTemplate.updatedAt).getTime() : (existing.latestTemplate.createdAt ? new Date(existing.latestTemplate.createdAt).getTime() : 0);
                    const curId = Number(tmpl.id) || 0;
                    const exId = Number(existing.latestTemplate.id) || 0;

                    let isNewer = false;
                    if (curVer !== exVer) {
                      isNewer = curVer > exVer;
                    } else if (curTime !== exTime) {
                      isNewer = curTime > exTime;
                    } else {
                      isNewer = curId > exId;
                    }

                    if (isNewer) {
                      existing.latestTemplate = tmpl;
                    }
                  }
                });

                const templateGroups = Array.from(templateGroupsMap.values());
                const processedCardholderIds = new Set<number>();

                const templateTables = templateGroups.map(group => {
                  const tmpl = group.latestTemplate;
                  const tmplCardholders = filteredCardholders.filter(c => {
                    // Prevent any cardholder from being processed into multiple tables
                    if (processedCardholderIds.has(c.id)) {
                      return false;
                    }

                    const isIdMatch = c.resolvedTemplateId != null && (
                      group.allTemplateIds.has(c.resolvedTemplateId) || 
                      group.allTemplateIds.has(Number(c.resolvedTemplateId)) || 
                      group.allTemplateIds.has(String(c.resolvedTemplateId))
                    );
                    const isNameMatch = c.templateName && tmpl.name && (
                      normalizeTemplateName(c.templateName) === normalizeTemplateName(tmpl.name)
                    );
                    const isFallbackMatch = (!c.resolvedTemplateId || c.resolvedTemplateId === 0) && (!c.templateName || c.templateName === '—') && templateGroups.length === 1;

                    const match = Boolean(isIdMatch || isNameMatch || isFallbackMatch);
                    if (match) {
                      processedCardholderIds.add(c.id);
                    }
                    return match;
                  });

                  if (filterTemplate) {
                    const filterLower = filterTemplate.trim().toLowerCase();
                    const matchId = Array.from(group.allTemplateIds).some(id => String(id).toLowerCase() === filterLower);
                    const matchName = normalizeTemplateName(tmpl.name) === normalizeTemplateName(filterTemplate);
                    if (!matchId && !matchName) {
                      return null;
                    }
                  }

                  if (tmplCardholders.length === 0) {
                    return null;
                  }

                  const cols = getTemplateColumns(tmpl);
                  const hasNameCol = cols.some(c => c.key === 'name' || c.key === 'fullName' || c.key.toLowerCase().includes('name'));

                  const selectedInTmpl = tmplCardholders.filter(c => selectedIds.includes(c.id));
                  const hasTmplSelection = selectedInTmpl.length > 0;
                  const targetTmplList = hasTmplSelection ? selectedInTmpl : tmplCardholders;

                  return (
                    <div key={tmpl.id || tmpl.name} style={{ marginBottom: '32px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', padding: '0 4px', flexWrap: 'wrap', gap: '8px' }}>
                        <h3 style={{ fontSize: '1.05rem', color: 'var(--primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <CreditCard size={18} />
                          {tmpl.name} <span style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 'normal' }}>({tmplCardholders.length} cardholders{hasTmplSelection ? `, ${selectedInTmpl.length} selected` : ''})</span>
                        </h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            type="button"
                            className="btn btn-primary"
                            style={{ fontSize: '0.8rem', padding: '5px 12px', gap: '6px' }}
                            onClick={() => handleCompileTable(targetTmplList, tmpl)}
                            title={hasTmplSelection ? `Compile PDF for ${selectedInTmpl.length} selected cardholders in ${tmpl.name}` : `Compile PDF for all ${tmplCardholders.length} cardholders in ${tmpl.name}`}
                          >
                            <Zap size={14} />
                            {hasTmplSelection ? `Compile PDF (${selectedInTmpl.length})` : `Compile All PDF (${tmplCardholders.length})`}
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{
                              fontSize: '0.8rem',
                              padding: '5px 12px',
                              gap: '6px',
                              background: 'rgba(16,185,129,0.1)',
                              border: '1px solid rgba(16,185,129,0.3)',
                              color: '#34d399'
                            }}
                            onClick={() => handleExportExcel(targetTmplList, tmpl.name)}
                            title={hasTmplSelection ? `Export Excel for ${selectedInTmpl.length} selected cardholders in ${tmpl.name}` : `Export Excel spreadsheet for ${tmpl.name}`}
                          >
                            <FileSpreadsheet size={14} />
                            {hasTmplSelection ? `Export Excel (${selectedInTmpl.length})` : 'Export Excel'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{
                              fontSize: '0.8rem',
                              padding: '5px 12px',
                              gap: '6px',
                              background: 'rgba(59,130,246,0.1)',
                              border: '1px solid rgba(59,130,246,0.3)',
                              color: '#60a5fa'
                            }}
                            onClick={() => handleDownloadAllDataZip(targetTmplList, tmpl.name)}
                            disabled={zipping}
                            title="Download ZIP package of photos and Excel metadata for this template"
                          >
                            <Download size={14} />
                            {zipping ? (zipProgress || 'Zipping...') : 'Download Data ZIP'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{
                              fontSize: '0.8rem',
                              padding: '5px 12px',
                              gap: '6px',
                              background: 'rgba(239,68,68,0.1)',
                              border: '1px solid rgba(239,68,68,0.3)',
                              color: '#ef4444'
                            }}
                            onClick={handlePurgeClient}
                            title="Purge all client data and files permanently"
                          >
                            <Trash2 size={14} />
                            Purge Client Data
                          </button>
                        </div>
                      </div>

                      <div className="table-container">
                          <table className="custom-table">
                            <thead>
                              <tr>
                                <th style={{ width: '40px', padding: '14px 12px' }}>
                                  <input
                                    type="checkbox"
                                    checked={tmplCardholders.length > 0 && tmplCardholders.every(c => selectedIds.includes(c.id))}
                                    onChange={() => {
                                      const tmplIds = tmplCardholders.map(c => c.id);
                                      const allSelected = tmplIds.every(id => selectedIds.includes(id));
                                      if (allSelected) {
                                        setSelectedIds(prev => prev.filter(id => !tmplIds.includes(id)));
                                      } else {
                                        setSelectedIds(prev => Array.from(new Set([...prev, ...tmplIds])));
                                      }
                                    }}
                                    style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                                  />
                                </th>
                                {cols.map(col => (
                                  <th key={col.key}>{col.label}</th>
                                ))}
                                {cols.length === 0 && <th>Name</th>}
                                <th>Date Added</th>
                                <th>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {tmplCardholders.map(ch => {
                                const effectivePhoto = getEffectivePhotoUrl(ch);

                                return (
                                  <tr
                                    key={ch.id}
                                    style={{ background: selectedIds.includes(ch.id) ? 'rgba(79,70,229,0.07)' : undefined }}
                                  >
                                    <td style={{ padding: '16px 12px' }}>
                                      <input
                                        type="checkbox"
                                        checked={selectedIds.includes(ch.id)}
                                        onChange={() => setSelectedIds(prev =>
                                          prev.includes(ch.id) ? prev.filter(x => x !== ch.id) : [...prev, ch.id]
                                        )}
                                        style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                                      />
                                    </td>

                                    {cols.map((col, idx) => {
                                      const val = getFieldValue(ch, col.key);
                                      const isNameCol = col.key === 'name' || col.key === 'fullName' || col.key.toLowerCase().includes('name') || (!hasNameCol && idx === 0);
                                      const isImgCol = col.type === 'image' || 
                                        ['photo', 'avatar', 'photourl', 'image', 'picture'].includes(col.key.toLowerCase().replace(/[^a-z0-9]/g, '')) ||
                                        col.key.toLowerCase().includes('photo') ||
                                        col.key.toLowerCase().includes('picture') ||
                                        col.key.toLowerCase().includes('avatar');

                                      if (isImgCol) {
                                        const imgUrl = val || effectivePhoto;
                                        return (
                                          <td key={col.key}>
                                            {imgUrl ? (
                                              <img 
                                                src={imgUrl} 
                                                alt={col.label} 
                                                style={{ width: '40px', height: '40px', borderRadius: '6px', objectFit: 'cover', border: '1px solid var(--glass-border)' }} 
                                              />
                                            ) : (
                                              <div style={{
                                                width: '40px',
                                                height: '40px',
                                                borderRadius: '6px',
                                                background: 'rgba(255,255,255,0.05)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: 'var(--muted)',
                                                fontSize: '0.75rem'
                                              }}>
                                                None
                                              </div>
                                            )}
                                          </td>
                                        );
                                      }

                                      return (
                                        <td key={col.key} style={{ fontWeight: isNameCol ? '500' : 'normal' }}>
                                          {isNameCol ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                              {val || ch.name}
                                              {(() => {
                                                const warnings = getCardholderWarnings(ch);
                                                if (warnings.length > 0) {
                                                  return (
                                                    <span 
                                                      title={warnings.join('\n')}
                                                      style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        background: 'rgba(245,158,11,0.15)',
                                                        color: '#fbbf24',
                                                        padding: '2px 6px',
                                                        borderRadius: '4px',
                                                        fontSize: '0.7rem',
                                                        fontWeight: 'normal',
                                                        border: '1px solid rgba(245,158,11,0.3)',
                                                        cursor: 'help'
                                                      }}
                                                    >
                                                      <AlertTriangle size={12} />
                                                      {warnings.length} Issue{warnings.length > 1 ? 's' : ''}
                                                    </span>
                                                  );
                                                }
                                                return null;
                                              })()}
                                            </div>
                                          ) : (
                                            val || <span style={{ color: 'var(--muted)' }}>—</span>
                                          )}
                                        </td>
                                      );
                                    })}

                                    {cols.length === 0 && (
                                      <td style={{ fontWeight: '500' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                          {ch.name}
                                          {(() => {
                                            const warnings = getCardholderWarnings(ch);
                                            if (warnings.length > 0) {
                                              return (
                                                <span 
                                                  title={warnings.join('\n')}
                                                  style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    background: 'rgba(245,158,11,0.15)',
                                                    color: '#fbbf24',
                                                    padding: '2px 6px',
                                                    borderRadius: '4px',
                                                    fontSize: '0.7rem',
                                                    fontWeight: 'normal',
                                                    border: '1px solid rgba(245,158,11,0.3)',
                                                    cursor: 'help'
                                                  }}
                                                >
                                                  <AlertTriangle size={12} />
                                                  {warnings.length} Issue{warnings.length > 1 ? 's' : ''}
                                                </span>
                                              );
                                            }
                                            return null;
                                          })()}
                                        </div>
                                      </td>
                                    )}

                                    <td>{new Date(ch.createdAt).toLocaleDateString()}</td>

                                    <td>
                                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <button 
                                          className="btn btn-secondary" 
                                          style={{ padding: '6px 10px', fontSize: '0.75rem', borderColor: 'rgba(99, 102, 241, 0.2)' }}
                                          onClick={() => handleCompileIndividual(ch)}
                                        >
                                          Compile PDF
                                        </button>
                                        <button 
                                          className="btn btn-secondary" 
                                          style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                                          onClick={() => handleViewDetails(ch)}
                                        >
                                          View
                                        </button>
                                        <button 
                                          className="btn btn-secondary" 
                                          style={{ padding: '6px 10px', fontSize: '0.75rem', borderColor: 'rgba(99, 102, 241, 0.3)' }}
                                          onClick={() => handleEditDetails(ch)}
                                        >
                                          Edit
                                        </button>
                                        <button 
                                          className="btn btn-danger" 
                                          style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                                          onClick={() => handleDeleteCardholder(ch.id)}
                                        >
                                          <Trash2 size={12} />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                    </div>
                  );
                });

                // Unassigned cardholders check
                const unassigned = filteredCardholders.filter(c => !processedCardholderIds.has(c.id));
                const unassignedSelected = unassigned.filter(c => selectedIds.includes(c.id));
                const hasUnassignedSelection = unassignedSelected.length > 0;
                const targetUnassignedList = hasUnassignedSelection ? unassignedSelected : unassigned;

                const unassignedTable = unassigned.length > 0 ? (
                  <div key="unassigned" style={{ marginBottom: '32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', padding: '0 4px', flexWrap: 'wrap', gap: '8px' }}>
                      <h3 style={{ fontSize: '1.05rem', color: 'var(--primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <CreditCard size={18} />
                        Unassigned Cardholders <span style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 'normal' }}>({unassigned.length} cardholders{hasUnassignedSelection ? `, ${unassignedSelected.length} selected` : ''})</span>
                      </h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{ fontSize: '0.8rem', padding: '5px 12px', gap: '6px' }}
                          onClick={() => handleCompileTable(targetUnassignedList)}
                          title={hasUnassignedSelection ? `Compile PDF for ${unassignedSelected.length} selected unassigned cardholders` : `Compile PDF for all ${unassigned.length} unassigned cardholders`}
                        >
                          <Zap size={14} />
                          {hasUnassignedSelection ? `Compile PDF (${unassignedSelected.length})` : `Compile All PDF (${unassigned.length})`}
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{
                            fontSize: '0.8rem',
                            padding: '5px 12px',
                            gap: '6px',
                            background: 'rgba(16,185,129,0.1)',
                            border: '1px solid rgba(16,185,129,0.3)',
                            color: '#34d399'
                          }}
                          onClick={() => handleExportExcel(targetUnassignedList, 'Unassigned_Cardholders')}
                          title={hasUnassignedSelection ? `Export Excel for ${unassignedSelected.length} selected unassigned cardholders` : 'Export Excel spreadsheet for unassigned cardholders'}
                        >
                          <FileSpreadsheet size={14} />
                          {hasUnassignedSelection ? `Export Excel (${unassignedSelected.length})` : 'Export Excel'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{
                            fontSize: '0.8rem',
                            padding: '5px 12px',
                            gap: '6px',
                            background: 'rgba(59,130,246,0.1)',
                            border: '1px solid rgba(59,130,246,0.3)',
                            color: '#60a5fa'
                          }}
                          onClick={() => handleDownloadAllDataZip(targetUnassignedList, 'Unassigned')}
                          disabled={zipping}
                          title="Download ZIP package of photos and Excel metadata for unassigned cardholders"
                        >
                          <Download size={14} />
                          {zipping ? (zipProgress || 'Zipping...') : 'Download Data ZIP'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{
                            fontSize: '0.8rem',
                            padding: '5px 12px',
                            gap: '6px',
                            background: 'rgba(239,68,68,0.1)',
                            border: '1px solid rgba(239,68,68,0.3)',
                            color: '#ef4444'
                          }}
                          onClick={handlePurgeClient}
                          title="Purge all client data and files permanently"
                        >
                          <Trash2 size={14} />
                          Purge Client Data
                        </button>
                      </div>
                    </div>
                    <div className="table-container">
                      <table className="custom-table">
                        <thead>
                          <tr>
                            <th style={{ width: '40px', padding: '14px 12px' }}>
                              <input
                                type="checkbox"
                                checked={unassigned.every(c => selectedIds.includes(c.id))}
                                onChange={() => {
                                  const ids = unassigned.map(c => c.id);
                                  const allSelected = ids.every(id => selectedIds.includes(id));
                                  if (allSelected) {
                                    setSelectedIds(prev => prev.filter(id => !ids.includes(id)));
                                  } else {
                                    setSelectedIds(prev => Array.from(new Set([...prev, ...ids])));
                                  }
                                }}
                                style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                              />
                            </th>
                            <th>Photo</th>
                            <th>Name</th>
                            <th>Designation</th>
                            <th>Date Added</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {unassigned.map(ch => {
                            const effectivePhoto = getEffectivePhotoUrl(ch);

                            return (
                              <tr key={ch.id} style={{ background: selectedIds.includes(ch.id) ? 'rgba(79,70,229,0.07)' : undefined }}>
                                <td style={{ padding: '16px 12px' }}>
                                  <input
                                    type="checkbox"
                                    checked={selectedIds.includes(ch.id)}
                                    onChange={() => setSelectedIds(prev =>
                                      prev.includes(ch.id) ? prev.filter(x => x !== ch.id) : [...prev, ch.id]
                                    )}
                                    style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                                  />
                                </td>
                                <td>
                                  {effectivePhoto ? (
                                    <img 
                                      src={effectivePhoto} 
                                      alt={ch.name} 
                                      style={{ width: '40px', height: '40px', borderRadius: '6px', objectFit: 'cover', border: '1px solid var(--glass-border)' }} 
                                    />
                                  ) : (
                                    <div style={{
                                      width: '40px', height: '40px', borderRadius: '6px',
                                      background: 'rgba(255,255,255,0.05)', display: 'flex',
                                      alignItems: 'center', justifyContent: 'center',
                                      color: 'var(--muted)', fontSize: '0.75rem'
                                    }}>
                                      None
                                    </div>
                                  )}
                                </td>
                                <td style={{ fontWeight: '500' }}>{ch.name}</td>
                                <td>{ch.designation || '—'}</td>
                                <td>{new Date(ch.createdAt).toLocaleDateString()}</td>
                                <td>
                                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.75rem' }} onClick={() => handleViewDetails(ch)}>View</button>
                                    <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.75rem' }} onClick={() => handleEditDetails(ch)}>Edit</button>
                                    <button className="btn btn-danger" style={{ padding: '6px 10px', fontSize: '0.75rem' }} onClick={() => handleDeleteCardholder(ch.id)}><Trash2 size={12} /></button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null;

                const hasAnyTables = templateTables.some(t => t !== null) || unassignedTable !== null;

                return (
                  <>
                    {hasAnyTables ? (
                      <>
                        {templateTables}
                        {unassignedTable}
                      </>
                    ) : (
                      <div className="glass-panel" style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--muted)' }}>
                        No cardholders match the selected criteria.
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {/* ── Compile Wizard Modal ─────────────────────────── */}
          {showCompileModal && !qJobResult && (
            <CompileWizardModal
              cardCount={selectedIds.length}
              onClose={() => setShowCompileModal(false)}
              compiling={!!qCompiling}
              onCompile={async (cfg) => {
                await handleQuickCompile(cfg.compileType, cfg);
              }}
            />
          )}

          {/* Job progress display after compile started */}
          {showCompileModal && qJobResult && (
            <div onClick={() => { setShowCompileModal(false); setQJobResult(null); }} style={{ position: 'fixed', inset: 0, zIndex: 9900, background: 'rgba(3,4,7,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
              <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '480px' }}>
                {qJobResult.status !== 'COMPLETED' && qJobResult.status !== 'FAILED' ? (
                  <PdfCompileLoadingAnimation
                    progress={qJobResult.progress ?? 15}
                    message={`Compiling ${qJobResult.pdfType === 'PRODUCTION' ? 'Production PDF' : 'Approval Proof'} #${qJobResult.id}`}
                  />
                ) : (
                  <div style={{ background: 'rgba(13,16,27,0.98)', border: '1px solid var(--glass-border)', borderTop: `2px solid ${qJobResult.status === 'COMPLETED' ? '#10b981' : '#ef4444'}`, borderRadius: '16px', padding: '28px 32px', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                      <strong style={{ fontSize: '0.95rem', color: '#fff' }}>
                        {qJobResult.pdfType === 'PRODUCTION' ? 'Production PDF' : 'Approval Proof'} Job #{qJobResult.id}
                      </strong>
                      <span style={{ fontSize: '0.72rem', padding: '3px 10px', borderRadius: '12px', background: qJobResult.status === 'COMPLETED' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: qJobResult.status === 'COMPLETED' ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                        {qJobResult.status}
                      </span>
                    </div>

                    <div style={{ margin: '16px 0', fontSize: '0.82rem', color: 'var(--muted)', textAlign: 'center' }}>
                      {qJobResult.status === 'COMPLETED' && (
                        qJobResult.isLocalJob ? (
                          <div style={{ color: '#34d399', fontWeight: 600, padding: '12px', background: 'rgba(16,185,129,0.08)', borderRadius: '8px', border: '1px solid rgba(16,185,129,0.2)' }}>
                            ✓ PDF compilation completed & saved to Documents folder!
                          </div>
                        ) : (
                          qJobResult.downloadUrl && (
                            <a href={qJobResult.downloadUrl} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                              <Download size={16} /> Download Compiled PDF
                            </a>
                          )
                        )
                      )}
                      {qJobResult.status === 'FAILED' && qJobResult.errorMsg && (
                        <div style={{ color: '#f87171', padding: '12px', background: 'rgba(239,68,68,0.08)', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)' }}>
                          Compilation Error: {qJobResult.errorMsg}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
                      {qJobResult.status === 'FAILED' && <button className="btn btn-secondary" onClick={() => setQJobResult(null)}>Retry</button>}
                      <button className="btn btn-primary" onClick={() => { setShowCompileModal(false); setQJobResult(null); setSelectedIds([]); }}>Close</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'add' && (
        <div className="glass-panel" style={{ maxWidth: '640px' }}>
          <h3 style={{ marginBottom: '20px' }}>Register Single Cardholder</h3>
          {addError && (
            <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f77', borderRadius: '6px', marginBottom: '20px', fontSize: '0.85rem' }}>
              {addError}
            </div>
          )}
          <form onSubmit={handleAddCardholder} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label" style={{ fontWeight: '600', color: 'var(--primary)' }}>
                Assign to Template <span style={{ color: 'var(--muted)', fontWeight: 'normal' }}>(required for correct table grouping)</span>
              </label>
              <select
                className="form-input"
                value={addTemplateId}
                onChange={e => setAddTemplateId(e.target.value)}
                required
              >
                <option value="">— Select a Template —</option>
                {clientTemplates.map((t: any) => (
                  <option key={t.id} value={String(t.id)}>{t.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Full Name</label>
              <input type="text" required className="form-input" placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} />
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Designation / Role</label>
              <input type="text" className="form-input" placeholder="Student / Employee / Staff" value={designation} onChange={e => setDesignation(e.target.value)} />
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label" style={{ fontWeight: '500' }}>Cardholder Photo Image</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input 
                  type="file" 
                  accept="image/*" 
                  className="form-input" 
                  style={{ padding: '6px 12px' }}
                  onChange={handlePhotoUpload} 
                  disabled={uploadingPhoto}
                />
                {uploadingPhoto && <div style={{ fontSize: '0.8rem', color: 'var(--primary)' }}>Uploading to Cloudinary...</div>}
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Or paste photo image URL: https://example.com/..." 
                  value={photoUrl} 
                  onChange={e => setPhotoUrl(e.target.value)} 
                />
              </div>
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Custom Details (JSON format - Optional)</label>
              <textarea 
                className="form-textarea" 
                rows={3} 
                placeholder='{ "grade": "10th", "bloodGroup": "O+", "fatherName": "Skinner" }' 
                value={customFields} 
                onChange={e => setCustomFields(e.target.value)} 
              />
            </div>

            <div style={{ gridColumn: 'span 2', display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setActiveTab('list')}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={addLoading}>
                {addLoading ? 'Saving...' : 'Add Cardholder'}
              </button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'csv' && (
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
                <button type="button" className="btn btn-secondary" onClick={() => { setActiveTab('list'); setImportResult(null); setImportStep('source'); }}>Cancel</button>
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
                <button type="button" className="btn btn-secondary" onClick={() => { setActiveTab('list'); }}>View Cardholders</button>
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
      )}

      {activeTab === 'zip' && (
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
                          <div key={i} style={{ color: 'var(--warning)', marginLeft: '8px' }}>• Warning: {w}</div>
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
              <button type="button" className="btn btn-secondary" onClick={() => { setActiveTab('list'); setZipResult(null); }}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={zipLoading}>
                {zipLoading ? 'Extracting ZIP & Verifying Quality...' : 'Process ZIP Photos'}
              </button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'serials' && (
        <div className="glass-panel" style={{ maxWidth: '640px' }}>
          <h3 style={{ marginBottom: '20px' }}>Sequential Serial Number Allocation</h3>
          <p style={{ marginBottom: '24px', fontSize: '0.85rem' }}>
            Batch assign unique serial numbers to all cardholders who do not have one assigned yet.
          </p>

          {serialError && (
            <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f77', borderRadius: '6px', marginBottom: '20px', fontSize: '0.85rem' }}>
              {serialError}
            </div>
          )}

          {serialResult && (
            <div className="glass-panel" style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', marginBottom: '24px', border: '1px solid var(--success)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--success)', marginBottom: '12px' }}>
                <CheckCircle size={18} />
                <h4 style={{ color: 'var(--success)' }}>Serials Assigned Successfully</h4>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                Assigned <strong style={{ color: '#fff' }}>{serialResult.assignedCount}</strong> new serials. Last sequential number allocated: <strong style={{ color: '#fff' }}>{serialResult.lastAllocated}</strong>.
              </p>
            </div>
          )}

          <form onSubmit={handleAssignSerials} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div className="form-group">
              <label className="form-label">Serial Prefix</label>
              <input type="text" className="form-input" placeholder="e.g. STU, EMP, VOL" value={serialPrefix} onChange={e => setSerialPrefix(e.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label">Sequence Starts At</label>
              <input type="number" min="1" className="form-input" value={serialStart} onChange={e => setSerialStart(e.target.value)} />
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Zero Padding Length</label>
              <select className="form-select" value={serialPad} onChange={e => setSerialPad(e.target.value)}>
                <option value="3">3 digits (e.g. STU-001)</option>
                <option value="4">4 digits (e.g. STU-0001)</option>
                <option value="5">5 digits (e.g. STU-00001)</option>
                <option value="6">6 digits (e.g. STU-000001)</option>
              </select>
            </div>

            <div style={{ gridColumn: 'span 2', display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => { setActiveTab('list'); setSerialResult(null); }}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={serialLoading}>
                {serialLoading ? 'Processing Allocation...' : 'Allocate Serials'}
              </button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'portal' && (
        <PortalSharesPanel clientId={clientId} />
      )}

      {/* ── View Details Modal ─────────────────────────── */}
      {viewingCardholder && (
        <div
          onClick={() => setViewingCardholder(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9000,
            background: 'rgba(3,4,7,0.82)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'rgba(13,16,27,0.98)',
              border: '1px solid var(--glass-border)',
              borderTop: '2px solid var(--primary)',
              borderRadius: '18px',
              width: '100%',
              maxWidth: previewTemplate ? '860px' : '500px',
              maxHeight: '92vh',
              overflowY: 'auto',
              boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
              transition: 'max-width 0.3s ease',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '22px 28px 16px', borderBottom: '1px solid var(--glass-border)' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '600' }}>Cardholder Preview</h3>
                {previewTemplate && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: '500' }}>{previewTemplate.name}</span>
                )}
              </div>
              <button onClick={() => setViewingCardholder(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '4px' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: '0', minHeight: '400px' }}>
              {/* Left: Cardholder Info */}
              <div style={{ flex: '0 0 260px', padding: '22px 24px', borderRight: previewTemplate ? '1px solid var(--glass-border)' : 'none' }}>
                {/* Photo */}
                <div style={{ marginBottom: '18px' }}>
                  {(() => {
                    const photo = getEffectivePhotoUrl(viewingCardholder);
                    return photo ? (
                      <img
                        src={photo}
                        alt={viewingCardholder.name}
                        style={{ width: '80px', height: '80px', borderRadius: '12px', objectFit: 'cover', border: '2px solid var(--glass-border)', display: 'block' }}
                      />
                    ) : (
                      <div style={{
                        width: '80px', height: '80px', borderRadius: '12px',
                        background: 'rgba(255,255,255,0.05)', border: '2px dashed var(--glass-border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--muted)', fontSize: '0.7rem', textAlign: 'center',
                      }}>No Photo</div>
                    );
                  })()}
                </div>

                {/* Core fields */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                  {[
                    { label: 'Name', value: viewingCardholder.name },
                    { label: 'Designation', value: viewingCardholder.designation || '—' },
                    {
                      label: 'ID / Serial', value: (() => {
                        const custom = viewingCardholder.customFields ? (typeof viewingCardholder.customFields === 'string' ? (() => { try { return JSON.parse(viewingCardholder.customFields!); } catch { return {}; } })() : viewingCardholder.customFields) : {};
                        return viewingCardholder.uniqueKey || (custom as any).uniqueKey || (custom as any).id || (custom as any).unique_key || viewingCardholder.cardSerial || '—';
                      })()
                    },
                    { label: 'Template', value: viewingCardholder.templateName || '—' },
                    { label: 'Added On', value: new Date(viewingCardholder.createdAt).toLocaleDateString() },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ fontSize: '0.78rem' }}>
                      <span style={{ color: 'var(--muted)', display: 'block', marginBottom: '2px' }}>{label}</span>
                      <span style={{ color: '#fff', fontWeight: '500', wordBreak: 'break-all' }}>{value}</span>
                    </div>
                  ))}
                </div>

                {/* Custom Fields */}
                {viewingCardholder.customFields && (() => {
                  let parsed: Record<string, any> = {};
                  try { parsed = typeof viewingCardholder.customFields === 'string' ? JSON.parse(viewingCardholder.customFields) : viewingCardholder.customFields as any; } catch {}
                  const entries = Object.entries(parsed).filter(([, v]) => {
                    if (v === null || v === undefined || String(v).trim() === '') return false;
                    const str = String(v).trim();
                    // Skip image URLs / base64
                    return !(str.startsWith('http') && (str.includes('.jpg') || str.includes('.png') || str.includes('.webp') || str.includes('/uploads/'))) && !str.startsWith('data:image/');
                  });
                  if (entries.length === 0) return null;
                  return (
                    <div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px', fontWeight: '600' }}>Template Fields</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                        {entries.map(([key, val]) => (
                          <div key={key} style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', padding: '6px 8px' }}>
                            <span style={{ color: 'var(--primary)', display: 'block', fontSize: '0.68rem', marginBottom: '2px' }}>{key}</span>
                            <span style={{ color: '#fff' }}>{String(val)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Right: Live Card Preview */}
              {previewTemplate && (
                <div style={{ flex: 1, padding: '22px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  {/* Front / Back toggle */}
                  {previewTemplate.backImageUrl && (
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '4px' }}>
                      {(['front', 'back'] as const).map(side => (
                        <button
                          key={side}
                          onClick={() => setPreviewSide(side)}
                          style={{
                            padding: '5px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: '600',
                            background: previewSide === side ? 'var(--primary)' : 'transparent',
                            color: previewSide === side ? '#fff' : 'var(--muted)',
                            transition: 'all 0.15s',
                          }}
                        >
                          {side.charAt(0).toUpperCase() + side.slice(1)}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Canvas */}
                  <CardLivePreview
                    template={previewTemplate}
                    cardholder={viewingCardholder}
                    side={previewSide}
                  />
                </div>
              )}

              {/* No template state */}
              {!previewTemplate && !previewLoading && (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: '0.85rem', padding: '32px' }}>
                  {viewingCardholder.resolvedTemplateId ? 'Could not load template preview.' : 'No template linked to this cardholder.'}
                </div>
              )}

              {previewLoading && (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: '0.85rem', padding: '32px' }}>
                  Loading preview…
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px 28px 22px', borderTop: '1px solid var(--glass-border)' }}>
              <button className="btn btn-secondary" onClick={() => setViewingCardholder(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Details Modal ─────────────────────────── */}
      {editingCardholder && (
        <div
          onClick={() => setEditingCardholder(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9000,
            background: 'rgba(3,4,7,0.75)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'rgba(13,16,27,0.97)',
              border: '1px solid var(--glass-border)',
              borderTop: '2px solid var(--primary)',
              borderRadius: '16px',
              padding: '28px 32px',
              width: '100%', maxWidth: '550px',
              boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '600' }}>Edit Cardholder</h3>
              <button onClick={() => setEditingCardholder(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            {editError && (
              <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f77', borderRadius: '6px', marginBottom: '20px', fontSize: '0.85rem' }}>
                {editError}
              </div>
            )}

            <form onSubmit={handleSaveEditCardholder} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>




              {editHasPhoto && (
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label" style={{ fontWeight: '500' }}>Cardholder Photo Image</label>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    {editPhotoUrl && (
                      <img 
                        src={editPhotoUrl} 
                        alt="Preview" 
                        style={{ width: '50px', height: '50px', borderRadius: '6px', objectFit: 'cover', border: '1px solid var(--glass-border)' }} 
                      />
                    )}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="form-input" 
                        style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                        onChange={handleEditPhotoUpload} 
                        disabled={uploadingEditPhoto}
                      />
                      {uploadingEditPhoto && <div style={{ fontSize: '0.8rem', color: 'var(--primary)' }}>Uploading...</div>}
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="Or paste image URL" 
                        value={editPhotoUrl} 
                        onChange={e => setEditPhotoUrl(e.target.value)} 
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Custom Fields</label>
                {Object.keys(editCustomFieldsMap).length === 0 ? (
                  <p style={{ fontSize: '0.8rem', color: 'var(--muted)', margin: 0 }}>No custom fields found for this cardholder.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {Object.entries(editCustomFieldsMap).map(([key, val]) => {
                      const fieldMeta = editTemplateFields.find(f => f.field === key);
                      // Detect image field: either template says type=image, or the stored value is a URL
                      const isImage = fieldMeta?.type === 'image' || 
                        (!!val && (val.startsWith('http') || val.startsWith('data:')));
                      const label = formatFieldLabel(key);

                      const clean = key.toLowerCase().replace(/[^a-z]/g, '');
                      const isNameLike = clean === 'name' || clean === 'fullname' || clean === 'studentname';

                      return (
                        <div key={key} style={{ display: 'flex', gap: '12px', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '8px' }}>
                          <span style={{
                            fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 500,
                            minWidth: '120px', maxWidth: '160px', padding: '8px 10px',
                            background: 'rgba(56,189,248,0.05)', border: '1px solid var(--glass-border)',
                            borderRadius: '6px', wordBreak: 'break-all',
                          }}>{label}{isNameLike ? ' *' : ''}</span>
                          
                          {isImage ? (
                            <div style={{ flex: 1, display: 'flex', gap: '12px', alignItems: 'center' }}>
                              {val ? (
                                <img 
                                  src={val} 
                                  alt="Preview" 
                                  style={{ width: '45px', height: '45px', borderRadius: '4px', objectFit: 'cover', border: '1px solid var(--glass-border)' }} 
                                />
                              ) : (
                                <div style={{ width: '45px', height: '45px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', color: 'var(--muted)' }}>
                                  No Image
                                </div>
                              )}
                              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <input 
                                  type="file" 
                                  accept="image/*" 
                                  className="form-input" 
                                  style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                                  onChange={e => {
                                    const file = e.target.files?.[0];
                                    if (file) handleCustomImageUpload(key, file);
                                  }}
                                  disabled={!!uploadingCustomImages[key]}
                                />
                                {uploadingCustomImages[key] && <div style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>Uploading...</div>}
                              </div>
                            </div>
                          ) : (
                            <input
                              type="text"
                              required={isNameLike}
                              className="form-input"
                              style={{ flex: 1, fontSize: '0.85rem' }}
                              value={val}
                              onChange={e => {
                                const v = e.target.value;
                                setEditCustomFieldsMap(prev => ({ ...prev, [key]: v }));
                                if (isNameLike) {
                                  setEditName(v);
                                } else if (clean === 'designation' || clean === 'role') {
                                  setEditDesignation(v);
                                }
                              }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div style={{ gridColumn: 'span 2', display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px' }}>
                {/* Inline warning summary based on current form state */}
                {(() => {
                  const inlineWarnings: string[] = [];
                  if (editHasName && (!editName || editName.trim() === '')) inlineWarnings.push('Name is required');
                  if (editHasDesignation && (!editDesignation || editDesignation.trim() === '')) inlineWarnings.push('Designation is missing');

                  // Validate text fields in editCustomFieldsMap
                  Object.entries(editCustomFieldsMap).forEach(([k, v]) => {
                    const meta = editTemplateFields.find(f => f.field === k);
                    if (meta && (meta.type === 'text' || meta.type === 'id')) {
                      const isSystemKey = ['name', 'fullName', 'designation', 'role', 'cardSerial', 'validTill', 'validTillDate'].includes(k);
                      if (!isSystemKey && (!v || String(v).trim() === '')) {
                        const lbl = formatFieldLabel(k);
                        inlineWarnings.push(`${lbl} is missing`);
                      }
                    }
                  });

                  // Validate image fields in editTemplateFields against both editCustomFieldsMap and editPhotoUrl
                  const imageFields = editTemplateFields.filter(f => f.type === 'image');
                  const checkedImg = new Set<string>();
                  imageFields.forEach(f => {
                    if (checkedImg.has(f.field)) return;
                    checkedImg.add(f.field);

                    const customVal = getCustomFieldValueCaseInsensitive(editCustomFieldsMap, f.field);
                    const hasCustomVal = customVal && String(customVal).trim() !== '' && String(customVal) !== 'null' && String(customVal) !== 'undefined';
                    const hasPhotoUrl = editPhotoUrl && editPhotoUrl.trim() !== '' && editPhotoUrl !== 'null' && editPhotoUrl !== 'undefined';

                    if (!hasCustomVal && !hasPhotoUrl) {
                      const lbl = formatFieldLabel(f.field);
                      inlineWarnings.push(`${lbl} is missing`);
                    }
                  });

                  return inlineWarnings.length > 0 ? (
                    <div style={{ flex: 1, padding: '8px 12px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '6px', fontSize: '0.78rem', color: '#fbbf24' }}>
                      <strong>⚠ Still missing:</strong> {inlineWarnings.join(' · ')}
                    </div>
                  ) : null;
                })()}
                <button type="button" className="btn btn-secondary" onClick={() => setEditingCardholder(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={editLoading}>
                  {editLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Bulk Reassign Template Modal */}
      {showBulkReassignModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '24px'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '440px', padding: '28px', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Shuffle size={18} color="var(--primary)" /> Reassign Template
              </h3>
              <button className="btn btn-secondary" style={{ padding: '6px', minWidth: 'auto' }} onClick={() => { setShowBulkReassignModal(false); setBulkReassignTemplateId(''); }}>
                <X size={16} />
              </button>
            </div>
            <p style={{ color: 'var(--muted)', fontSize: '0.88rem', marginBottom: '20px' }}>
              Reassign <strong style={{ color: 'var(--text)' }}>{selectedIds.length} cardholder(s)</strong> to a new template. Their card assets will be marked as stale and regenerated on next use.
            </p>
            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label className="form-label">Select New Template</label>
              <select className="form-input" value={bulkReassignTemplateId} onChange={e => setBulkReassignTemplateId(e.target.value)}>
                <option value="">— Choose a template —</option>
                {quickTemplates.map((t: any) => (
                  <option key={t.id} value={String(t.id)}>{t.name}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setShowBulkReassignModal(false); setBulkReassignTemplateId(''); }}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 1, gap: '6px' }}
                onClick={handleBulkReassign}
                disabled={!bulkReassignTemplateId || bulkOperationLoading}
              >
                {bulkOperationLoading ? <div className="spinner" style={{ width: '16px', height: '16px' }} /> : <Shuffle size={14} />}
                {bulkOperationLoading ? 'Reassigning...' : `Reassign ${selectedIds.length} Records`}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Pre-Print Missing Field Validation Modal ───────────────────── */}
      {showValidationModal && validationResult && (
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
                onClick={() => {
                  setShowValidationModal(false);
                  setShowCompileModal(false);
                  setPendingCompileType(null);
                  setActiveTab('list');
                }}
              >
                Fix Records
              </button>
              <button
                className="btn"
                style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}
                onClick={async () => {
                  setShowValidationModal(false);
                  if (validationResult.totalSlots > validationResult.totalCards && !pendingLayoutConfig) {
                    setShowEmptySlotModal(true);
                  } else {
                    if (pendingCompileType) {
                      await proceedWithQuickCompile(
                        pendingCompileType,
                        true,
                        wizardEmptySlotStrategy || emptySlotStrategy,
                        pendingPaperSize,
                        pendingOrientation,
                        pendingLayoutConfig || undefined,
                        pendingCustomCardId
                      );
                    }
                  }
                }}
              >
                Skip & Print Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Empty Slot Strategy Modal ────────────────────────────────────── */}
      {showEmptySlotModal && validationResult && (
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
                    onChange={() => setEmptySlotStrategy(opt.value)}
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
              <button className="btn btn-secondary" onClick={() => { setShowEmptySlotModal(false); setPendingCompileType(null); }}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={async () => {
                setShowEmptySlotModal(false);
                if (pendingCompileType) {
                  await proceedWithQuickCompile(
                    pendingCompileType,
                    true,
                    emptySlotStrategy,
                    pendingPaperSize,
                    pendingOrientation,
                    pendingLayoutConfig || undefined,
                    pendingCustomCardId
                  );
                }
              }}>
                Confirm & Queue Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── PORTAL SHARES PANEL ──────────────────────────────────────
function PortalSharesPanel({ clientId }: { clientId: number }) {
  const { toast } = useToast();
  const [shares, setShares] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [creating, setCreating] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [hasClientAssignments, setHasClientAssignments] = useState(false);

  // Confirm dialog state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string; message: string; confirmLabel: string; variant: 'danger' | 'warning'; onConfirm: () => void;
  } | null>(null);
  const showConfirm = (cfg: typeof confirmConfig) => { setConfirmConfig(cfg); setConfirmOpen(true); };
  const closeConfirm = () => { setConfirmOpen(false); setConfirmConfig(null); };

  // Batch Management state
  const [selectedShareForBatch, setSelectedShareForBatch] = useState<any | null>(null);
  const [batchCardholders, setBatchCardholders] = useState<any[]>([]);
  const [selectedCardholderIds, setSelectedCardholderIds] = useState<number[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);

  // Batch Order form state
  const [batchPricePerCard, setBatchPricePerCard] = useState('50');
  const [batchValidTill, setBatchValidTill] = useState('');

  // Batch layout/PDF options state
  const [batchBleed, setBatchBleed] = useState(0);
  const [batchCropMarks, setBatchCropMarks] = useState(true);
  const [batchFoldLine, setBatchFoldLine] = useState(true);
  const [batchMarginLeft, setBatchMarginLeft] = useState(40);
  const [batchMarginTop, setBatchMarginTop] = useState(40);
  const [batchMarginRight, setBatchMarginRight] = useState(40);
  const [batchMarginBottom, setBatchMarginBottom] = useState(40);
  const [batchColGap, setBatchColGap] = useState(15);
  const [batchRowGap, setBatchRowGap] = useState(15);

  // Compilation progress state
  const [batchPdfLoading, setBatchPdfLoading] = useState<string | null>(null);
  const [batchJob, setBatchJob] = useState<any | null>(null);
  const [previewJob, setPreviewJob] = useState<any | null>(null);

  const fetchShares = async () => {
    try {
      const res = await fetch(`/api/clients/${clientId}/shares?_t=${Date.now()}`);
      const data = await res.json();
      if (data.success) {
        setShares(data.shares);
        setHasClientAssignments(data.hasClientAssignments || false);
        const sorted = [...data.templates].sort((a, b) => {
          const aIsPdf = a.frontImageUrl?.toLowerCase().endsWith('.pdf') ? 1 : 0;
          const bIsPdf = b.frontImageUrl?.toLowerCase().endsWith('.pdf') ? 1 : 0;
          return bIsPdf - aIsPdf;
        });
        setTemplates(sorted);
        if (sorted.length > 0) {
          setSelectedTemplateId(String(sorted[0].id));
        }
      }
    } catch (e) {
      console.error('Error fetching portal shares:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShares();
  }, [clientId]);

  // Load config on share selection
  useEffect(() => {
    if (!selectedShareForBatch) return;
    const key = `layout-config-${clientId}-${selectedShareForBatch.templateId}`;
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.bleed !== undefined) setBatchBleed(parsed.bleed);
        if (parsed.cropMarks !== undefined) setBatchCropMarks(parsed.cropMarks);
        if (parsed.foldLine !== undefined) setBatchFoldLine(parsed.foldLine);
        if (parsed.marginLeft !== undefined) setBatchMarginLeft(parsed.marginLeft);
        if (parsed.marginTop !== undefined) setBatchMarginTop(parsed.marginTop);
        if (parsed.marginRight !== undefined) setBatchMarginRight(parsed.marginRight);
        if (parsed.marginBottom !== undefined) setBatchMarginBottom(parsed.marginBottom);
        if (parsed.colGap !== undefined) setBatchColGap(parsed.colGap);
        if (parsed.rowGap !== undefined) setBatchRowGap(parsed.rowGap);
      } else {
        setBatchBleed(0);
        setBatchCropMarks(true);
        setBatchFoldLine(true);
        setBatchMarginLeft(40);
        setBatchMarginTop(40);
        setBatchMarginRight(40);
        setBatchMarginBottom(40);
        setBatchColGap(15);
        setBatchRowGap(15);
      }
    } catch (e) {
      console.error('Error loading config:', e);
    }
  }, [selectedShareForBatch, clientId]);

  const handleUpdateConfig = (field: string, value: any) => {
    if (!selectedShareForBatch) return;
    const key = `layout-config-${clientId}-${selectedShareForBatch.templateId}`;
    let current: any = {};
    try {
      const saved = localStorage.getItem(key);
      if (saved) current = JSON.parse(saved);
    } catch (e) {}

    current[field] = value;
    try {
      localStorage.setItem(key, JSON.stringify(current));
    } catch (e) {}

    if (field === 'bleed') setBatchBleed(value);
    if (field === 'cropMarks') setBatchCropMarks(value);
    if (field === 'foldLine') setBatchFoldLine(value);
    if (field === 'marginLeft') setBatchMarginLeft(value);
    if (field === 'marginTop') setBatchMarginTop(value);
    if (field === 'marginRight') setBatchMarginRight(value);
    if (field === 'marginBottom') setBatchMarginBottom(value);
    if (field === 'colGap') setBatchColGap(value);
    if (field === 'rowGap') setBatchRowGap(value);
  };

  // Poll for active batch compile job
  useEffect(() => {
    if (!batchJob || batchJob.status === 'COMPLETED' || batchJob.status === 'FAILED') return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${batchJob.id}`);
        const data = await res.json();
        if (data.success && data.job) {
          setBatchJob(data.job);
          if (data.job.status === 'COMPLETED') {
            fetchShares();
          }
        }
      } catch (e) {
        console.error('Error polling batch job:', e);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [batchJob]);

  // Keep selectedShareForBatch in sync with shares
  useEffect(() => {
    if (!selectedShareForBatch) return;
    const updated = shares.find(s => s.id === selectedShareForBatch.id);
    if (updated) {
      setSelectedShareForBatch(updated);
    }
  }, [shares]);

  const handleCreateShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplateId) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/shares`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: selectedTemplateId }),
      });
      const data = await res.json();
      if (data.success) {
        fetchShares();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCreating(false);
    }
  };

  const handleDeactivate = (orgToken: string) => {
    showConfirm({
      title: 'Deactivate Portal Link',
      message: 'This will deactivate the portal link. Cardholders enrolled through it will remain, but the link will stop working for new enrollments.',
      confirmLabel: 'Deactivate',
      variant: 'warning',
      onConfirm: async () => {
        closeConfirm();
        try {
          const res = await fetch(`/api/portal/shares/${orgToken}`, { method: 'DELETE' });
          const data = await res.json();
          if (data.success) fetchShares();
        } catch (e) { console.error(e); }
      },
    });
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedToken(id);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const handleOpenBatchManager = async (share: any) => {
    setSelectedShareForBatch(share);
    setBatchLoading(true);
    setBatchJob(null);
    try {
      const res = await fetch(`/api/portal/shares/${share.orgToken}/cardholders`);
      const data = await res.json();
      if (data.success) {
        setBatchCardholders(data.cardholders || []);
        setSelectedCardholderIds((data.cardholders || []).map((c: any) => c.id));
      }
    } catch (e) {
      console.error('Error fetching batch cardholders:', e);
    } finally {
      setBatchLoading(false);
    }
  };

  const toggleCardholderSelection = (id: number) => {
    setSelectedCardholderIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedCardholderIds.length === batchCardholders.length) {
      setSelectedCardholderIds([]);
    } else {
      setSelectedCardholderIds(batchCardholders.map(c => c.id));
    }
  };

  const handleBatchCompile = async (type: 'APPROVAL' | 'PRODUCTION') => {
    if (selectedCardholderIds.length === 0) {
      toast('Please select at least one cardholder to compile.', 'warning');
      return;
    }
    setBatchPdfLoading(type);
    setBatchJob(null);
    try {
      // 1. Create client order from selected batch cards
      const orderRes = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: Number(clientId),
          templateId: Number(selectedShareForBatch.templateId),
          cardholderIds: selectedCardholderIds,
          pricePerCard: Number(batchPricePerCard) || 0,
          validTill: batchValidTill ? new Date(batchValidTill) : null,
          status: type === 'PRODUCTION' ? 'APPROVED' : 'DRAFT', // Production PDF demands APPROVED status
        }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.error || 'Failed to create order for batch');

      const createdOrderId = orderData.order.id;

      const isProduction = type === 'PRODUCTION';
      const endpoint = '/api/jobs/production-request';

      // 2. Queue background compilation PDF Job
      const jobRes = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: createdOrderId,
          pdfType: type,
          paperSize: type === 'PRODUCTION' ? 'A3' : 'A4',
          orientation: 'PORTRAIT',
          bleed: batchBleed,
          cropMarks: batchCropMarks,
          foldLine: batchFoldLine,
          marginLeft: batchMarginLeft,
          marginTop: batchMarginTop,
          marginRight: batchMarginRight,
          marginBottom: batchMarginBottom,
          colGap: batchColGap,
          rowGap: batchRowGap,
        }),
      });
      const jobData = await jobRes.json();
      if (!jobRes.ok) throw new Error(jobData.error || 'Failed to queue PDF job');

      const jobId = jobData.jobId;
      const initialStatus = 'PENDING';

      setBatchJob({
        id: jobId,
        status: initialStatus,
        progress: 0,
        isLocalJob: true,
      });

      window.dispatchEvent(new Event('refresh-profile'));

      if (isProduction) {
        toast(`Production print job #${jobId} queued successfully!`, 'success');
      } else {
        toast(`Approval draft job #${jobId} queued successfully!`, 'success');
      }
    } catch (e: any) {
      toast(e.message || 'Error occurred during batch compilation', 'error');
    } finally {
      setBatchPdfLoading(null);
    }
  };

  if (loading) {
    return <div style={{ color: 'var(--muted)' }}>Loading portal shares...</div>;
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '32px' }}>
      
      {/* Creation form */}
      <div className="glass-panel" style={{ maxWidth: '640px' }}>
        <h3 style={{ marginBottom: '16px' }}>Generate Client Portal Share</h3>
        <p style={{ marginBottom: '24px', fontSize: '0.85rem', color: 'var(--muted)' }}>
          Create secure, shareable links mapping a specific ID card template to this organization. The client organization can log in to manage their members, and share the enrollment form with their members to collect profiles and photos.
        </p>

        {templates.length === 0 ? (
          <div style={{ padding: '16px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={16} color="#f59e0b" />
            <div style={{ fontSize: '0.875rem' }}>
              <strong style={{ color: '#f59e0b' }}>No templates available for this client.</strong>
              <span style={{ color: 'var(--muted)', marginLeft: '6px' }}>
                {hasClientAssignments
                  ? 'The assigned templates may have been removed. Please check template assignments in the Templates tab.'
                  : 'Design or upload a template, then assign it to this client from the Templates dashboard.'}
              </span>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {hasClientAssignments && (
              <div style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <CheckCircle size={12} color="var(--success)" />
                Showing {templates.length} template{templates.length !== 1 ? 's' : ''} assigned to this client
              </div>
            )}
            <form onSubmit={handleCreateShare} style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ flex: 1, margin: 0 }}>
                <label className="form-label">Select Template</label>
                <select 
                  className="form-select" 
                  value={selectedTemplateId} 
                  onChange={e => setSelectedTemplateId(e.target.value)}
                >
                  {templates.map(t => {
                    const isPdf = t.frontImageUrl?.toLowerCase().endsWith('.pdf');
                    return (
                      <option key={t.id} value={t.id}>
                        {t.name} {isPdf ? '📄 [PDF Format]' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
              <button id="btn-generate-links" type="submit" className="btn btn-primary" disabled={creating} style={{ height: '42px' }}>
                {creating ? 'Generating...' : 'Generate Links'}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Active Shares List */}
      <div>
        <h3 style={{ marginBottom: '16px' }}>Active Share Links</h3>
        {shares.length === 0 ? (
          <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)' }}>
            No portal links generated yet. Use the form above to generate links.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {shares.map(share => {
              const matchedTemplate = templates.find(t => t.id === share.templateId);
              const enrollUrl = `${window.location.origin}/portal/enroll/${share.enrollToken}`;
              const orgUrl = `${window.location.origin}/portal/org/${share.orgToken}`;
              const isSelected = selectedShareForBatch?.id === share.id;

              return (
                <div key={share.id} className="glass-panel" style={{ 
                   padding: '20px', 
                   border: share.active ? (isSelected ? '2px solid var(--primary)' : '1px solid var(--glass-border)') : '1px solid rgba(239, 68, 68, 0.2)',
                   opacity: share.active ? 1 : 0.6,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div>
                      <strong style={{ fontSize: '1rem', color: '#fff' }}>
                        Template: {matchedTemplate?.name || `ID #${share.templateId}`}
                      </strong>
                      <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '4px' }}>
                        Created on {new Date(share.createdAt).toLocaleDateString()} · <strong>Enrolled: {share.enrolledCount ?? 0} members</strong>
                      </div>

                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      {share.active && (
                        <button
                          type="button"
                          className={`btn ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                          onClick={() => isSelected ? setSelectedShareForBatch(null) : handleOpenBatchManager(share)}
                        >
                          {isSelected ? 'Close Batch Manager' : 'Manage Batch & Compile'}
                        </button>
                      )}
                      {share.active ? (
                        <button 
                          type="button"
                          className="btn btn-danger" 
                          style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                          onClick={() => handleDeactivate(share.orgToken)}
                        >
                          Deactivate Links
                        </button>
                      ) : (
                        <span className="badge badge-warning">Deactivated</span>
                      )}
                    </div>
                  </div>

                  {share.active && !isSelected && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      
                      <div style={{ background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.15)', padding: '12px 16px', borderRadius: '6px', fontSize: '0.8rem', color: 'var(--muted)' }}>
                        <strong>Multi-department Workflow:</strong> Copy the Organization Head portal link below and send it to the client's organization head. From that portal, they can create separate department heads and staff data collection links for their respective departments.
                      </div>

                      {/* Organization Management Link */}
                      <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#10b981' }}>
                            Organization Head Portal Link (For Client Managers)
                          </span>
                          <button 
                            type="button"
                            className="btn btn-secondary" 
                            style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                            onClick={() => copyToClipboard(orgUrl, `org-${share.id}`)}
                          >
                            {copiedToken === `org-${share.id}` ? <CheckCircle size={12} style={{ color: 'var(--success)' }} /> : <Copy size={12} />}
                            Copy
                          </button>
                        </div>
                        <code style={{ fontSize: '0.8rem', color: 'var(--muted)', wordBreak: 'break-all' }}>{orgUrl}</code>
                      </div>

                    </div>
                  )}

                  {/* Batch Manager Section */}
                  {isSelected && (
                    <div style={{ 
                      marginTop: '20px', 
                      paddingTop: '20px', 
                      borderTop: '1px dashed var(--glass-border)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '20px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--primary)' }}>Batch Cardholders Manager</h4>
                        <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                          Selected: {selectedCardholderIds.length} of {batchCardholders.length}
                        </span>
                      </div>

                      {batchLoading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
                          <div className="spinner"></div>
                        </div>
                      ) : batchCardholders.length === 0 ? (
                        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--muted)', fontSize: '0.85rem' }}>
                          No cardholders have enrolled through this link yet.
                        </div>
                      ) : (
                        <>
                          {/* Cardholders Checklist */}
                          <div style={{ 
                            maxHeight: '220px', 
                            overflowY: 'auto', 
                            border: '1px solid var(--glass-border)',
                            borderRadius: '6px',
                            background: 'rgba(0,0,0,0.1)'
                          }}>
                            <table className="custom-table" style={{ margin: 0 }}>
                              <thead>
                                <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                                  <th style={{ width: '40px', padding: '10px' }}>
                                    <input 
                                      type="checkbox" 
                                      checked={selectedCardholderIds.length === batchCardholders.length} 
                                      onChange={handleSelectAll} 
                                    />
                                  </th>
                                  <th style={{ padding: '10px' }}>Photo</th>
                                  <th style={{ padding: '10px' }}>Name</th>
                                  <th style={{ padding: '10px' }}>Template Name</th>
                                  <th style={{ padding: '10px' }}>Designation</th>
                                  <th style={{ padding: '10px' }}>Serial / Key</th>
                                </tr>
                              </thead>
                              <tbody>
                                {batchCardholders.map(ch => {
                                  const isChSelected = selectedCardholderIds.includes(ch.id);
                                  const effectivePhoto = getEffectivePhotoUrl(ch);

                                  return (
                                    <tr key={ch.id} style={{ opacity: isChSelected ? 1 : 0.5 }}>
                                      <td style={{ padding: '10px' }}>
                                        <input 
                                          type="checkbox" 
                                          checked={isChSelected} 
                                          onChange={() => toggleCardholderSelection(ch.id)} 
                                        />
                                      </td>
                                      <td style={{ padding: '6px 10px' }}>
                                        {effectivePhoto ? (
                                          <img src={effectivePhoto} alt="" style={{ width: '32px', height: '32px', borderRadius: '6px', objectFit: 'cover', border: '1px solid var(--glass-border)' }} />
                                        ) : (
                                          <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: '0.65rem' }}>None</div>
                                        )}
                                      </td>
                                      <td style={{ padding: '10px', fontWeight: '500' }}>{ch.name}</td>
                                      <td style={{ padding: '10px' }}>{ch.templateName || '—'}</td>
                                      <td style={{ padding: '10px' }}>{ch.designation || '—'}</td>
                                      <td style={{ padding: '10px', fontSize: '0.8rem', color: 'var(--muted)' }}>{ch.cardSerial || '—'}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                          {/* Compilation parameters form */}
                          <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: '1fr 1fr', 
                            gap: '16px',
                            background: 'rgba(255,255,255,0.01)',
                            padding: '16px',
                            borderRadius: '8px',
                            border: '1px solid var(--glass-border)'
                          }}>
                            <div className="form-group" style={{ margin: 0, gridColumn: 'span 2' }}>
                              <label className="form-label" style={{ fontSize: '0.75rem' }}>Price Per Card (Rs)</label>
                              <input 
                                type="number" 
                                className="form-input" 
                                style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                                value={batchPricePerCard} 
                                onChange={e => setBatchPricePerCard(e.target.value)} 
                              />
                            </div>

                            {/* Collapsible layout parameters for Production grid */}
                            <div style={{ gridColumn: 'span 2', marginTop: '4px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
                              <strong style={{ fontSize: '0.8rem', color: '#fff', display: 'block', marginBottom: '8px' }}>Layout & Grid Configurations</strong>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                                {[
                                  { label: 'Left (pt)',   value: batchMarginLeft,   field: 'marginLeft' },
                                  { label: 'Top (pt)',    value: batchMarginTop,    field: 'marginTop' },
                                  { label: 'Right (pt)',  value: batchMarginRight,  field: 'marginRight' },
                                  { label: 'Bottom (pt)', value: batchMarginBottom, field: 'marginBottom' },
                                  { label: 'Col Gap (pt)', value: batchColGap,       field: 'colGap' },
                                  { label: 'Row Gap (pt)', value: batchRowGap,       field: 'rowGap' },
                                ].map(({ label, value, field }) => (
                                  <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                    <label style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>{label}</label>
                                    <input 
                                      type="number" 
                                      className="form-input" 
                                      style={{ padding: '4px 6px', fontSize: '0.75rem' }}
                                      value={value} 
                                      onChange={e => handleUpdateConfig(field, Number(e.target.value))} 
                                    />
                                  </div>
                                ))}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                  <label style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>Bleed (pt)</label>
                                  <input 
                                    type="number" 
                                    className="form-input" 
                                    style={{ padding: '4px 6px', fontSize: '0.75rem' }}
                                    value={batchBleed} 
                                    onChange={e => handleUpdateConfig('bleed', Number(e.target.value))} 
                                  />
                                </div>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '16px' }}>
                                  <label style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={batchCropMarks} onChange={e => handleUpdateConfig('cropMarks', e.target.checked)} />
                                    Crops
                                  </label>
                                  <label style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={batchFoldLine} onChange={e => handleUpdateConfig('foldLine', e.target.checked)} />
                                    Folds
                                  </label>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Action Triggers */}
                          <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ flex: 1, padding: '10px' }}
                              disabled={batchPdfLoading !== null}
                              onClick={() => handleBatchCompile('APPROVAL')}
                            >
                              {batchPdfLoading === 'APPROVAL' ? 'Queueing Proof...' : 'Compile Proofs (Approval PDF)'}
                            </button>
                            <button
                              type="button"
                              className="btn btn-primary"
                              style={{ flex: 1, padding: '10px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', boxShadow: '0 4px 14px rgba(16,185,129,0.2)' }}
                              disabled={batchPdfLoading !== null}
                              onClick={() => handleBatchCompile('PRODUCTION')}
                            >
                              {batchPdfLoading === 'PRODUCTION' ? 'Queueing Grid...' : 'Compile Production PDF'}
                            </button>
                          </div>

                          {/* Live compilation progress status */}
                          {batchJob && (
                            <div style={{ 
                              background: 'rgba(255,255,255,0.02)', 
                              border: '1px solid var(--glass-border)', 
                              borderRadius: '8px', 
                              padding: '12px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '8px'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                                <strong>Job #{batchJob.id} Status:</strong>
                                <span>{batchJob.status}</span>
                              </div>
                              <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{ width: `${batchJob.progress ?? 0}%`, height: '100%', background: 'var(--primary-gradient)', transition: 'width 0.3s ease' }}></div>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--muted)' }}>
                                <span>Progress: {batchJob.progress}%</span>
                                {batchJob.status === 'COMPLETED' && (
                                  batchJob.isLocalJob ? (
                                    <span style={{ color: '#10b981', fontWeight: 'bold' }}>Compiled Successfully</span>
                                  ) : batchJob.downloadUrl && (
                                    <a 
                                      href={batchJob.downloadUrl} 
                                      target="_blank" 
                                      rel="noreferrer" 
                                      style={{ color: '#10b981', fontWeight: 'bold', textDecoration: 'underline' }}
                                    >
                                      Download PDF File
                                    </a>
                                  )
                                )}
                                {batchJob.status === 'FAILED' && batchJob.errorMsg && (
                                  <span style={{ color: 'var(--danger)' }}>Error: {batchJob.errorMsg}</span>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Previously compiled files */}
                          {!batchJob && (selectedShareForBatch?.latestApprovalJob || selectedShareForBatch?.latestProductionJob) && (
                            <div style={{ 
                              background: 'rgba(255,255,255,0.02)', 
                              border: '1px solid var(--glass-border)', 
                              borderRadius: '8px', 
                              padding: '12px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '10px'
                            }}>
                              <strong style={{ fontSize: '0.8rem', color: '#fff' }}>Previously Compiled PDFs for this share link:</strong>
                              <div style={{ display: 'flex', gap: '16px' }}>
                                {selectedShareForBatch.latestApprovalJob && (
                                  selectedShareForBatch.latestApprovalJob.isLocalJob ? (
                                    <span style={{ color: 'var(--primary)', fontSize: '0.8rem', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                      📄 Approval Proof (Saved)
                                    </span>
                                  ) : (
                                    <button 
                                      type="button"
                                      onClick={() => setPreviewJob({ id: selectedShareForBatch.latestApprovalJob.id, pdfType: 'APPROVAL', fileName: `Approval_Proof_Share_${selectedShareForBatch.id}.pdf` })}
                                      style={{ background: 'none', border: 'none', padding: 0, color: 'var(--primary)', fontSize: '0.8rem', fontWeight: 'bold', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                                    >
                                      📄 View Approval Proof
                                    </button>
                                  )
                                )}
                                {selectedShareForBatch.latestProductionJob && (
                                  selectedShareForBatch.latestProductionJob.isLocalJob ? (
                                    <span style={{ color: '#10b981', fontSize: '0.8rem', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                      📄 Production PDF (Saved)
                                    </span>
                                  ) : (
                                    <button 
                                      type="button"
                                      onClick={() => setPreviewJob({ id: selectedShareForBatch.latestProductionJob.id, pdfType: 'PRODUCTION', fileName: `Production_Grid_Share_${selectedShareForBatch.id}.pdf` })}
                                      style={{ background: 'none', border: 'none', padding: 0, color: '#10b981', fontSize: '0.8rem', fontWeight: 'bold', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                                    >
                                      📄 View Production PDF
                                    </button>
                                  )
                                )}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      {/* PDF Inline Preview Modal */}
      {previewJob && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(10, 10, 12, 0.85)',
          backdropFilter: 'blur(12px)',
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '24px'
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: '1000px',
            height: '90vh',
            display: 'flex',
            flexDirection: 'column',
            padding: '0',
            overflow: 'hidden',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 24px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              background: 'rgba(255, 255, 255, 0.01)'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600' }}>
                  Preview: {previewJob.fileName}
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                  Type: {previewJob.pdfType} • Job #{previewJob.id}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <a
                  href={`/api/jobs/${previewJob.id}/download`}
                  className="btn btn-primary"
                  style={{ padding: '6px 12px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Download size={12} /> Download
                </a>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '6px', minWidth: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onClick={() => setPreviewJob(null)}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Modal Content - Embed PDF */}
            <div style={{ flex: 1, background: '#1c1c1e', position: 'relative' }}>
              <iframe
                src={`/api/jobs/${previewJob.id}/download?inline=true`}
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  background: '#1c1c1e'
                }}
                title={previewJob.fileName}
              />
            </div>
          </div>
        </div>
      )}

      {/* Global Confirm Dialog */}
      {confirmConfig && (
        <ConfirmDialog
          open={confirmOpen}
          title={confirmConfig.title}
          message={confirmConfig.message}
          confirmLabel={confirmConfig.confirmLabel}
          variant={confirmConfig.variant}
          onConfirm={confirmConfig.onConfirm}
          onCancel={closeConfirm}
        />
      )}
    </div>
  );
}
