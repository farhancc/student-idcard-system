'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import ConfirmDialog from '@/app/components/ConfirmDialog';
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

  // CSV Import State
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [googleSheetsUrl, setGoogleSheetsUrl] = useState('');
  const [importMode, setImportMode] = useState('check'); // check | skip | update | overwrite
  const [importResult, setImportResult] = useState<CSVImportResult | null>(null);
  const [importError, setImportError] = useState('');
  const [importLoading, setImportLoading] = useState(false);

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
  const [searchId, setSearchId] = useState('');
  const [filterTemplate, setFilterTemplate] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [quickTemplates, setQuickTemplates] = useState<QuickTemplate[]>([]);
  const [showCompileModal, setShowCompileModal] = useState(false);
  const [qTemplateId, setQTemplateId] = useState('');
  const [qPricePerCard, setQPricePerCard] = useState('50');
  const [qCropMarks, setQCropMarks] = useState(true);
  const [qFoldLine, setQFoldLine] = useState(true);
  const [qBleed, setQBleed] = useState(0);
  const [qCompiling, setQCompiling] = useState<string | null>(null);
  const [qJobResult, setQJobResult] = useState<QuickJobResult | null>(null);
  const [qTemplateMixed, setQTemplateMixed] = useState(false);
  const [qDetectedTemplateName, setQDetectedTemplateName] = useState<string | null>(null);

  // View / Edit Cardholder Details Modals State
  const [viewingCardholder, setViewingCardholder] = useState<Cardholder | null>(null);
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

  const handleDownloadAllDataZip = async () => {
    try {
      if (cardholders.length === 0) {
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
      const cardholderImageIds = cardholders.map((ch: any) => {
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
      const formattedData = cardholders.map((ch: any) => {
        const imageId = imageIdMap.get(ch.id) || '';
        const row: any = {
          'Name': escapeFormula(ch.name),
          'ID / Unique Key': escapeFormula(ch.uniqueKey || ''),
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

      cardholders.forEach((ch: any) => {
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

      const fileName = `Client_${(client?.name || 'export').replace(/\s+/g, '_')}_Data.zip`;
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
  const handleAddCardholder = async (e: React.FormEvent) => {
    e.preventDefault();
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
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to add cardholder');

      // Reset
      setName('');
      setDesignation('');
      setPhotoUrl('');
      setUniqueKey('');
      setCustomFields('');
      setActiveTab('list');
      fetchData();
    } catch (err: any) {
      setAddError(err.message || 'JSON parsing or server error occurred');
    } finally {
      setAddLoading(false);
    }
  };

  // CSV Import handler
  const handleCsvImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportError('');
    setImportResult(null);
    setImportLoading(true);

    try {
      const formData = new FormData();
      formData.append('clientId', String(clientId));
      formData.append('mode', importMode);
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
        const mappedFields = allFields.map(f => f.field);

        hasName = mappedFields.includes('name') || mappedFields.includes('fullName');
        hasDesignation = mappedFields.includes('designation') || mappedFields.includes('role');
        
        const imageFields = allFields.filter(f => f.type === 'image');
        const mainPhoto = imageFields.find(f => 
          f.field === 'photo' || 
          f.field === 'avatar' || 
          f.field === 'photoUrl' ||
          f.field.toLowerCase().includes('photo') || 
          f.field.toLowerCase().includes('avatar') || 
          f.field.toLowerCase().includes('profile')
        ) || null;
        hasPhoto = mainPhoto !== null;
        
        hasUniqueKey = mappedFields.includes('uniqueKey');

        // Extract customFields map from record but ONLY keep those in the template
        let existingCustom: Record<string, any> = {};
        if (ch.customFields) {
          try {
            existingCustom = typeof ch.customFields === 'string' ? JSON.parse(ch.customFields) : ch.customFields;
          } catch {}
        }

        allFields.forEach(f => {
          const isMainPhotoField = mainPhoto && f.field === mainPhoto.field;
          if (
            f.field !== 'name' &&
            f.field !== 'fullName' &&
            f.field !== 'designation' &&
            f.field !== 'role' &&
            f.field !== 'photo' &&
            f.field !== 'avatar' &&
            f.field !== 'photoUrl' &&
            f.field !== 'uniqueKey' &&
            f.field !== 'validTill' &&
            f.field !== 'validTillDate' &&
            f.field !== 'cardSerial' &&
            !isMainPhotoField
          ) {
            const foundVal = getCustomFieldValueCaseInsensitive(existingCustom, f.field);
            parsedMap[f.field] = foundVal !== undefined ? String(foundVal) : '';
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
          uniqueKey: editHasUniqueKey ? editUniqueKey : null,
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
      // All same template — auto-select it
      setQTemplateId(String(templateIds[0]));
      const tpl = quickTemplates.find(t => t.id === templateIds[0]);
      setQDetectedTemplateName(tpl?.name || null);
      setQTemplateMixed(false);
    } else if (templateIds.length > 1) {
      // Mixed templates — warn user, keep first detected
      setQTemplateId(String(templateIds[0]));
      setQDetectedTemplateName(null);
      setQTemplateMixed(true);
    } else {
      // No template resolved — fallback to dropdown default
      setQDetectedTemplateName(null);
      setQTemplateMixed(false);
      if (quickTemplates.length > 0 && !qTemplateId) {
        setQTemplateId(String(quickTemplates[0].id));
      }
    }
    setShowCompileModal(true);
  };

  // Quick-compile handler
  const handleQuickCompile = async (type: 'APPROVAL' | 'PRODUCTION') => {
    if (!qTemplateId || selectedIds.length === 0) return;
    setQCompiling(type);
    setQJobResult(null);
    try {
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

      // 2. Queue job
      const jobRes = await fetch('/api/jobs/production-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: orderData.order.id,
          pdfType: type,
          paperSize: type === 'PRODUCTION' ? 'A3' : 'A4',
          orientation: 'PORTRAIT',
          bleed: qBleed,
          cropMarks: qCropMarks,
          foldLine: qFoldLine,
        }),
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

  function getEffectivePhotoUrl(ch: any): string | null {
    if (!ch) return null;
    if (ch.photoUrl && ch.photoUrl.trim() !== '' && ch.photoUrl !== 'null' && ch.photoUrl !== 'undefined') {
      return ch.photoUrl;
    }
    if (ch.customFields) {
      try {
        const parsed = typeof ch.customFields === 'string' ? JSON.parse(ch.customFields) : ch.customFields;
        if (parsed && typeof parsed === 'object') {
          for (const [key, val] of Object.entries(parsed)) {
            if (val && typeof val === 'string' && (val.startsWith('http://') || val.startsWith('https://') || val.startsWith('data:image/'))) {
              return val;
            }
          }
        }
      } catch (e) {}
    }
    return null;
  }

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

        const label = f.field.replace(/([A-Z])/g, ' $1').replace(/^./, (str: string) => str.toUpperCase());
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
    if (colKey === 'uniqueKey') return ch.uniqueKey || '';
    if (colKey === 'photoUrl' || colKey === 'photo' || colKey === 'avatar') return getEffectivePhotoUrl(ch) || '';

    if (ch.customFields) {
      try {
        const parsed = typeof ch.customFields === 'string' ? JSON.parse(ch.customFields) : ch.customFields;
        const val = getCustomFieldValueCaseInsensitive(parsed, colKey);
        if (val !== undefined && val !== null) return String(val);
      } catch (e) {}
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
      const allFields = [...front, ...back];
      
      const hasName = allFields.some(f => f.field === 'name' || f.field === 'fullName');
      const hasDesignation = allFields.some(f => f.field === 'designation' || f.field === 'role');
      const hasUniqueKey = allFields.some(f => f.field === 'uniqueKey');
      
      if (hasName && (!ch.name || ch.name.trim() === '')) {
        warnings.push('Name is required');
      }
      if (hasDesignation && (!ch.designation || ch.designation.trim() === '')) {
        warnings.push('Designation is missing');
      }
      if (hasUniqueKey && (!ch.uniqueKey || ch.uniqueKey.trim() === '')) {
        warnings.push('Unique ID/Key is missing');
      }
      
      // Parse custom fields
      let parsedCustom: Record<string, any> = {};
      if (ch.customFields) {
        parsedCustom = typeof ch.customFields === 'string' ? JSON.parse(ch.customFields) : ch.customFields;
      }
      
      // Get custom text fields (qr, barcode, id are auto-generated from metadata, so they should not trigger missing field warnings)
      const textFields = allFields.filter(f => f.type === 'text');
      const customTextKeys = Array.from(new Set(textFields.map(f => f.field))).filter(k => 
        k !== 'name' && k !== 'fullName' && k !== 'designation' && k !== 'role' && k !== 'uniqueKey' && k !== 'cardSerial' && k !== 'validTill' && k !== 'validTillDate'
      );
      
      customTextKeys.forEach(k => {
        const val = getCustomFieldValueCaseInsensitive(parsedCustom, k);
        if (!val || String(val).trim() === '') {
          const label = k.replace(/([A-Z])/g, ' $1').replace(/^./, (str: string) => str.toUpperCase());
          warnings.push(`${label} is missing`);
        }
      });
      
      // Validate all image fields in template against both customFields and photoUrl
      const imageFields = allFields.filter(f => f.type === 'image');
      const checkedImageFields = new Set<string>();

      imageFields.forEach(f => {
        if (checkedImageFields.has(f.field)) return;
        checkedImageFields.add(f.field);

        const customVal = getCustomFieldValueCaseInsensitive(parsedCustom, f.field);
        const hasCustomVal = customVal && String(customVal).trim() !== '' && String(customVal) !== 'null' && String(customVal) !== 'undefined';
        const hasPhotoUrl = ch.photoUrl && ch.photoUrl.trim() !== '' && ch.photoUrl !== 'null' && ch.photoUrl !== 'undefined';

        if (!hasCustomVal && !hasPhotoUrl) {
          const label = f.field.replace(/([A-Z])/g, ' $1').replace(/^./, (str: string) => str.toUpperCase());
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
    const matchesSearchId = !searchId.trim() ||
      (c.uniqueKey && c.uniqueKey.toLowerCase().includes(searchId.toLowerCase()));

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

  const handleExportExcel = async () => {
    try {
      const exportList = selectedIds.length > 0
        ? cardholders.filter((c: any) => selectedIds.includes(c.id))
        : filteredCardholders;

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
          'ID / Unique Key': escapeFormula(ch.uniqueKey || ''),
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
      
      const fileName = `Cardholders_${(client?.name || 'export').replace(/\s+/g, '_')}.xlsx`;
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

          <button
            className="btn btn-secondary"
            style={{
              fontSize: '0.85rem',
              padding: '8px 14px',
              gap: '6px',
              background: 'rgba(59,130,246,0.1)',
              border: '1px solid rgba(59,130,246,0.3)',
              color: '#60a5fa'
            }}
            onClick={handleDownloadAllDataZip}
            disabled={zipping}
          >
            <Download size={14} />
            {zipping ? (zipProgress || 'Zipping...') : `Download Data ZIP (${cardholders.length})`}
          </button>

          <button
            className="btn btn-secondary"
            style={{
              fontSize: '0.85rem',
              padding: '8px 14px',
              gap: '6px',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: '#ef4444'
            }}
            onClick={handlePurgeClient}
          >
            <Trash2 size={14} /> Purge Client Data
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
                    placeholder="ID / Unique Key includes..."
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
                      className="btn btn-primary"
                      style={{ fontSize: '0.85rem', padding: '8px 14px', gap: '6px' }}
                      onClick={handleOpenCompileModal}
                    >
                      <Zap size={14} /> Compile PDF ({selectedIds.length})
                    </button>
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: '0.85rem', padding: '8px 14px', gap: '6px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981' }}
                      onClick={handleExportExcel}
                    >
                      Export Excel ({selectedIds.length})
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="btn btn-primary"
                      style={{ fontSize: '0.85rem', padding: '8px 14px', gap: '6px' }}
                      onClick={() => {
                        if (filteredCardholders.length === 0) {
                          toast('No cardholders to compile.', 'warning');
                          return;
                        }
                        setSelectedIds(filteredCardholders.map((c: any) => c.id));
                        setTimeout(() => {
                          handleOpenCompileModal();
                        }, 50);
                      }}
                    >
                      <Zap size={14} /> Compile All PDF ({filteredCardholders.length})
                    </button>
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: '0.85rem', padding: '8px 14px', gap: '6px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981' }}
                      onClick={handleExportExcel}
                    >
                      Export All Excel ({filteredCardholders.length})
                    </button>
                  </>
                )}
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
                const templatesToRender = clientTemplates.length > 0 ? clientTemplates : [{ id: 0, name: 'Default Template', frontFields: '[]', backFields: '[]' }];
                
                // Track cardholders processed by templates
                const processedCardholderIds = new Set<number>();

                const templateTables = templatesToRender.map(tmpl => {
                  const tmplCardholders = filteredCardholders.filter(c => {
                    const match = c.resolvedTemplateId === tmpl.id || 
                                  c.templateName === tmpl.name || 
                                  (!c.resolvedTemplateId && !c.templateName && templatesToRender.length === 1);
                    if (match) processedCardholderIds.add(c.id);
                    return match;
                  });

                  if (filterTemplate && String(tmpl.id) !== filterTemplate && tmpl.name.toLowerCase() !== filterTemplate.toLowerCase()) {
                    return null;
                  }

                  const cols = getTemplateColumns(tmpl);

                  return (
                    <div key={tmpl.id || tmpl.name} style={{ marginBottom: '32px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', padding: '0 4px' }}>
                        <h3 style={{ fontSize: '1.05rem', color: 'var(--primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <CreditCard size={18} />
                          {tmpl.name} <span style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 'normal' }}>({tmplCardholders.length} cardholders)</span>
                        </h3>
                      </div>

                      {tmplCardholders.length === 0 ? (
                        <div className="glass-panel" style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: '0.85rem' }}>
                          No cardholders registered under {tmpl.name}.
                        </div>
                      ) : (
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
                                <th>Photo</th>
                                {cols.map(col => {
                                  if (col.type === 'image' || col.key === 'photo' || col.key === 'avatar' || col.key === 'photoUrl') return null;
                                  return <th key={col.key}>{col.label}</th>;
                                })}
                                {!cols.some(c => c.key === 'name' || c.key === 'fullName') && <th>Name</th>}
                                {!cols.some(c => c.key === 'uniqueKey') && <th>ID from Template</th>}
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
                                    <td>
                                      {effectivePhoto ? (
                                        <img 
                                          src={effectivePhoto} 
                                          alt={ch.name} 
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

                                    {cols.map(col => {
                                      if (col.type === 'image' || col.key === 'photo' || col.key === 'avatar' || col.key === 'photoUrl') return null;
                                      const val = getFieldValue(ch, col.key);
                                      const isNameCol = col.key === 'name' || col.key === 'fullName';

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

                                    {!cols.some(c => c.key === 'name' || c.key === 'fullName') && (
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

                                    {!cols.some(c => c.key === 'uniqueKey') && (
                                      <td>{ch.uniqueKey || <span style={{ color: 'var(--muted)' }}>—</span>}</td>
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
                      )}
                    </div>
                  );
                });

                // Unassigned cardholders check
                const unassigned = filteredCardholders.filter(c => !processedCardholderIds.has(c.id));
                const unassignedTable = unassigned.length > 0 ? (
                  <div key="unassigned" style={{ marginBottom: '32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', padding: '0 4px' }}>
                      <h3 style={{ fontSize: '1.05rem', color: 'var(--primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <CreditCard size={18} />
                        Unassigned Cardholders <span style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 'normal' }}>({unassigned.length} cardholders)</span>
                      </h3>
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
                            <th>ID from Template</th>
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
                                <td>{ch.uniqueKey || '—'}</td>
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

                return (
                  <>
                    {templateTables}
                    {unassignedTable}
                  </>
                );
              })()}
            </div>
          )}

          {/* ── Quick Compile Modal ─────────────────────────── */}
          {showCompileModal && (
            <div
              onClick={() => setShowCompileModal(false)}
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
                  width: '100%', maxWidth: '500px',
                  boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Zap size={18} color="var(--primary)" />
                    Compile {selectedIds.length} Card{selectedIds.length !== 1 ? 's' : ''}
                  </h3>
                  <button onClick={() => setShowCompileModal(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}>
                    <X size={18} />
                  </button>
                </div>

                {qJobResult ? (
                  <div style={{ padding: '10px 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                      <strong style={{ fontSize: '0.85rem', color: '#fff' }}>
                        {qJobResult.pdfType === 'PRODUCTION' ? 'Production PDF' : 'Approval Proof'} Job #{qJobResult.id}
                      </strong>
                      <span style={{ 
                        fontSize: '0.7rem', 
                        padding: '2px 8px', 
                        borderRadius: '10px', 
                        background: qJobResult.status === 'COMPLETED' ? 'rgba(16,185,129,0.15)' : qJobResult.status === 'FAILED' ? 'rgba(239,68,68,0.15)' : 'rgba(99,102,241,0.15)',
                        color: qJobResult.status === 'COMPLETED' ? '#10b981' : qJobResult.status === 'FAILED' ? '#ef4444' : 'var(--primary)',
                        fontWeight: 'bold'
                      }}>
                        {qJobResult.status}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden', marginBottom: '12px' }}>
                      <div style={{ 
                        width: `${qJobResult.progress ?? 0}%`, 
                        height: '100%', 
                        background: qJobResult.status === 'FAILED' ? '#ef4444' : 'var(--primary-gradient)', 
                        transition: 'width 0.3s ease' 
                      }}></div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '24px' }}>
                      <span>Progress: {qJobResult.progress ?? 0}%</span>
                      {qJobResult.status === 'COMPLETED' && (
                        qJobResult.isLocalJob ? (
                          <span style={{ color: '#10b981', fontWeight: 'bold' }}>Saved to Documents</span>
                        ) : qJobResult.downloadUrl && (
                          <a 
                            href={qJobResult.downloadUrl} 
                            target="_blank" 
                            rel="noreferrer" 
                            style={{ color: '#10b981', fontWeight: 'bold', textDecoration: 'underline' }}
                          >
                            Download PDF
                          </a>
                        )
                      )}
                      {qJobResult.status === 'FAILED' && qJobResult.errorMsg && (
                        <span style={{ color: 'var(--danger)' }}>Error: {qJobResult.errorMsg}</span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                      {qJobResult.status === 'FAILED' && (
                        <button className="btn btn-secondary" onClick={() => { setQJobResult(null); }}>Retry</button>
                      )}
                      {(qJobResult.status === 'COMPLETED' || qJobResult.status === 'FAILED') && (
                        <button className="btn btn-primary" style={{ minWidth: '100px' }} onClick={() => { setShowCompileModal(false); setQJobResult(null); setSelectedIds([]); }}>Close</button>
                      )}
                      {qJobResult.status !== 'COMPLETED' && qJobResult.status !== 'FAILED' && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                          Compiling cards... Keep this window and Desktop App open.
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Template selector — auto-detected or manual */}
                    <div className="form-group">
                      <label className="form-label">Card Template</label>
                      {qDetectedTemplateName && !qTemplateMixed ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '8px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                          <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: '600' }}>✓ Auto-detected:</span>
                          <span style={{ fontSize: '0.85rem', color: '#fff', fontWeight: '500' }}>{qDetectedTemplateName}</span>
                          <button type="button" onClick={() => setQDetectedTemplateName(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.7rem' }}>Change</button>
                        </div>
                      ) : (
                        <>
                          {qTemplateMixed && (
                            <div style={{ padding: '7px 12px', marginBottom: '8px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '7px', fontSize: '0.75rem', color: '#f59e0b' }}>
                              ⚠ Selected cards have mixed templates. All will be compiled under the selected template below.
                            </div>
                          )}
                          <select className="form-select" value={qTemplateId} onChange={e => setQTemplateId(e.target.value)}>
                            {quickTemplates.map(t => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </select>
                        </>
                      )}
                    </div>

                    <div className="form-group">
                      <label className="form-label">Price per Card (Rs.)</label>
                      <input type="number" className="form-input" value={qPricePerCard} onChange={e => setQPricePerCard(e.target.value)} />
                    </div>

                    <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', cursor: 'pointer' }}>
                        <input type="checkbox" checked={qCropMarks} onChange={e => setQCropMarks(e.target.checked)} style={{ accentColor: 'var(--primary)' }} />
                        Crop Marks
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', cursor: 'pointer' }}>
                        <input type="checkbox" checked={qFoldLine} onChange={e => setQFoldLine(e.target.checked)} style={{ accentColor: 'var(--primary)' }} />
                        Fold Line
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem' }}>
                        <label style={{ color: 'var(--muted)' }}>Bleed (pt):</label>
                        <input
                          type="number" min={0} max={20}
                          value={qBleed}
                          onChange={e => setQBleed(Number(e.target.value))}
                          style={{ width: '60px', padding: '4px 8px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--glass-border)', borderRadius: '6px', color: '#fff' }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ flex: 1, gap: '8px' }}
                        disabled={!!qCompiling}
                        onClick={() => handleQuickCompile('APPROVAL')}
                      >
                        {qCompiling === 'APPROVAL' ? (
                          <span className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} />
                        ) : <FileText size={15} />}
                        Approval Proof (A4)
                      </button>
                      <button
                        className="btn btn-primary"
                        style={{ flex: 1, gap: '8px' }}
                        disabled={!!qCompiling}
                        onClick={() => handleQuickCompile('PRODUCTION')}
                      >
                        {qCompiling === 'PRODUCTION' ? (
                          <span className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} />
                        ) : <Zap size={15} />}
                        Production PDF (A3)
                      </button>
                    </div>
                  </>
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
              <label className="form-label">Full Name</label>
              <input type="text" required className="form-input" placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label">Designation / Role</label>
              <input type="text" className="form-input" placeholder="Student / Employee / Staff" value={designation} onChange={e => setDesignation(e.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label">Institutional ID / Unique Key</label>
              <input type="text" className="form-input" placeholder="EMP-102" value={uniqueKey} onChange={e => setUniqueKey(e.target.value)} />
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
        <div className="glass-panel" style={{ maxWidth: '640px' }}>
          <h3 style={{ marginBottom: '20px' }}>Batch Data Import</h3>
          <p style={{ marginBottom: '24px', fontSize: '0.85rem' }}>
            Upload a CSV / Excel spreadsheet or paste a public Google Sheets sharing link.
          </p>

          {importError && (
            <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f77', borderRadius: '6px', marginBottom: '20px', fontSize: '0.85rem' }}>
              {importError}
            </div>
          )}

          {importResult && (
            <div className="glass-panel" style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', marginBottom: '24px', border: '1px solid var(--success)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--success)', marginBottom: '12px' }}>
                <CheckCircle size={18} />
                <h4 style={{ color: 'var(--success)' }}>Import Complete (Mode: {importResult.mode})</h4>
              </div>
              <ul style={{ fontSize: '0.85rem', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--muted)' }}>
                <li>Total rows processed: <strong style={{ color: '#fff' }}>{importResult.totalRows}</strong></li>
                <li>New cardholders added: <strong style={{ color: '#fff' }}>{importResult.newAdded}</strong></li>
                <li>Existing updated: <strong style={{ color: '#fff' }}>{importResult.updated}</strong></li>
                <li>Skipped: <strong style={{ color: '#fff' }}>{importResult.skipped}</strong></li>
                <li>Possible duplicate duplicates: <strong style={{ color: '#fff' }}>{importResult.duplicateCount}</strong></li>
              </ul>
            </div>
          )}

          <form onSubmit={handleCsvImport} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label className="form-label" style={{ margin: 0 }}>Upload File (.csv, .xlsx)</label>
                <a
                  href="/api/cardholders/import/sample"
                  download
                  style={{
                    fontSize: '0.8rem',
                    color: 'var(--primary)',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontWeight: '500'
                  }}
                >
                  <Download size={12} /> Download Sample Template
                </a>
              </div>
              <input type="file" accept=".csv,.xlsx,.xls" className="form-input" onChange={e => setCsvFile(e.target.files?.[0] || null)} />
            </div>

            <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '0.8rem' }}>— OR —</div>

            <div className="form-group">
              <label className="form-label">Public Google Sheets URL</label>
              <input type="text" className="form-input" placeholder="https://docs.google.com/spreadsheets/d/..." value={googleSheetsUrl} onChange={e => setGoogleSheetsUrl(e.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label">Duplicate Collision Action</label>
              <select className="form-select" value={importMode} onChange={e => setImportMode(e.target.value)}>
                <option value="check">Check Dry Run (List Duplicates, Do Not Insert)</option>
                <option value="skip">Skip duplicates (Only insert new cardholders)</option>
                <option value="update">Update existing (Overwrites details, keeps photo if new is blank)</option>
                <option value="overwrite">Overwrite existing (Delete and recreate cardholder records)</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => { setActiveTab('list'); setImportResult(null); }}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={importLoading}>
                {importLoading ? 'Processing...' : 'Run Import Pipeline'}
              </button>
            </div>
          </form>
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
              width: '100%', maxWidth: '500px',
              boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '600' }}>Cardholder Details</h3>
              <button onClick={() => setViewingCardholder(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
              {(() => {
                const photo = getEffectivePhotoUrl(viewingCardholder);
                return photo ? (
                  <img 
                    src={photo} 
                    alt={viewingCardholder.name} 
                    style={{ width: '100px', height: '100px', borderRadius: '12px', objectFit: 'cover', border: '1px solid var(--glass-border)' }} 
                  />
                ) : (
                  <div style={{
                    width: '100px',
                    height: '100px',
                    borderRadius: '12px',
                    background: 'rgba(255,255,255,0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--muted)',
                    fontSize: '0.9rem'
                  }}>
                    No Photo
                  </div>
                );
              })()}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <h4 style={{ margin: 0, fontSize: '1.1rem', color: '#fff' }}>{viewingCardholder.name}</h4>
                <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                  ID: <span style={{ color: '#fff', fontWeight: '500' }}>{viewingCardholder.uniqueKey || '—'}</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                  Designation: <span style={{ color: '#fff' }}>{viewingCardholder.designation || '—'}</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                  Template: <span style={{ color: '#fff' }}>{viewingCardholder.templateName || '—'}</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                  Added On: <span style={{ color: '#fff' }}>{new Date(viewingCardholder.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            {viewingCardholder.customFields && (
              <div style={{ marginTop: '16px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>Custom Template Fields</label>
                <div style={{ 
                  background: 'rgba(0,0,0,0.2)', 
                  padding: '12px', 
                  borderRadius: '8px', 
                  fontSize: '0.75rem', 
                  fontFamily: 'monospace',
                  maxHeight: '150px',
                  overflowY: 'auto',
                  border: '1px solid var(--glass-border)'
                }}>
                  {Object.entries(JSON.parse(viewingCardholder.customFields)).map(([key, val]) => (
                    <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <span style={{ color: 'var(--primary)' }}>{key}:</span>
                      <span style={{ color: '#fff' }}>{String(val)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
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
              {editHasName && (
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Full Name</label>
                  <input type="text" required className="form-input" value={editName} onChange={e => setEditName(e.target.value)} />
                </div>
              )}
              
              {editHasDesignation && (
                <div className="form-group">
                  <label className="form-label">Designation / Role</label>
                  <input type="text" className="form-input" value={editDesignation} onChange={e => setEditDesignation(e.target.value)} />
                </div>
              )}

              {editHasUniqueKey && (
                <div className="form-group">
                  <label className="form-label">Institutional ID / Unique Key (ID from Template)</label>
                  <input type="text" className="form-input" value={editUniqueKey} onChange={e => setEditUniqueKey(e.target.value)} />
                </div>
              )}

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
                      const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, (str: string) => str.toUpperCase());

                      return (
                        <div key={key} style={{ display: 'flex', gap: '12px', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '8px' }}>
                          <span style={{
                            fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 500,
                            minWidth: '120px', maxWidth: '160px', padding: '8px 10px',
                            background: 'rgba(56,189,248,0.05)', border: '1px solid var(--glass-border)',
                            borderRadius: '6px', wordBreak: 'break-all',
                          }}>{label}</span>
                          
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
                              className="form-input"
                              style={{ flex: 1, fontSize: '0.85rem' }}
                              value={val}
                              onChange={e => setEditCustomFieldsMap(prev => ({ ...prev, [key]: e.target.value }))}
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
                  if (editHasUniqueKey && (!editUniqueKey || editUniqueKey.trim() === '')) inlineWarnings.push('Unique ID/Key is missing');

                  // Validate text fields in editCustomFieldsMap
                  Object.entries(editCustomFieldsMap).forEach(([k, v]) => {
                    const meta = editTemplateFields.find(f => f.field === k);
                    if (meta && meta.type === 'text') {
                      const isSystemKey = ['name', 'fullName', 'designation', 'role', 'uniqueKey', 'cardSerial', 'validTill', 'validTillDate'].includes(k);
                      if (!isSystemKey && (!v || String(v).trim() === '')) {
                        const lbl = k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
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
                      const lbl = f.field.replace(/([A-Z])/g, ' $1').replace(/^./, (s: string) => s.toUpperCase());
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
          <div style={{ color: 'var(--warning)', fontSize: '0.9rem' }}>
            No card templates found. Please design or upload a template first.
          </div>
        ) : (
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
                      {t.name} {isPdf ? '📄 [PDF Format]' : '🖼️ [Image Format]'}
                    </option>
                  );
                })}
              </select>
            </div>
            <button type="submit" className="btn btn-primary" disabled={creating} style={{ height: '42px' }}>
              {creating ? 'Generating...' : 'Generate Links'}
            </button>
          </form>
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
                                        {ch.photoUrl ? (
                                          <img src={ch.photoUrl} alt="" style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }} />
                                        ) : (
                                          <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
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
                            <div className="form-group" style={{ margin: 0 }}>
                              <label className="form-label" style={{ fontSize: '0.75rem' }}>Price Per Card (Rs)</label>
                              <input 
                                type="number" 
                                className="form-input" 
                                style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                                value={batchPricePerCard} 
                                onChange={e => setBatchPricePerCard(e.target.value)} 
                              />
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                              <label className="form-label" style={{ fontSize: '0.75rem' }}>Expiry Validity Date</label>
                              <input 
                                type="date" 
                                className="form-input" 
                                style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                                value={batchValidTill} 
                                onChange={e => setBatchValidTill(e.target.value)} 
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
