'use client';

import React, { useEffect, useState } from 'react';
import { Plus, FileText, Calendar, DollarSign, FolderOpen, RefreshCcw, Image as ImageIcon, CheckCircle, AlertTriangle, AlertCircle, Eye, ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight, Search, ArrowLeft, Check, X } from 'lucide-react';
import { generateApprovalPdfClient } from '@/lib/pdf/approval-pdf-generator';
import { generateProductionPdfClient } from '@/lib/pdf/production-pdf-generator';
import CardPreview from '@/app/components/CardPreview';
import { formatFieldLabel } from '@/lib/pdf/card-renderer-client';

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState('OWNER');
  const isOwner = role === 'OWNER';

  // Pagination & sorting & search
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const PAGE_SIZE = 30;
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('desc');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Form toggling
  const [showForm, setShowForm] = useState(false);
  const [orderMethod, setOrderMethod] = useState<'standard' | 'batch'>('standard');
  const [clientId, setClientId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [pricePerCard, setPricePerCard] = useState('50'); // default Rs. 50
  const [taxPercent, setTaxPercent] = useState('18'); // default 18% GST
  const [validTill, setValidTill] = useState('');
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Client-side batch upload progress state
  const [pressId, setPressId] = useState<number | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });

  // Pre-upload preview state
  const [batchWizardStep, setBatchWizardStep] = useState<1 | 2 | 3>(1);
  const [rosterSearch, setRosterSearch] = useState('');
  const [acceptMissingFields, setAcceptMissingFields] = useState(false);
  const [showPreviewStep, setShowPreviewStep] = useState(false);
  const [parsedCardholders, setParsedCardholders] = useState<any[]>([]);
  const [selectedPreviewIndexes, setSelectedPreviewIndexes] = useState<number[]>([]);
  const [photosMap, setPhotosMap] = useState<Map<string, { blob: Blob; url: string; dataUri?: string }>>(new Map());
  const [selectedCardholderForDetails, setSelectedCardholderForDetails] = useState<any | null>(null);
  const [selectedCardholderIndexForDetails, setSelectedCardholderIndexForDetails] = useState<number | null>(null);
  const [isEditingDetail, setIsEditingDetail] = useState(false);
  const [detailsPreviewSide, setDetailsPreviewSide] = useState<'front' | 'back'>('front');
  const [loadedPressFonts, setLoadedPressFonts] = useState<any[]>([]);

  useEffect(() => {
    if (pressId) {
      fetch('/api/fonts', {
        headers: { 'x-press-id': String(pressId) }
      })
        .then(res => res.ok ? res.json() : null)
        .then(json => {
          if (json?.fonts) {
            setLoadedPressFonts(json.fonts);
          }
        })
        .catch(err => console.error('Failed to load press fonts for preview:', err));
    }
  }, [pressId]);

  const handleSaveCardholderEdit = () => {
    if (selectedCardholderIndexForDetails === null || !selectedCardholderForDetails) return;
    
    // Auto-detect / update photo match if they changed name/id/imageId
    const name = selectedCardholderForDetails.name || '';
    const uniqueKey = selectedCardholderForDetails.uniqueKey || '';
    const imageId = selectedCardholderForDetails.imageId || '';
    const matchKey = imageId || uniqueKey || name;
    const baseSanitized = matchKey.toLowerCase().replace(/[^a-zA-Z0-9_\-]/g, '_');
    
    let foundPhotoKey = baseSanitized;
    let hasPhoto = photosMap.has(baseSanitized);
    
    if (!hasPhoto) {
      const photoCandidates = [
        `${baseSanitized}_photo`,
        `${baseSanitized}_image`,
        `${baseSanitized}_pic`
      ];
      for (const cand of photoCandidates) {
        if (photosMap.has(cand)) {
          hasPhoto = true;
          foundPhotoKey = cand;
          break;
        }
      }
    }
    
    const photoData = photosMap.get(foundPhotoKey);
    const updatedPhotoUrl = hasPhoto && photoData ? (photoData.dataUri || photoData.url) : selectedCardholderForDetails.photoUrl;

    const updated = [...parsedCardholders];
    updated[selectedCardholderIndexForDetails] = {
      ...selectedCardholderForDetails,
      hasPhoto,
      sanitizedKey: foundPhotoKey,
      photoUrl: updatedPhotoUrl
    };
    
    setParsedCardholders(updated);
    setSelectedCardholderForDetails(updated[selectedCardholderIndexForDetails]);
    setIsEditingDetail(false);
  };

  // Layout options for client-side batch processing
  const [paperSize, setPaperSize] = useState<'A3' | 'A4' | 'SRA3' | '13x19' | 'CUSTOM'>('SRA3');
  const [orientation, setOrientation] = useState<'PORTRAIT' | 'LANDSCAPE'>('PORTRAIT');
  const [bleedMm, setBleedMm] = useState<string>('3'); // default 3mm
  const [cropMarks, setCropMarks] = useState<boolean>(true);
  const [foldLine, setFoldLine] = useState<boolean>(true);
  const [customSheetWidthMm, setCustomSheetWidthMm] = useState<string>('320');
  const [customSheetHeightMm, setCustomSheetHeightMm] = useState<string>('450');

  // Pre-print validation state
  const [prePrintValidationResult, setPrePrintValidationResult] = useState<{
    missingFields: Array<{ index: number; name: string; fields: string[] }>;
    totalCards: number;
    totalSlots: number;
  } | null>(null);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [showEmptySlotModal, setShowEmptySlotModal] = useState(false);
  const [emptySlotStrategy, setEmptySlotStrategy] = useState<'leave_blank' | 'repeat_last' | 'repeat_first'>('leave_blank');
  const [pendingGenerationType, setPendingGenerationType] = useState<'production' | null>(null);

  // Search debouncing
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);
    return () => clearTimeout(handler);
  }, [search]);

  // Reset page to 1 when search query changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const fetchOrders = async (p: number, sb: string, sd: string, s: string) => {
    try {
      const params = new URLSearchParams({
        page: String(p), pageSize: String(PAGE_SIZE), sortBy: sb, sortDir: sd,
      });
      if (s.trim()) {
        params.append('search', s.trim());
      }
      const res = await fetch(`/api/orders?${params}`);
      if (res.ok) {
        const json = await res.json();
        setOrders(json.orders || []);
        setTotal(json.total ?? 0);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchData = async () => {
    try {
      await fetchOrders(page, sortBy, sortDir, debouncedSearch);

      const clientsRes = await fetch('/api/clients');
      if (clientsRes.ok) {
        const json = await clientsRes.json();
        setClients(json.clients || []);
        if (json.clients?.length > 0) setClientId(String(json.clients[0].id));
      }

      const templatesRes = await fetch('/api/templates');
      if (templatesRes.ok) {
        const json = await templatesRes.json();
        const allTemplates = [
          ...(json.templates || []),
          ...(json.globalTemplates || []).map((t: any) => ({ ...t, name: `⭐ ${t.name} (Starter)` }))
        ];
        setTemplates(allTemplates);
        if (allTemplates.length > 0) setTemplateId(String(allTemplates[0].id));
      }

      const profileRes = await fetch('/api/press/profile');
      if (profileRes.ok) {
        const profileJson = await profileRes.json();
        if (profileJson.success && profileJson.press) {
          setPressId(profileJson.press.id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Initial mount: load everything
  useEffect(() => {
    fetchData();
    (async () => {
      try {
        const res = await fetch('/api/settings/me');
        if (res.ok) { const j = await res.json(); if (j.user?.role) setRole(j.user.role); }
      } catch { /* silent */ }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch orders whenever page / sort / search changes (skip on first render — fetchData handles it)
  const isFirstRender = React.useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    fetchOrders(page, sortBy, sortDir, debouncedSearch);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, sortBy, sortDir, debouncedSearch]);

  const handleSort = (col: string) => {
    if (sortBy === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
    setPage(1);
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortBy !== col) return <ChevronsUpDown size={12} style={{ marginLeft: 4, opacity: 0.4 }} />;
    return sortDir === 'asc'
      ? <ChevronUp size={12} style={{ marginLeft: 4, color: '#4f46e5' }} />
      : <ChevronDown size={12} style={{ marginLeft: 4, color: '#4f46e5' }} />;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      if (!clientId || !templateId) throw new Error('Client and Template must be selected');

      // Fetch cardholders for the client first
      const chRes = await fetch(`/api/clients/${clientId}/cardholders`);
      if (!chRes.ok) throw new Error('Failed to fetch cardholders for the selected client');
      const chData = await chRes.json();
      const cardholderIds = (chData.cardholders || []).map((ch: any) => ch.id);

      if (cardholderIds.length === 0) {
        throw new Error('Selected client registry has no cardholders. Please register cardholders for this client first.');
      }

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: Number(clientId),
          templateId: Number(templateId),
          cardholderIds,
          pricePerCard: Number(pricePerCard) || 0,
          taxPercent: Number(taxPercent) || 0,
          validTill: validTill ? new Date(validTill) : null,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create order');

      setShowForm(false);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAnalyzeBatchFiles = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setUploadStatus('Reading spreadsheet file...');
    setSubmitting(true);

    try {
      if (!clientId || !templateId) throw new Error('Client and Template must be selected');
      if (!excelFile) throw new Error('Excel student list file is required');
      if (!zipFile) throw new Error('ZIP photos file is required');
      if (!pressId) throw new Error('Press session could not be resolved. Please try refreshing page.');

      const selectedTemplate = templates.find(t => String(t.id) === templateId);
      if (!selectedTemplate) throw new Error('Selected Template not found.');

      // Get all field keys from the template
      const templateFieldKeys: string[] = [];
      try {
        const front = JSON.parse(selectedTemplate.frontFields || '[]');
        const back = JSON.parse(selectedTemplate.backFields || '[]');
        [...front, ...back].forEach((f: any) => {
          if (f.field && !templateFieldKeys.includes(f.field)) {
            templateFieldKeys.push(f.field);
          }
        });
      } catch (e) {
        console.error('Failed to parse template fields:', e);
      }

      // 1. Read and parse Excel / CSV
      let rawData: any[] = [];
      const excelName = excelFile.name.toLowerCase();

      if (excelName.endsWith('.csv')) {
        const csvText = await excelFile.text();
        const Papa = (await import('papaparse')).default;
        const parseResult = Papa.parse(csvText, { header: true, skipEmptyLines: true });
        rawData = parseResult.data;
      } else if (excelName.endsWith('.xlsx') || excelName.endsWith('.xls')) {
        const ExcelJS = (await import('exceljs')).default;
        const workbook = new ExcelJS.Workbook();
        const excelBuffer = await excelFile.arrayBuffer();
        await workbook.xlsx.load(excelBuffer as any);
        const sheet = workbook.worksheets[0];
        if (!sheet) {
          throw new Error('XLSX file contains no sheets.');
        }
        const headerRow = sheet.getRow(1).values as (any)[];
        const headers = headerRow.slice(1).map((h: any) => h?.text ?? h ?? '');
        sheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return;
          const rowObj: Record<string, any> = {};
          for (let i = 1; i <= headers.length; i++) {
            const cell = row.getCell(i);
            const key = headers[i - 1];
            if (key) {
              let val = cell.value;
              if (val && typeof val === 'object') {
                if ('result' in val) {
                  val = (val as any).result;
                } else if ('text' in val) {
                  val = (val as any).text;
                }
              }
              rowObj[key] = val !== null && val !== undefined ? String(val) : '';
            }
          }
          rawData.push(rowObj);
        });
      } else {
        throw new Error('Unsupported spreadsheet format. Please upload CSV or XLSX.');
      }

      if (rawData.length === 0) {
        throw new Error('No data rows found in the spreadsheet.');
      }

      // Auto-detect columns
      const getHeaderKey = (headers: string[], possibleNames: string[]): string | null => {
        // First try exact or normalized clean match
        for (const h of headers) {
          const cleanH = h.toLowerCase().replace(/[^a-z0-9]/g, '');
          for (const p of possibleNames) {
            const cleanP = p.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (cleanH === cleanP) {
              return h;
            }
          }
        }
        // Fallback to substring matching
        for (const h of headers) {
          const cleanH = h.toLowerCase().replace(/[^a-z0-9]/g, '');
          for (const p of possibleNames) {
            const cleanP = p.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (cleanH.includes(cleanP) || cleanP.includes(cleanH)) {
              return h;
            }
          }
        }
        return null;
      };

      const firstRowHeaders = Object.keys(rawData[0]);
      const nameCol = getHeaderKey(firstRowHeaders, ['name', 'full name', 'student name', 'employee name', 'cardholder name', 'studentname']) || 'name';
      const designationCol = getHeaderKey(firstRowHeaders, ['designation', 'role', 'class', 'grade', 'job title', 'course']) || 'designation';
      const uniqueKeyCol = getHeaderKey(firstRowHeaders, ['id', 'empid', 'rollnumber', 'roll no', 'rollno', 'employee id', 'unique key', 'admission number', 'admissionno', 'student id', 'studentid']) || 'uniqueKey';
      const imageIdCol = getHeaderKey(firstRowHeaders, ['image id', 'imageid', 'photo id', 'photoid', 'photo identifier', 'photoidentifier', 'filename', 'file name', 'image name', 'imagename']);
      const photoUrlCol = getHeaderKey(firstRowHeaders, ['photo', 'photourl', 'image', 'picture']) || 'photoUrl';

      // Build explicit smart field mappings
      const fieldMapping: Record<string, string> = {};
      const cleanString = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

      templateFieldKeys.forEach(fieldKey => {
        // 1. Try exact match
        let matchedHeader = firstRowHeaders.find(h => h === fieldKey);
        if (matchedHeader) {
          fieldMapping[fieldKey] = matchedHeader;
          return;
        }
        
        // 2. Try normalized clean match
        const cleanField = cleanString(fieldKey);
        matchedHeader = firstRowHeaders.find(h => cleanString(h) === cleanField);
        if (matchedHeader) {
          fieldMapping[fieldKey] = matchedHeader;
          return;
        }
        
        // 3. Try fuzzy/alias match for core/common fields
        const aliases: Record<string, string[]> = {
          name: ['name', 'fullname', 'studentname', 'employeename', 'cardholdername', 'username'],
          designation: ['designation', 'role', 'class', 'grade', 'jobtitle', 'course', 'branch', 'std'],
          uniquekey: ['id', 'empid', 'rollnumber', 'rollno', 'employeeid', 'uniquekey', 'admissionnumber', 'admissionno', 'studentid'],
          photourl: ['photo', 'photourl', 'image', 'picture', 'avatar'],
          bloodgroup: ['bloodgroup', 'bg', 'blood', 'bloodgrp'],
          fathername: ['fathername', 'fathersname', 'father', 'fathernm'],
          mothername: ['mothername', 'mothersname', 'mother', 'mothernm'],
          mobileno: ['mobileno', 'mobile', 'phone', 'phoneno', 'contact', 'contactno', 'mobilephone'],
          dob: ['dob', 'dateofbirth', 'birthdate', 'birth'],
          address: ['address', 'residence', 'addr']
        };
        
        const possibleAliases = aliases[cleanField] || [];
        matchedHeader = firstRowHeaders.find(h => {
          const cleanH = cleanString(h);
          return possibleAliases.includes(cleanH) || cleanH.includes(cleanField) || cleanField.includes(cleanH);
        });
        
        if (matchedHeader) {
          fieldMapping[fieldKey] = matchedHeader;
          return;
        }
        
        // 4. Try partial word match (e.g. "father" matches "Father's Name")
        matchedHeader = firstRowHeaders.find(h => {
          const cleanH = cleanString(h);
          return cleanH.includes(cleanField) || cleanField.includes(cleanH);
        });
        if (matchedHeader) {
          fieldMapping[fieldKey] = matchedHeader;
        }
      });

      console.log('[Batch Import] Auto-detected field mappings:', fieldMapping);

      // 2. Extract photos from ZIP
      setUploadStatus('Extracting photos from ZIP...');
      const JSZip = (await import('jszip')).default;
      const zip = await JSZip.loadAsync(zipFile);
      
      // Revoke any existing object URLs to avoid memory leaks
      photosMap.forEach((val) => {
        if (val.url) URL.revokeObjectURL(val.url);
      });
      const newPhotosMap = new Map<string, { blob: Blob; url: string; dataUri: string }>();
      const filePromises: Promise<void>[] = [];

      zip.forEach((relativePath, file) => {
        if (file.dir) return;
        const ext = relativePath.substring(relativePath.lastIndexOf('.')).toLowerCase();
        if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
          const baseName = relativePath.split('/').pop()?.replace(ext, '').trim() || '';
          const promise = file.async('blob').then(async (blob) => {
            const sanitizedKey = baseName.toLowerCase().replace(/[^a-zA-Z0-9_\-]/g, '_');
            const url = URL.createObjectURL(blob);
            const dataUri = await new Promise<string>((res) => {
              const r = new FileReader();
              r.onloadend = () => res(r.result as string);
              r.readAsDataURL(blob);
            });
            newPhotosMap.set(sanitizedKey, { blob, url, dataUri });
          });
          filePromises.push(promise);
        }
      });
      await Promise.all(filePromises);
      setPhotosMap(newPhotosMap);

      // Parse and construct raw JSON cardholder objects
      const parsed = rawData.map((row, index) => {
        const name = String(row[fieldMapping['name'] || nameCol] || '').trim();
        const designation = row[fieldMapping['designation'] || designationCol] ? String(row[fieldMapping['designation'] || designationCol]).trim() : null;
        const uniqueKey = row[fieldMapping['uniqueKey'] || uniqueKeyCol] ? String(row[fieldMapping['uniqueKey'] || uniqueKeyCol]).trim() : null;
        const imageId = imageIdCol ? String(row[imageIdCol] || '').trim() : null;
        const rawPhotoUrl = row[fieldMapping['photoUrl'] || photoUrlCol] ? String(row[fieldMapping['photoUrl'] || photoUrlCol]).trim() : null;

        const custom: Record<string, any> = {};
        
        // Map all mapped template fields to custom
        Object.keys(fieldMapping).forEach(templateFieldKey => {
          if (
            templateFieldKey !== 'name' &&
            templateFieldKey !== 'designation' &&
            templateFieldKey !== 'uniqueKey' &&
            templateFieldKey !== 'photoUrl'
          ) {
            const excelHeader = fieldMapping[templateFieldKey];
            custom[templateFieldKey] = row[excelHeader];
          }
        });

        // Also add any other columns from the excel into custom as fallbacks
        Object.keys(row).forEach(key => {
          if (
            key !== nameCol &&
            key !== designationCol &&
            key !== uniqueKeyCol &&
            key !== photoUrlCol &&
            (!imageIdCol || key !== imageIdCol) &&
            !Object.values(fieldMapping).includes(key)
          ) {
            custom[key] = row[key];
          }
        });

        // Try matching a photo from the zip using imageId (priority), uniqueKey, or name
        const matchKey = imageId || uniqueKey || name;
        const baseSanitized = matchKey.toLowerCase().replace(/[^a-zA-Z0-9_\-]/g, '_');
        
        let foundPhotoKey = baseSanitized;
        let hasPhoto = newPhotosMap.has(baseSanitized);
        if (!hasPhoto) {
          const photoCandidates = [
            `${baseSanitized}_photo`,
            `${baseSanitized}_image`,
            `${baseSanitized}_pic`
          ];
          for (const cand of photoCandidates) {
            if (newPhotosMap.has(cand)) {
              hasPhoto = true;
              foundPhotoKey = cand;
              break;
            }
          }
        }

        const matchedPhoto = newPhotosMap.get(foundPhotoKey);
        const photoUrl = (hasPhoto && matchedPhoto) ? (matchedPhoto.dataUri || matchedPhoto.url) : rawPhotoUrl;

        // Map custom sub-images (e.g. signature, parent photo, etc.) from the zip file
        newPhotosMap.forEach((val, key) => {
          if (key.startsWith(`${baseSanitized}_`)) {
            const suffix = key.substring(baseSanitized.length + 1); // e.g. "signature"
            if (suffix && suffix !== 'photo' && suffix !== 'image' && suffix !== 'pic') {
              custom[suffix] = val.dataUri || val.url;
            }
          } else if (key.startsWith(`${baseSanitized}-`)) {
            const suffix = key.substring(baseSanitized.length + 1);
            if (suffix && suffix !== 'photo' && suffix !== 'image' && suffix !== 'pic') {
              custom[suffix] = val.dataUri || val.url;
            }
          }
        });

        let recordId = index;
        if (uniqueKey) {
          const parsedId = parseInt(uniqueKey, 10);
          if (!isNaN(parsedId)) {
            recordId = parsedId;
          }
        }

        return {
          id: recordId,
          name,
          designation,
          uniqueKey,
          photoUrl,
          customFields: custom,
          hasPhoto,
          sanitizedKey: foundPhotoKey,
          imageId
        };
      }).filter(c => c.name);

      setParsedCardholders(parsed);
      setSelectedPreviewIndexes(parsed.map((_, i) => i));
      setBatchWizardStep(2);
    } catch (err: any) {
      setError(err.message || 'Error parsing files');
    } finally {
      setSubmitting(false);
      setUploadStatus('');
    }
  };

  const handleGenerateApprovalProof = async () => {
    setError('');
    setUploadStatus('Generating Approval Proof PDF...');
    setUploadProgress({ current: 0, total: selectedPreviewIndexes.length });
    setSubmitting(true);

    try {
      const selectedTemplate = templates.find(t => String(t.id) === templateId);
      if (!selectedTemplate) throw new Error('Template not found');

      const selectedClient = clients.find(c => String(c.id) === clientId);
      const clientName = selectedClient ? selectedClient.name : 'Client';
      const deptName = selectedTemplate.name;

      const selectedCards = parsedCardholders.filter((_, idx) => selectedPreviewIndexes.includes(idx));
      if (selectedCards.length === 0) {
        throw new Error('Please select at least one record to print.');
      }

      // Fetch fonts
      setUploadStatus('Loading fonts...');
      const fontsRes = await fetch('/api/fonts', {
        headers: { 'x-press-id': String(pressId || '') }
      });
      let pressFonts = [];
      if (fontsRes.ok) {
        const fontsJson = await fontsRes.json();
        pressFonts = fontsJson.fonts || [];
      }

      // Map to correct parameter format
      const cardholdersForPdf = selectedCards.map(c => {
        const matchedPhoto = photosMap.get(c.sanitizedKey);
        return {
          id: c.uniqueKey || c.id,
          name: c.name,
          designation: c.designation || null,
          photoUrl: c.hasPhoto && matchedPhoto ? (matchedPhoto.dataUri || matchedPhoto.url) : (c.photoUrl || null),
          cardSerial: c.cardSerial || null,
          uniqueKey: c.uniqueKey || null,
          customFields: c.customFields ? JSON.stringify(c.customFields) : null,
        };
      });

      setUploadStatus('Assembling pages...');
      const pdfBlob = await generateApprovalPdfClient(
        clientName,
        deptName,
        selectedTemplate,
        cardholdersForPdf,
        pressFonts
      );

      const fileName = `Approval_Proof_${clientName.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
      const electronAPI = typeof window !== 'undefined' && (window as any).electronAPI;
      if (electronAPI) {
        setUploadStatus('Saving PDF locally via Desktop bridge...');
        const base64Data = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const dataUrl = reader.result as string;
            const base64 = dataUrl.split(',')[1];
            resolve(base64);
          };
          reader.readAsDataURL(pdfBlob);
        });

        const saveRes = await electronAPI.savePdfLocally(fileName, base64Data, clientName);
        if (!saveRes.success) {
          throw new Error(saveRes.error || 'Failed to save PDF locally');
        }
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

      setUploadStatus('Success!');
      setTimeout(() => setUploadStatus(''), 2000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to generate approval proof');
    } finally {
      setSubmitting(false);
    }
  };

  // Sheet size dimensions in points (1mm = 2.8346pt)
  const getSheetDimensions = () => {
    const MM_TO_PT = 2.8346;
    switch (paperSize) {
      case 'A4':   return { w: 595.27, h: 841.89 };
      case 'A3':   return { w: 841.89, h: 1190.55 };
      case 'SRA3': return { w: 907.09, h: 1275.59 };
      case '13x19':return { w: 936,    h: 1368 };
      case 'CUSTOM': return {
        w: Number(customSheetWidthMm) * MM_TO_PT || 907.09,
        h: Number(customSheetHeightMm) * MM_TO_PT || 1275.59,
      };
      default: return { w: 907.09, h: 1275.59 };
    }
  };

  // Pre-print validation: returns missing-field report
  const runPrePrintValidation = (cards: any[], template: any) => {
    let frontFields: any[] = [];
    let backFields: any[] = [];
    try { frontFields = JSON.parse(template.frontFields || '[]'); } catch {}
    try { backFields = JSON.parse(template.backFields || '[]'); } catch {}
    const requiredFields = [...frontFields, ...backFields]
      .filter((f: any) => f.required || f.isRequired)
      .map((f: any) => f.field as string);

    const missingFields: Array<{ index: number; name: string; fields: string[] }> = [];
    cards.forEach((card, idx) => {
      const customData = card.customFields || {};
      const missing = requiredFields.filter(field => {
        const val = card[field] ?? customData[field];
        return !val || String(val).trim() === '';
      });
      if (missing.length > 0) {
        missingFields.push({ index: idx, name: card.name || `Record ${idx + 1}`, fields: missing });
      }
    });

    // Calculate slots
    const { w: pageW, h: pageH } = getSheetDimensions();
    const bleedPt = Number(bleedMm) * 2.83464567;
    const selectedTemplate = template;
    const isPortrait = (selectedTemplate.cardWidth || 673) < (selectedTemplate.cardHeight || 1039);
    const cardBaseW = isPortrait ? 153 : 242.6;
    const cardBaseH = isPortrait ? 242.6 : 153;
    const cW = cardBaseW + bleedPt * 2;
    const cH = cardBaseH + bleedPt * 2;
    const marginX = 28.35; // 10mm
    const marginY = 28.35;
    const gap = 5.67;     // 2mm
    const isSingleSided = !selectedTemplate.backImageUrl;
    const cols = Math.max(1, Math.floor((pageW - marginX * 2 + gap) / (cW + gap)));
    let rowsPerPage: number;
    if (isSingleSided) {
      rowsPerPage = Math.max(1, Math.floor((pageH - marginY * 2 + gap) / (cH + gap)));
    } else {
      const halfH = pageH / 2 - marginY;
      rowsPerPage = Math.max(1, Math.floor((halfH - 10 + gap) / (cH + gap)));
    }
    const cardsPerPage = cols * rowsPerPage;
    const totalPages = Math.ceil(cards.length / cardsPerPage);
    const totalSlots = totalPages * cardsPerPage;

    return { missingFields, totalCards: cards.length, totalSlots };
  };

  const handleGenerateProductionPdf = async (skipValidation = false, slotStrategy: 'leave_blank' | 'repeat_last' | 'repeat_first' = 'leave_blank') => {
    setError('');
    setSubmitting(true);

    try {
      const selectedTemplate = templates.find(t => String(t.id) === templateId);
      if (!selectedTemplate) throw new Error('Template not found');

      const selectedCards = parsedCardholders.filter((_, idx) => selectedPreviewIndexes.includes(idx));
      if (selectedCards.length === 0) {
        throw new Error('Please select at least one record to print.');
      }

      // ── Step 1: Pre-print validation (unless skipped) ──────────────────────
      if (!skipValidation) {
        const validation = runPrePrintValidation(selectedCards, selectedTemplate);
        setPrePrintValidationResult(validation);
        if (validation.missingFields.length > 0) {
          setShowValidationModal(true);
          setPendingGenerationType('production');
          setSubmitting(false);
          return;
        }
        // ── Step 2: Empty slot check ──────────────────────────────────────────
        if (validation.totalSlots > validation.totalCards) {
          setShowEmptySlotModal(true);
          setPendingGenerationType('production');
          setSubmitting(false);
          return;
        }
      }

      setUploadStatus('Generating Production PDF...');
      setUploadProgress({ current: 0, total: selectedCards.length });

      // Fetch fonts
      setUploadStatus('Loading fonts...');
      const fontsRes = await fetch('/api/fonts', {
        headers: { 'x-press-id': String(pressId || '') }
      });
      let pressFonts = [];
      if (fontsRes.ok) {
        const fontsJson = await fontsRes.json();
        pressFonts = fontsJson.fonts || [];
      }

      // Map to correct parameter format
      const cardholdersForPdf = selectedCards.map(c => {
        const matchedPhoto = photosMap.get(c.sanitizedKey);
        return {
          id: c.uniqueKey || c.id,
          name: c.name,
          designation: c.designation || null,
          photoUrl: c.hasPhoto && matchedPhoto ? (matchedPhoto.dataUri || matchedPhoto.url) : (c.photoUrl || null),
          cardSerial: c.cardSerial || null,
          uniqueKey: c.uniqueKey || null,
          customFields: c.customFields ? JSON.stringify(c.customFields) : null,
        };
      });

      const electronAPI = typeof window !== 'undefined' && (window as any).electronAPI;
      if (electronAPI) {
        setUploadStatus('Caching photos locally...');
        setUploadProgress({ current: 0, total: cardholdersForPdf.length });
        for (let i = 0; i < cardholdersForPdf.length; i++) {
          const ch = cardholdersForPdf[i];
          if (ch.photoUrl) {
            try {
              setUploadStatus(`Caching photo ${i + 1} of ${cardholdersForPdf.length}...`);
              setUploadProgress({ current: i, total: cardholdersForPdf.length });
              const res = await electronAPI.cachePhoto(ch.id, ch.photoUrl);
              if (res && res.success && res.localUrl) {
                ch.photoUrl = res.localUrl;
              }
            } catch (err: any) {
              console.warn(`Failed to cache photo locally for cardholder ${ch.id}:`, err);
            }
          }
        }
      }

      setUploadStatus('Compiling print-ready sheets...');
      const bleedPt = Number(bleedMm) * 2.83464567; // mm to points
      const { w: customW, h: customH } = getSheetDimensions();

      // Apply empty slot fill strategy
      let cardsToRender = [...cardholdersForPdf];
      if (slotStrategy === 'repeat_last' && cardsToRender.length > 0) {
        const lastCard = cardsToRender[cardsToRender.length - 1];
        const validation = prePrintValidationResult;
        if (validation && validation.totalSlots > cardsToRender.length) {
          const fillCount = validation.totalSlots - cardsToRender.length;
          for (let i = 0; i < fillCount; i++) cardsToRender.push(lastCard);
        }
      } else if (slotStrategy === 'repeat_first' && cardsToRender.length > 0) {
        const firstCard = cardsToRender[0];
        const validation = prePrintValidationResult;
        if (validation && validation.totalSlots > cardsToRender.length) {
          const fillCount = validation.totalSlots - cardsToRender.length;
          for (let i = 0; i < fillCount; i++) cardsToRender.push(firstCard);
        }
      }

      const pdfBlob = await generateProductionPdfClient(
        selectedTemplate,
        cardsToRender,
        {
          paperSize: paperSize === 'SRA3' || paperSize === '13x19' || paperSize === 'CUSTOM' ? 'CUSTOM' : paperSize,
          orientation,
          bleed: bleedPt,
          cropMarks,
          foldLine,
          customWidth:  paperSize === 'SRA3' ? 907.09 : paperSize === '13x19' ? 936 : paperSize === 'CUSTOM' ? customW : undefined,
          customHeight: paperSize === 'SRA3' ? 1275.59 : paperSize === '13x19' ? 1368 : paperSize === 'CUSTOM' ? customH : undefined,
        },
        pressFonts,
        (percent) => {
          setUploadProgress({ current: Math.round((percent / 100) * selectedPreviewIndexes.length), total: selectedPreviewIndexes.length });
        }
      );

      const selectedClient = clients.find(c => String(c.id) === clientId);
      const clientName = selectedClient ? selectedClient.name : 'Client';

      const fileName = `Production_Print_${clientName.replace(/\s+/g, '_')}_${paperSize}_${Date.now()}.pdf`;
      if (electronAPI) {
        setUploadStatus('Saving PDF locally via Desktop bridge...');
        const base64Data = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const dataUrl = reader.result as string;
            const base64 = dataUrl.split(',')[1];
            resolve(base64);
          };
          reader.readAsDataURL(pdfBlob);
        });

        const saveRes = await electronAPI.savePdfLocally(fileName, base64Data, clientName);
        if (!saveRes.success) {
          throw new Error(saveRes.error || 'Failed to save PDF locally');
        }
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

      setUploadStatus('Success!');
      setTimeout(() => setUploadStatus(''), 2000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to generate production PDF');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT': return <span className="badge badge-primary">Draft</span>;
      case 'APPROVAL_PDF_SENT': return <span className="badge badge-warning">Approval Sent</span>;
      case 'APPROVED': return <span className="badge badge-success">Approved</span>;
      case 'PRINTING': return <span className="badge badge-warning">Printing</span>;
      case 'DELIVERED': return <span className="badge badge-success">Delivered</span>;
      default: return <span className="badge badge-primary">{status}</span>;
    }
  };

  const renderBatchWizard = () => {
    const steps = [
      { number: 1, name: 'Upload Data', desc: 'Spreadsheet & Photos ZIP' },
      { number: 2, name: 'Roster Preview', desc: 'Verify & Filter Students' },
      { number: 3, name: 'Print Layout', desc: 'Sheet Config & PDF Output' }
    ];

    const totalCount = parsedCardholders.length;
    const matchedCount = parsedCardholders.filter(c => c.hasPhoto).length;
    const missingCount = totalCount - matchedCount;

    const filteredCardholders = parsedCardholders
      .map((c, idx) => ({ ...c, originalIndex: idx }))
      .filter(c => {
        if (!rosterSearch.trim()) return true;
        const q = rosterSearch.toLowerCase();
        return (
          (c.name || '').toLowerCase().includes(q) ||
          (c.uniqueKey || '').toLowerCase().includes(q) ||
          (c.designation || '').toLowerCase().includes(q)
        );
      });

    const selectedTemplate = templates.find(t => String(t.id) === templateId);
    const selectedCards = parsedCardholders.filter((_, idx) => selectedPreviewIndexes.includes(idx));
    const validationResult = (selectedTemplate && selectedCards.length > 0)
      ? runPrePrintValidation(selectedCards, selectedTemplate)
      : null;

    const totalSlots = validationResult ? validationResult.totalSlots : 0;
    const emptySlots = validationResult ? Math.max(0, totalSlots - selectedCards.length) : 0;
    const hasMissingFields = validationResult ? validationResult.missingFields.length > 0 : false;

    const renderStepHeader = () => (
      <div className="glass-panel" style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', width: '100%', border: '1px solid var(--glass-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button 
            type="button" 
            className="btn btn-secondary" 
            style={{ padding: '8px 12px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)' }}
            onClick={() => {
              if (batchWizardStep === 1) {
                setShowForm(false);
              } else {
                setBatchWizardStep(prev => (prev - 1) as any);
              }
            }}
          >
            <ArrowLeft size={16} style={{ marginRight: '6px' }} /> Back
          </button>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>Batch Import & Print Wizard</h2>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--muted)' }}>
              Step {batchWizardStep} of 3: {steps[batchWizardStep - 1].name} — {steps[batchWizardStep - 1].desc}
            </p>
          </div>
        </div>

        {/* Stepper Steps */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {steps.map((st, i) => {
            const stepNum = i + 1;
            const isActive = batchWizardStep === stepNum;
            const isCompleted = batchWizardStep > stepNum;
            return (
              <React.Fragment key={stepNum}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: isActive ? 1 : isCompleted ? 0.8 : 0.4 }}>
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '50%',
                    background: isActive ? 'var(--primary)' : isCompleted ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)',
                    border: isActive ? 'none' : isCompleted ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.85rem', fontWeight: 'bold', color: isActive ? '#000' : isCompleted ? '#10b981' : '#fff'
                  }}>
                    {isCompleted ? <Check size={14} /> : stepNum}
                  </div>
                  <div style={{ fontSize: '0.85rem', fontWeight: isActive ? 600 : 400 }}>{st.name}</div>
                </div>
                {i < steps.length - 1 && (
                  <div style={{ width: '40px', height: '1px', background: batchWizardStep > stepNum ? '#10b981' : 'rgba(255,255,255,0.1)' }} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    );

    const renderStep1 = () => (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '24px' }}>
        {/* Left Column: Settings */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px' }}>1. Registry & Invoicing Details</h3>
          
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px' }}>
            <button 
              type="button" 
              className="btn btn-secondary"
              style={{ padding: '4px 8px', fontSize: '0.72rem', flex: 1 }}
              onClick={() => setOrderMethod('standard')}
            >
              Standard Form
            </button>
            <button 
              type="button" 
              className="btn btn-primary"
              style={{ padding: '4px 8px', fontSize: '0.72rem', flex: 1 }}
              onClick={() => setOrderMethod('batch')}
            >
              Batch Wizard
            </button>
          </div>

          <div className="form-group">
            <label className="form-label">Client Registry Folder</label>
            <select className="form-select" value={clientId} onChange={e => setClientId(e.target.value)}>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Card Template</label>
            <select className="form-select" value={templateId} onChange={e => setTemplateId(e.target.value)}>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name} (v{t.version})</option>)}
            </select>
          </div>

          {isOwner && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Price Per Card (Rs)</label>
                <input type="number" required className="form-input" value={pricePerCard} onChange={e => setPricePerCard(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">GST / Tax (%)</label>
                <input type="number" required className="form-input" value={taxPercent} onChange={e => setTaxPercent(e.target.value)} />
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Card Expiry Validity Date</label>
            <input 
              type="date" 
              required 
              className="form-input" 
              value={validTill} 
              onChange={e => setValidTill(e.target.value)} 
              onClick={(e) => {
                try {
                  e.currentTarget.showPicker();
                } catch (err) {
                  console.warn('showPicker is not supported:', err);
                }
              }}
            />
          </div>

          <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--muted)', margin: 0 }}>
              Setting correct pricing and templates is crucial for invoice generation and layout constraints.
            </p>
          </div>
        </div>

        {/* Right Column: Files Upload */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px' }}>2. Import Student Registry & Photos</h3>

          {error && (
            <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f77', borderRadius: '6px', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileText size={16} /> Excel / CSV Student Database
              </label>
              <input type="file" required accept=".xlsx,.xls,.csv" className="form-input" onChange={e => setExcelFile(e.target.files?.[0] || null)} />
              <p style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '4px' }}>
                Spreadsheet must contain student details. Key fields (Name, Designation, ID) will be fuzzy-matched automatically.
              </p>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ImageIcon size={16} /> Photos ZIP Archive
              </label>
              <input type="file" required accept=".zip" className="form-input" onChange={e => setZipFile(e.target.files?.[0] || null)} />
              <p style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '4px' }}>
                ZIP file containing photos named after the student unique ID or name (e.g. <code>101.jpg</code> or <code>john_doe.png</code>).
              </p>
            </div>
          </div>

          {uploadStatus && (
            <div style={{ background: 'rgba(255,255,255,0.04)', padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '6px', color: 'var(--primary)' }}>
                <span>{uploadStatus}</span>
                {uploadProgress.total > 0 && <span>{uploadProgress.current} / {uploadProgress.total}</span>}
              </div>
              {uploadProgress.total > 0 && (
                <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: 'var(--primary)', width: `${(uploadProgress.current / uploadProgress.total) * 100}%`, transition: 'width 0.2s' }} />
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: 'auto', display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '20px' }}>
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={() => {
                setShowForm(false);
                setExcelFile(null);
                setZipFile(null);
                setUploadStatus('');
              }}
            >
              Cancel
            </button>
            <button 
              type="button" 
              className="btn btn-primary" 
              disabled={submitting || !excelFile || !zipFile} 
              onClick={handleAnalyzeBatchFiles}
            >
              {submitting ? 'Analyzing & Matching...' : 'Analyze & Match Files'}
            </button>
          </div>
        </div>
      </div>
    );

    const renderStep2 = () => (
      <div style={{ display: 'flex', gap: '20px', width: '100%', alignItems: 'stretch' }}>
        {/* Left Side: Table & Search */}
        <div className="glass-panel" style={{ 
          flex: selectedCardholderForDetails ? '0 0 60%' : '1 1 100%', 
          transition: 'all 0.3s ease-in-out',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          overflow: 'hidden'
        }}>
          {/* Search bar & statistics */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
              <Search size={16} color="var(--muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type="text" 
                className="form-input" 
                placeholder="Search by student name, ID, designation..." 
                style={{ paddingLeft: '36px', height: '36px', fontSize: '0.85rem' }}
                value={rosterSearch}
                onChange={e => setRosterSearch(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px', fontSize: '0.78rem' }}>
              <span style={{ background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '4px' }}>
                Total: <strong>{totalCount}</strong>
              </span>
              <span style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', padding: '4px 8px', borderRadius: '4px' }}>
                Photos Matched: <strong>{matchedCount}</strong>
              </span>
              {missingCount > 0 && (
                <span style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', padding: '4px 8px', borderRadius: '4px' }}>
                  Missing: <strong>{missingCount}</strong>
                </span>
              )}
            </div>
          </div>

          {/* Selection indicator & global toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '6px', fontSize: '0.8rem', border: '1px solid rgba(255,255,255,0.04)' }}>
            <div>
              Selected: <strong>{selectedPreviewIndexes.length}</strong> / {totalCount} cardholder(s)
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                style={{ padding: '2px 8px', fontSize: '0.72rem', background: 'transparent', border: 'none' }}
                onClick={() => setSelectedPreviewIndexes(parsedCardholders.map((_, i) => i))}
              >
                Select All
              </button>
              <button 
                type="button" 
                className="btn btn-secondary" 
                style={{ padding: '2px 8px', fontSize: '0.72rem', background: 'transparent', border: 'none' }}
                onClick={() => setSelectedPreviewIndexes([])}
              >
                Clear Selection
              </button>
            </div>
          </div>

          {/* Roster Scrollable Table */}
          <div style={{ overflowY: 'auto', flex: 1, maxHeight: '55vh', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }} className="custom-table">
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <th style={{ width: '40px', padding: '10px 12px' }}>
                    <input 
                      type="checkbox"
                      checked={selectedPreviewIndexes.length === parsedCardholders.length && parsedCardholders.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedPreviewIndexes(parsedCardholders.map((_, i) => i));
                        } else {
                          setSelectedPreviewIndexes([]);
                        }
                      }}
                    />
                  </th>
                  <th style={{ padding: '10px 12px', width: '60px' }}>Photo</th>
                  <th style={{ padding: '10px 12px' }}>Name</th>
                  <th style={{ padding: '10px 12px' }}>ID / Roll No</th>
                  <th style={{ padding: '10px 12px' }}>Designation</th>
                  <th style={{ padding: '10px 12px', width: '130px' }}>Status</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', width: '100px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredCardholders.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)' }}>
                      No matching records found.
                    </td>
                  </tr>
                ) : (
                  filteredCardholders.map((c) => {
                    const isSelected = selectedPreviewIndexes.includes(c.originalIndex);
                    const photoData = photosMap.get(c.sanitizedKey);
                    return (
                      <tr 
                        key={c.originalIndex}
                        style={{
                          borderBottom: '1px solid rgba(255,255,255,0.05)',
                          background: isSelected ? 'rgba(255,255,255,0.01)' : 'transparent',
                          opacity: isSelected ? 1 : 0.55,
                          transition: 'opacity 0.2s'
                        }}
                      >
                        <td style={{ padding: '10px 12px' }}>
                          <input 
                            type="checkbox" 
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedPreviewIndexes(prev => [...prev, c.originalIndex]);
                              } else {
                                setSelectedPreviewIndexes(prev => prev.filter(idx => idx !== c.originalIndex));
                              }
                            }}
                          />
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          {c.hasPhoto && photoData ? (
                            <img 
                              src={photoData.url} 
                              alt={c.name} 
                              style={{ width: '32px', height: '32px', borderRadius: '4px', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.1)' }}
                            />
                          ) : (
                            <div style={{ width: '32px', height: '32px', borderRadius: '4px', background: 'rgba(239,68,68,0.1)', border: '1px dashed rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff6b6b' }}>
                              <ImageIcon size={14} />
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 500 }}>{c.name}</td>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{c.uniqueKey || '—'}</td>
                        <td style={{ padding: '10px 12px' }}>{c.designation || '—'}</td>
                        <td style={{ padding: '10px 12px' }}>
                          {c.hasPhoto ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 600 }}>
                              <CheckCircle size={10} /> Photo Matched
                            </span>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '2px 8px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 600 }}>
                              <AlertTriangle size={10} /> Missing Photo
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                          <button 
                            type="button" 
                            className="btn btn-secondary" 
                            style={{ padding: '4px 8px', fontSize: '0.75rem', border: '1px solid rgba(255,255,255,0.1)' }}
                            onClick={() => {
                              setSelectedCardholderForDetails(c);
                              setSelectedCardholderIndexForDetails(c.originalIndex);
                              setIsEditingDetail(false);
                              setDetailsPreviewSide('front');
                            }}
                          >
                            <Eye size={12} style={{ marginRight: '4px' }} /> Details
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifySelf: 'flex-end', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '10px' }}>
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={() => {
                setBatchWizardStep(1);
                setSelectedCardholderForDetails(null);
                setSelectedCardholderIndexForDetails(null);
              }}
            >
              Back to Upload
            </button>
            <button 
              type="button" 
              className="btn btn-primary" 
              disabled={selectedPreviewIndexes.length === 0}
              onClick={() => {
                setBatchWizardStep(3);
                setAcceptMissingFields(false);
                setSelectedCardholderForDetails(null);
                setSelectedCardholderIndexForDetails(null);
              }}
            >
              Next: Configure Layout
            </button>
          </div>
        </div>

        {/* Right Side: Edit Details Side Panel Drawer */}
        {selectedCardholderForDetails && (
          <div className="glass-panel" style={{ 
            flex: '0 0 40%', 
            padding: '20px', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '16px',
            borderLeft: '1px solid var(--glass-border)',
            boxShadow: '-10px 0 30px rgba(0,0,0,0.3)',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--primary)' }}>
                {isEditingDetail ? 'Edit Student Details' : 'Student Audit & Preview'}
              </h3>
              <button 
                type="button" 
                style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}
                onClick={() => {
                  setSelectedCardholderForDetails(null);
                  setSelectedCardholderIndexForDetails(null);
                  setIsEditingDetail(false);
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Card Preview Renderer */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ 
                height: '240px', 
                background: 'rgba(0,0,0,0.3)', 
                borderRadius: '8px', 
                border: '1px solid rgba(255,255,255,0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '12px'
              }}>
                {(() => {
                  if (!selectedTemplate) return <div style={{ color: 'var(--muted)' }}>No template selected</div>;
                  const photoData = photosMap.get(selectedCardholderForDetails.sanitizedKey);
                  const previewCh = {
                    id: selectedCardholderForDetails.id,
                    name: selectedCardholderForDetails.name,
                    designation: selectedCardholderForDetails.designation,
                    photoUrl: selectedCardholderForDetails.hasPhoto && photoData ? photoData.url : null,
                    uniqueKey: selectedCardholderForDetails.uniqueKey || null,
                    cardSerial: selectedCardholderForDetails.cardSerial || null,
                    customFields: JSON.stringify(selectedCardholderForDetails.customFields || {})
                  };
                  return (
                    <CardPreview 
                      template={selectedTemplate}
                      cardholder={previewCh}
                      side={detailsPreviewSide}
                      pressFonts={loadedPressFonts}
                      validTill={validTill}
                      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                    />
                  );
                })()}
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  type="button" 
                  className={`btn ${detailsPreviewSide === 'front' ? 'btn-primary' : 'btn-secondary'}`} 
                  style={{ flex: 1, padding: '4px 8px', fontSize: '0.75rem' }}
                  onClick={() => setDetailsPreviewSide('front')}
                >
                  Front
                </button>
                {selectedTemplate?.backImageUrl && (
                  <button 
                    type="button" 
                    className={`btn ${detailsPreviewSide === 'back' ? 'btn-primary' : 'btn-secondary'}`} 
                    style={{ flex: 1, padding: '4px 8px', fontSize: '0.75rem' }}
                    onClick={() => setDetailsPreviewSide('back')}
                  >
                    Back
                  </button>
                )}
              </div>
            </div>

            {/* Field Inputs / Values */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Full Name</label>
                {isEditingDetail ? (
                  <input 
                    type="text" 
                    className="form-input" 
                    style={{ height: '32px', fontSize: '0.8rem' }}
                    value={selectedCardholderForDetails.name || ''} 
                    onChange={e => setSelectedCardholderForDetails((prev: any) => ({ ...prev, name: e.target.value }))}
                  />
                ) : (
                  <div style={{ fontSize: '0.85rem', fontWeight: 500, padding: '6px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px' }}>
                    {selectedCardholderForDetails.name || '—'}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.75rem' }}>ID / Roll Number</label>
                {isEditingDetail ? (
                  <input 
                    type="text" 
                    className="form-input" 
                    style={{ height: '32px', fontSize: '0.8rem' }}
                    value={selectedCardholderForDetails.uniqueKey || ''} 
                    onChange={e => setSelectedCardholderForDetails((prev: any) => ({ ...prev, uniqueKey: e.target.value }))}
                  />
                ) : (
                  <div style={{ fontSize: '0.85rem', fontFamily: 'monospace', padding: '6px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px' }}>
                    {selectedCardholderForDetails.uniqueKey || '—'}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Designation</label>
                {isEditingDetail ? (
                  <input 
                    type="text" 
                    className="form-input" 
                    style={{ height: '32px', fontSize: '0.8rem' }}
                    value={selectedCardholderForDetails.designation || ''} 
                    onChange={e => setSelectedCardholderForDetails((prev: any) => ({ ...prev, designation: e.target.value }))}
                  />
                ) : (
                  <div style={{ fontSize: '0.85rem', padding: '6px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px' }}>
                    {selectedCardholderForDetails.designation || '—'}
                  </div>
                )}
              </div>

              {/* Dynamic Excel Custom Fields */}
              {Object.entries(selectedCardholderForDetails.customFields || {}).map(([k, val]) => (
                <div className="form-group" key={k}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>{formatFieldLabel(k)}</label>
                  {isEditingDetail ? (
                    typeof val === 'string' && val.startsWith('blob:') ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <img src={val} alt={k} style={{ height: '32px', borderRadius: '4px' }} />
                        <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>Image Asset</span>
                      </div>
                    ) : (
                      <input 
                        type="text" 
                        className="form-input" 
                        style={{ height: '32px', fontSize: '0.8rem' }}
                        value={String(val || '')} 
                        onChange={e => {
                          const newVal = e.target.value;
                          setSelectedCardholderForDetails((prev: any) => ({
                            ...prev,
                            customFields: { ...prev.customFields, [k]: newVal }
                          }));
                        }}
                      />
                    )
                  ) : (
                    <div style={{ fontSize: '0.85rem', padding: '6px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px', minHeight: '30px' }}>
                      {typeof val === 'string' && val.startsWith('blob:') ? (
                        <img src={val} alt={k} style={{ height: '32px', borderRadius: '4px' }} />
                      ) : (
                        String(val || '') || <em style={{ color: 'var(--muted)' }}>empty</em>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Sidebar actions */}
            <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '12px', marginTop: 'auto' }}>
              {isEditingDetail ? (
                <>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    style={{ flex: 1 }}
                    onClick={() => {
                      if (selectedCardholderIndexForDetails !== null) {
                        setSelectedCardholderForDetails(parsedCardholders[selectedCardholderIndexForDetails]);
                      }
                      setIsEditingDetail(false);
                    }}
                  >
                    Cancel
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-primary" 
                    style={{ flex: 1 }}
                    onClick={handleSaveCardholderEdit}
                  >
                    Save
                  </button>
                </>
              ) : (
                <>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    style={{ flex: 1, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent' }}
                    onClick={() => setIsEditingDetail(true)}
                  >
                    Edit Fields
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-primary" 
                    style={{ flex: 1 }}
                    onClick={() => {
                      setSelectedCardholderForDetails(null);
                      setSelectedCardholderIndexForDetails(null);
                    }}
                  >
                    Done
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );

    const renderStep3 = () => (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '24px' }}>
        {/* Left Column: Layout Configuration */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px' }}>1. Sheet Layout & Crop Marks</h3>
          
          <div className="form-group">
            <label className="form-label">Paper Sheet Size</label>
            <select className="form-select" value={paperSize} onChange={e => setPaperSize(e.target.value as any)}>
              <option value="SRA3">SRA3 — 320×450mm ★ Recommended</option>
              <option value="13x19">13×19 inch — 330×483mm</option>
              <option value="A3">A3 — 297×420mm</option>
              <option value="A4">A4 (Standard Office)</option>
              <option value="CUSTOM">Custom Dimensions (mm)</option>
            </select>
          </div>

          {paperSize === 'CUSTOM' && (
            <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
              <input
                type="number" min="100" max="700"
                className="form-input" style={{ padding: '4px 8px', fontSize: '0.8rem', flex: 1 }}
                placeholder="W (mm)" value={customSheetWidthMm}
                onChange={e => setCustomSheetWidthMm(e.target.value)}
              />
              <span style={{ alignSelf: 'center', color: 'var(--muted)', fontSize: '0.8rem' }}>×</span>
              <input
                type="number" min="100" max="1000"
                className="form-input" style={{ padding: '4px 8px', fontSize: '0.8rem', flex: 1 }}
                placeholder="H (mm)" value={customSheetHeightMm}
                onChange={e => setCustomSheetHeightMm(e.target.value)}
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Sheet Orientation</label>
            <select className="form-select" value={orientation} onChange={e => setOrientation(e.target.value as any)}>
              <option value="PORTRAIT">Portrait (Vertical)</option>
              <option value="LANDSCAPE">Landscape (Horizontal)</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Card Bleed Margin (mm)</label>
            <input type="number" step="0.5" className="form-input" value={bleedMm} onChange={e => setBleedMm(e.target.value)} />
            <p style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '4px' }}>
              Extra printed boundary around card edges to ensure clean cuts without white borders (typically 2-3mm).
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
              <input type="checkbox" checked={cropMarks} onChange={e => setCropMarks(e.target.checked)} />
              <span>Include Print Crop Marks (Cutting Guides)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
              <input type="checkbox" checked={foldLine} onChange={e => setFoldLine(e.target.checked)} />
              <span>Include Sheet Center Fold/Creasing Line</span>
            </label>
          </div>
        </div>

        {/* Right Column: Calculations & Validation Check & PDF Generation */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px' }}>2. Audit Summary & Compile Output</h3>

          {/* Calculations widget */}
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary)' }}>Sheet Capacity Analysis</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.8rem' }}>
              <div>Selected Cards: <strong>{selectedCards.length}</strong></div>
              <div>Sheet Capacity: <strong>{totalSlots} slots</strong></div>
              <div>Empty Slots: <strong style={{ color: emptySlots > 0 ? 'var(--primary)' : 'inherit' }}>{emptySlots} slots</strong></div>
              <div>Orientation: <strong>{orientation}</strong></div>
            </div>

            {/* Empty Slot strategy choice */}
            {emptySlots > 0 && (
              <div style={{ marginTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
                <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '6px' }}>Empty Slot Fill Strategy</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.8rem' }}>
                    <input 
                      type="radio" 
                      name="strategy" 
                      value="leave_blank" 
                      checked={emptySlotStrategy === 'leave_blank'} 
                      onChange={() => setEmptySlotStrategy('leave_blank')} 
                    />
                    <span>Leave Blank (Print nothing in empty slots)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.8rem' }}>
                    <input 
                      type="radio" 
                      name="strategy" 
                      value="repeat_last" 
                      checked={emptySlotStrategy === 'repeat_last'} 
                      onChange={() => setEmptySlotStrategy('repeat_last')} 
                    />
                    <span>Repeat Last Cardholder ({selectedCards[selectedCards.length - 1]?.name || 'Last Record'})</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.8rem' }}>
                    <input 
                      type="radio" 
                      name="strategy" 
                      value="repeat_first" 
                      checked={emptySlotStrategy === 'repeat_first'} 
                      onChange={() => setEmptySlotStrategy('repeat_first')} 
                    />
                    <span>Repeat First Cardholder ({selectedCards[0]?.name || 'First Record'})</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Validation warnings widget */}
          {hasMissingFields && validationResult && (
            <div style={{ background: 'rgba(245,158,11,0.08)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(245,158,11,0.2)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f59e0b', fontSize: '0.85rem', fontWeight: 600 }}>
                <AlertTriangle size={16} />
                <span>Missing Required Fields Detected</span>
              </div>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--muted)' }}>
                <strong>{validationResult.missingFields.length} cardholder(s)</strong> have incomplete required template fields. Review list below:
              </p>
              <div style={{ maxHeight: '100px', overflowY: 'auto', border: '1px solid rgba(245,158,11,0.15)', borderRadius: '4px', background: 'rgba(0,0,0,0.2)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.02)', textAlign: 'left', borderBottom: '1px solid rgba(245,158,11,0.15)' }}>
                      <th style={{ padding: '4px 8px' }}>Cardholder</th>
                      <th style={{ padding: '4px 8px' }}>Missing Fields</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validationResult.missingFields.map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                        <td style={{ padding: '4px 8px', fontWeight: 500 }}>{row.name}</td>
                        <td style={{ padding: '4px 8px', color: '#ff8a8a' }}>
                          {row.fields.map(formatFieldLabel).join(', ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.8rem', color: '#fff', marginTop: '4px' }}>
                <input type="checkbox" checked={acceptMissingFields} onChange={e => setAcceptMissingFields(e.target.checked)} />
                <span style={{ fontWeight: 500 }}>Confirm: print with empty fields anyway</span>
              </label>
            </div>
          )}

          {/* In-Wizard Progress / Status Indicator */}
          {uploadStatus && (
            <div style={{ background: 'rgba(255,255,255,0.04)', padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '6px', color: 'var(--primary)' }}>
                <span>{uploadStatus}</span>
                {uploadProgress.total > 0 && <span>{uploadProgress.current} / {uploadProgress.total}</span>}
              </div>
              {uploadProgress.total > 0 && (
                <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: 'var(--primary)', width: `${(uploadProgress.current / uploadProgress.total) * 100}%`, transition: 'width 0.2s' }} />
                </div>
              )}
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f77', borderRadius: '6px', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          {/* Compilation buttons */}
          <div style={{ marginTop: 'auto', display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '20px' }}>
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={() => setBatchWizardStep(2)}
            >
              Back to Roster
            </button>
            
            <button 
              type="button" 
              className="btn btn-secondary" 
              style={{ border: '1px solid var(--primary)', color: 'var(--primary)', background: 'rgba(99,102,241,0.05)' }}
              disabled={submitting || selectedPreviewIndexes.length === 0}
              onClick={handleGenerateApprovalProof}
            >
              Download Proof
            </button>

            <button 
              type="button" 
              className="btn btn-primary" 
              disabled={submitting || selectedPreviewIndexes.length === 0 || (hasMissingFields && !acceptMissingFields)}
              onClick={() => handleGenerateProductionPdf(true, emptySlotStrategy)}
            >
              {submitting ? 'Generating PDF...' : 'Download Production PDF'}
            </button>
          </div>
        </div>
      </div>
    );

    return (
      <div style={{ width: '100%', minHeight: '80vh', padding: '10px 0', display: 'flex', flexDirection: 'column' }}>
        {renderStepHeader()}
        <div style={{ flex: 1 }}>
          {batchWizardStep === 1 && renderStep1()}
          {batchWizardStep === 2 && renderStep2()}
          {batchWizardStep === 3 && renderStep3()}
        </div>
      </div>
    );
  };

  // Render full-page wizard when initializing a batch order
  if (showForm && orderMethod === 'batch') {
    return renderBatchWizard();
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1>Card Orders</h1>
          <p style={{ marginTop: '4px' }}>Draft client orders, manage status flow, and view billing invoices.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          <Plus size={18} /> {showForm ? 'Hide Form' : 'Initialize Order'}
        </button>
      </div>

      {showForm && (
        <div className="glass-panel" style={{ marginBottom: '32px', width: '100%' }}>
          <h3 style={{ marginBottom: '16px' }}>Initialize Printing Order</h3>
          
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
            <button 
              type="button" 
              className={`btn ${orderMethod === 'standard' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              onClick={() => setOrderMethod('standard')}
            >
              Standard (Existing Registry)
            </button>
            <button 
              type="button" 
              className={`btn ${orderMethod === 'batch' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              onClick={() => setOrderMethod('batch')}
            >
              Batch Upload (Excel + ZIP)
            </button>
          </div>

          {error && (
            <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f77', borderRadius: '6px', marginBottom: '20px', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          <form onSubmit={orderMethod === 'standard' ? handleCreate : handleAnalyzeBatchFiles} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {orderMethod === 'batch' && showPreviewStep ? (
              <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ margin: 0 }}>Roster Preview & Selection</h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '2px' }}>
                      Verify and select which cardholders to import and print. Missing photos are flagged.
                    </p>
                  </div>
                  <div style={{ fontSize: '0.8rem', background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '4px' }}>
                    Selected: <strong>{selectedPreviewIndexes.length}</strong> / {parsedCardholders.length}
                  </div>
                </div>

                <div style={{ maxHeight: '350px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }} className="custom-table">
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.02)', textAlign: 'left' }}>
                        <th style={{ width: '40px', padding: '8px 12px' }}>
                          <input 
                            type="checkbox"
                            checked={selectedPreviewIndexes.length === parsedCardholders.length}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedPreviewIndexes(parsedCardholders.map((_, i) => i));
                              } else {
                                setSelectedPreviewIndexes([]);
                              }
                            }}
                          />
                        </th>
                        <th style={{ padding: '8px 12px' }}>Photo</th>
                        <th style={{ padding: '8px 12px' }}>Name</th>
                        <th style={{ padding: '8px 12px' }}>ID / Roll Number</th>
                        <th style={{ padding: '8px 12px' }}>Designation</th>
                        <th style={{ padding: '8px 12px' }}>Status</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedCardholders.map((c, idx) => {
                        const isSelected = selectedPreviewIndexes.includes(idx);
                        const photoData = photosMap.get(c.sanitizedKey);
                        return (
                          <tr 
                            key={idx} 
                            style={{ 
                              borderTop: '1px solid rgba(255,255,255,0.05)', 
                              background: isSelected ? 'rgba(255,255,255,0.02)' : 'transparent',
                              opacity: isSelected ? 1 : 0.6
                            }}
                          >
                            <td style={{ padding: '8px 12px' }}>
                              <input 
                                type="checkbox" 
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedPreviewIndexes(prev => [...prev, idx]);
                                  } else {
                                    setSelectedPreviewIndexes(prev => prev.filter(i => i !== idx));
                                  }
                                }}
                              />
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              {c.hasPhoto && photoData?.url ? (
                                <img 
                                  src={photoData.url} 
                                  alt={c.name} 
                                  style={{ width: '36px', height: '36px', borderRadius: '4px', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.1)' }}
                                />
                              ) : (
                                <div style={{ width: '36px', height: '36px', borderRadius: '4px', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff6b6b', border: '1px dashed rgba(239,68,68,0.3)' }} title="No image found in ZIP">
                                  <ImageIcon size={16} />
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '8px 12px', fontWeight: 500 }}>{c.name}</td>
                            <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>
                              {c.imageId && c.imageId !== c.uniqueKey 
                                ? `${c.uniqueKey || '—'} [Img: ${c.imageId}]` 
                                : (c.uniqueKey || c.imageId || '—')}
                            </td>
                            <td style={{ padding: '8px 12px' }}>{c.designation || '—'}</td>
                            <td style={{ padding: '8px 12px' }}>
                              {c.hasPhoto ? (
                                <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}>
                                  <CheckCircle size={12} /> Ready
                                </span>
                              ) : (
                                <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }} title="No photo matched. ID will compile with placeholder.">
                                  <AlertTriangle size={12} /> Missing Photo
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{
                                  padding: '4px 8px',
                                  fontSize: '0.75rem',
                                  background: 'rgba(255, 255, 255, 0.05)',
                                  border: '1px solid rgba(255, 255, 255, 0.1)',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                                onClick={() => {
                                  setSelectedCardholderForDetails(c);
                                  setSelectedCardholderIndexForDetails(idx);
                                  setIsEditingDetail(false);
                                }}
                              >
                                <Eye size={12} /> View Details
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {uploadStatus && (
                  <div style={{ background: 'rgba(255,255,255,0.05)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '8px' }}>
                      <span style={{ color: 'var(--primary)' }}>{uploadStatus}</span>
                      {uploadProgress.total > 0 && (
                        <span>{uploadProgress.current} / {uploadProgress.total}</span>
                      )}
                    </div>
                    {uploadProgress.total > 0 && (
                      <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div 
                          style={{ 
                            height: '100%', 
                            background: 'var(--primary)', 
                            width: `${(uploadProgress.current / uploadProgress.total) * 100}%`,
                            transition: 'width 0.2s ease-out' 
                          }} 
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* PDF Layout Configuration */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px',
                  padding: '16px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '16px',
                  marginTop: '8px'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)' }}>Paper Size</label>
                    <select 
                      className="form-select" 
                      style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                      value={paperSize} 
                      onChange={e => setPaperSize(e.target.value as any)}
                    >
                      <option value="SRA3">SRA3 — 320×450mm ★ Recommended</option>
                      <option value="13x19">13×19 inch — 330×483mm</option>
                      <option value="A3">A3 — 297×420mm</option>
                      <option value="A4">A4 — 210×297mm</option>
                      <option value="CUSTOM">Custom Size…</option>
                    </select>
                    {paperSize === 'CUSTOM' && (
                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                        <input
                          type="number" min="100" max="700"
                          className="form-input" style={{ padding: '4px 8px', fontSize: '0.8rem', flex: 1 }}
                          placeholder="W (mm)" value={customSheetWidthMm}
                          onChange={e => setCustomSheetWidthMm(e.target.value)}
                        />
                        <span style={{ alignSelf: 'center', color: 'var(--muted)', fontSize: '0.8rem' }}>×</span>
                        <input
                          type="number" min="100" max="1000"
                          className="form-input" style={{ padding: '4px 8px', fontSize: '0.8rem', flex: 1 }}
                          placeholder="H (mm)" value={customSheetHeightMm}
                          onChange={e => setCustomSheetHeightMm(e.target.value)}
                        />
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)' }}>Orientation</label>
                    <select 
                      className="form-select" 
                      style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                      value={orientation} 
                      onChange={e => setOrientation(e.target.value as any)}
                    >
                      <option value="PORTRAIT">Portrait</option>
                      <option value="LANDSCAPE">Landscape</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)' }}>Bleed (mm)</label>
                    <input 
                      type="number" 
                      min="0"
                      max="10"
                      step="0.5"
                      className="form-input" 
                      style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                      value={bleedMm} 
                      onChange={e => setBleedMm(e.target.value)} 
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px', paddingTop: '10px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={cropMarks} 
                        onChange={e => setCropMarks(e.target.checked)} 
                      />
                      Crop Marks
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={foldLine} 
                        onChange={e => setFoldLine(e.target.checked)} 
                      />
                      Fold Line
                    </label>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '14px' }}>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    disabled={submitting}
                    onClick={() => {
                      setShowPreviewStep(false);
                      setParsedCardholders([]);
                      setSelectedPreviewIndexes([]);
                      // Revoke URLs to free memory
                      photosMap.forEach((val) => {
                        if (val.url) URL.revokeObjectURL(val.url);
                      });
                      setPhotosMap(new Map());
                    }}
                  >
                    Back to Files
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    style={{ border: '1px solid rgba(255, 255, 255, 0.15)', background: 'transparent' }}
                    disabled={submitting || selectedPreviewIndexes.length === 0}
                    onClick={handleGenerateApprovalProof}
                  >
                    {submitting ? 'Processing...' : 'Download Approval Proof (A4)'}
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-primary" 
                    disabled={submitting || selectedPreviewIndexes.length === 0}
                    onClick={() => handleGenerateProductionPdf()}
                  >
                    {submitting ? 'Generating...' : `Download Production PDF (${selectedPreviewIndexes.length} cards)`}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="form-group">
                  <label className="form-label">Client Registry Folder</label>
                  <select className="form-select" value={clientId} onChange={e => setClientId(e.target.value)}>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Card Template</label>
                  <select className="form-select" value={templateId} onChange={e => setTemplateId(e.target.value)}>
                    {templates.map(t => <option key={t.id} value={t.id}>{t.name} (v{t.version})</option>)}
                  </select>
                </div>

                {isOwner && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Price Per Card (Rs)</label>
                      <input type="number" required className="form-input" value={pricePerCard} onChange={e => setPricePerCard(e.target.value)} />
                    </div>

                    <div className="form-group">
                      <label className="form-label">GST / Tax Percent (%)</label>
                      <input type="number" required className="form-input" value={taxPercent} onChange={e => setTaxPercent(e.target.value)} />
                    </div>
                  </>
                )}

                {orderMethod === 'standard' && (
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label">Card Expiry Validity Date</label>
                    <input 
                      type="date" 
                      required 
                      className="form-input" 
                      value={validTill} 
                      onChange={e => setValidTill(e.target.value)} 
                      onClick={(e) => {
                        try {
                          e.currentTarget.showPicker();
                        } catch (err) {
                          console.warn('showPicker is not supported:', err);
                        }
                      }}
                    />
                  </div>
                )}

                {orderMethod === 'batch' && (
                  <>
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                      <label className="form-label">Excel Data Sheet (.xlsx, .csv)</label>
                      <input type="file" required accept=".xlsx,.xls,.csv" className="form-input" onChange={e => setExcelFile(e.target.files?.[0] || null)} />
                      <span style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '4px', display: 'block' }}>
                        First row must contain headers. Unique student ID column will be auto-detected.
                      </span>
                    </div>
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                      <label className="form-label">Student Photos ZIP Archive (.zip)</label>
                      <input type="file" required accept=".zip" className="form-input" onChange={e => setZipFile(e.target.files?.[0] || null)} />
                      <span style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '4px', display: 'block' }}>
                        Each photo filename should match the student's unique ID in the excel sheet.
                      </span>
                    </div>
                  </>
                )}

                {uploadStatus && (
                  <div style={{ gridColumn: 'span 2', background: 'rgba(255,255,255,0.05)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '8px' }}>
                      <span style={{ color: 'var(--primary)' }}>{uploadStatus}</span>
                      {uploadProgress.total > 0 && (
                        <span>{uploadProgress.current} / {uploadProgress.total}</span>
                      )}
                    </div>
                    {uploadProgress.total > 0 && (
                      <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div 
                          style={{ 
                            height: '100%', 
                            background: 'var(--primary)', 
                            width: `${(uploadProgress.current / uploadProgress.total) * 100}%`,
                            transition: 'width 0.2s ease-out' 
                          }} 
                        />
                      </div>
                    )}
                  </div>
                )}

                <div style={{ gridColumn: 'span 2', display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => {
                    setShowForm(false);
                    setExcelFile(null);
                    setZipFile(null);
                    setUploadStatus('');
                  }}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? 'Analyzing...' : (orderMethod === 'batch' ? 'Analyze & Match Files' : 'Initialize Order')}
                  </button>
                </div>
              </>
            )}
          </form>
        </div>
      )}

      {/* Search filter */}
      <div className="glass-panel" style={{ padding: '16px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Search size={18} color="var(--muted)" />
        <input
          type="text"
          className="form-input"
          style={{ background: 'transparent', border: 'none', padding: '4px', flex: 1 }}
          placeholder="Search by Order ID, Client name, Template name, or Status..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '50px 0' }}>
          <div className="spinner"></div>
        </div>
      ) : orders.length === 0 ? (
        <div className="glass-panel" style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--muted)' }}>
          <FileText size={40} style={{ marginBottom: '16px' }} />
          <h3>{debouncedSearch ? 'No Matching Orders' : 'No Orders Found'}</h3>
          <p style={{ marginTop: '8px' }}>
            {debouncedSearch 
              ? `We couldn't find any orders matching "${debouncedSearch}".` 
              : 'Create your first order to assemble layout sheets, assign serials, and print.'}
          </p>
        </div>
      ) : (
        <>
          <div className="table-container" style={{ overflowX: 'auto' }}>
          <table className="custom-table" style={{ minWidth: '800px' }}>
            <thead>
              <tr>
                <th>Order ID</th>
                <th
                  onClick={() => handleSort('client')}
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                >
                  Client Registry <SortIcon col="client" />
                </th>
                <th
                  onClick={() => handleSort('status')}
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                >
                  Status <SortIcon col="status" />
                </th>
                <th
                  onClick={() => handleSort('template')}
                  style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                >
                  Template <SortIcon col="template" />
                </th>
                <th>Cards</th>
                {isOwner && (
                  <>
                    <th>Payment</th>
                    <th>Total</th>
                  </>
                )}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((ord: any) => {
                const cardholderCount = ord._count?.cardholders ?? (ord.cardholders?.length ?? 0);
                const totalInvoiceAmount = ord.invoice ? `Rs. ${Number(ord.invoice.totalAmount).toFixed(2)}` : '—';
                const paymentStatus = ord.invoice ? (
                  ord.invoice.paymentStatus === 'PAID' ? (
                    <span className="badge badge-success">Paid</span>
                  ) : (
                    <span className="badge badge-danger">Unpaid</span>
                  )
                ) : '—';

                return (
                  <tr key={ord.id}>
                    <td>#{ord.id}</td>
                    <td style={{ fontWeight: '500' }}>{ord.client?.name}</td>
                    <td>{getStatusBadge(ord.status)}</td>
                    <td>{ord.template?.name} (v{ord.templateVersion})</td>
                    <td>{cardholderCount}</td>
                    {isOwner && (
                      <>
                        <td>{paymentStatus}</td>
                        <td>{totalInvoiceAmount}</td>
                      </>
                    )}
                    <td>
                      <a href={`/dashboard/orders/${ord.id}`} className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                        <FolderOpen size={12} /> Open
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > PAGE_SIZE && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
              Showing {Math.min((page - 1) * PAGE_SIZE + 1, total)}–{Math.min(page * PAGE_SIZE, total)} of {total} orders
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                className="btn btn-secondary"
                style={{ padding: '6px 10px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >
                <ChevronLeft size={14} /> Prev
              </button>
              {Array.from({ length: Math.ceil(total / PAGE_SIZE) }, (_, i) => i + 1)
                .filter(p => p === 1 || p === Math.ceil(total / PAGE_SIZE) || Math.abs(p - page) <= 1)
                .reduce<(number | '…')[]>((acc, p, idx, arr) => {
                  if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('…');
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) =>
                  p === '…' ? (
                    <span key={`e${i}`} style={{ padding: '0 4px', color: 'var(--muted)', fontSize: '0.82rem' }}>…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p as number)}
                      style={{
                        width: '32px', height: '32px', borderRadius: '6px', fontSize: '0.82rem', cursor: 'pointer',
                        border: page === p ? 'none' : '1px solid var(--glass-border)',
                        background: page === p ? '#4f46e5' : 'rgba(255,255,255,0.04)',
                        color: page === p ? '#ffffff' : 'var(--muted)',
                        fontWeight: page === p ? '700' : '400',
                        transition: 'all 0.15s',
                      }}
                    >
                      {p}
                    </button>
                  )
                )}
              <button
                className="btn btn-secondary"
                style={{ padding: '6px 10px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                disabled={page * PAGE_SIZE >= total}
                onClick={() => setPage(p => p + 1)}
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
        </>
      )}
    </div>
  );
}
