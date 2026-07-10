'use client';

import React, { useEffect, useState } from 'react';
import { Plus, FileText, Calendar, DollarSign, FolderOpen, RefreshCcw, Image as ImageIcon, CheckCircle, AlertTriangle, AlertCircle, Eye, ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { generateApprovalPdfClient } from '@/lib/pdf/approval-pdf-generator';
import { generateProductionPdfClient } from '@/lib/pdf/production-pdf-generator';
import CardPreview from '@/app/components/CardPreview';

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState('OWNER');
  const isOwner = role === 'OWNER';

  // Pagination & sorting
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const PAGE_SIZE = 20;
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('desc');

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
  const [showPreviewStep, setShowPreviewStep] = useState(false);
  const [parsedCardholders, setParsedCardholders] = useState<any[]>([]);
  const [selectedPreviewIndexes, setSelectedPreviewIndexes] = useState<number[]>([]);
  const [photosMap, setPhotosMap] = useState<Map<string, { blob: Blob; url: string }>>(new Map());
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
    const updated = [...parsedCardholders];
    updated[selectedCardholderIndexForDetails] = {
      ...selectedCardholderForDetails
    };
    setParsedCardholders(updated);
    setIsEditingDetail(false);
  };

  // Layout options for client-side batch processing
  const [paperSize, setPaperSize] = useState<'A3' | 'A4'>('A3');
  const [orientation, setOrientation] = useState<'PORTRAIT' | 'LANDSCAPE'>('PORTRAIT');
  const [bleedMm, setBleedMm] = useState<string>('3'); // default 3mm
  const [cropMarks, setCropMarks] = useState<boolean>(true);
  const [foldLine, setFoldLine] = useState<boolean>(true);

  const fetchOrders = async (p: number, sb: string, sd: string) => {
    try {
      const params = new URLSearchParams({
        page: String(p), pageSize: String(PAGE_SIZE), sortBy: sb, sortDir: sd,
      });
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
      await fetchOrders(page, sortBy, sortDir);

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

  // Re-fetch orders whenever page / sort changes (skip on first render — fetchData handles it)
  const isFirstRender = React.useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    fetchOrders(page, sortBy, sortDir);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, sortBy, sortDir]);

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
      const newPhotosMap = new Map<string, { blob: Blob; url: string }>();
      const filePromises: Promise<void>[] = [];

      zip.forEach((relativePath, file) => {
        if (file.dir) return;
        const ext = relativePath.substring(relativePath.lastIndexOf('.')).toLowerCase();
        if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
          const baseName = relativePath.split('/').pop()?.replace(ext, '').trim() || '';
          const promise = file.async('blob').then(blob => {
            const sanitizedKey = baseName.toLowerCase().replace(/[^a-zA-Z0-9_\-]/g, '_');
            const url = URL.createObjectURL(blob);
            newPhotosMap.set(sanitizedKey, { blob, url });
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
        const photoUrl = row[fieldMapping['photoUrl'] || photoUrlCol] ? String(row[fieldMapping['photoUrl'] || photoUrlCol]).trim() : null;

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

        // Map custom sub-images (e.g. signature, parent photo, etc.) from the zip file
        newPhotosMap.forEach((val, key) => {
          if (key.startsWith(`${baseSanitized}_`)) {
            const suffix = key.substring(baseSanitized.length + 1); // e.g. "signature"
            if (suffix && suffix !== 'photo' && suffix !== 'image' && suffix !== 'pic') {
              custom[suffix] = val.url;
            }
          } else if (key.startsWith(`${baseSanitized}-`)) {
            const suffix = key.substring(baseSanitized.length + 1);
            if (suffix && suffix !== 'photo' && suffix !== 'image' && suffix !== 'pic') {
              custom[suffix] = val.url;
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
      setShowPreviewStep(true);
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
          photoUrl: c.hasPhoto && matchedPhoto ? matchedPhoto.url : null,
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

  const handleGenerateProductionPdf = async () => {
    setError('');
    setUploadStatus('Generating Production PDF...');
    setUploadProgress({ current: 0, total: selectedPreviewIndexes.length });
    setSubmitting(true);

    try {
      const selectedTemplate = templates.find(t => String(t.id) === templateId);
      if (!selectedTemplate) throw new Error('Template not found');

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
          photoUrl: c.hasPhoto && matchedPhoto ? matchedPhoto.url : null,
          cardSerial: c.cardSerial || null,
          uniqueKey: c.uniqueKey || null,
          customFields: c.customFields ? JSON.stringify(c.customFields) : null,
        };
      });

      setUploadStatus('Compiling print-ready sheets...');
      const bleedPt = Number(bleedMm) * 2.83464567; // mm to points
      const pdfBlob = await generateProductionPdfClient(
        selectedTemplate,
        cardholdersForPdf,
        {
          paperSize,
          orientation,
          bleed: bleedPt,
          cropMarks,
          foldLine,
        },
        pressFonts,
        (percent) => {
          setUploadProgress({ current: Math.round((percent / 100) * selectedPreviewIndexes.length), total: selectedPreviewIndexes.length });
        }
      );

      const selectedClient = clients.find(c => String(c.id) === clientId);
      const clientName = selectedClient ? selectedClient.name : 'Client';

      const fileName = `Production_Print_${clientName.replace(/\s+/g, '_')}_${paperSize}_${Date.now()}.pdf`;
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
                      <option value="A3">A3 Sheet</option>
                      <option value="A4">A4 Sheet</option>
                    </select>
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
                    onClick={handleGenerateProductionPdf}
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

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '50px 0' }}>
          <div className="spinner"></div>
        </div>
      ) : orders.length === 0 ? (
        <div className="glass-panel" style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--muted)' }}>
          <FileText size={40} style={{ marginBottom: '16px' }} />
          <h3>No Orders Found</h3>
          <p style={{ marginTop: '8px' }}>Create your first order to assemble layout sheets, assign serials, and print.</p>
        </div>
      ) : (
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
                <th>Validity</th>
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
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--muted)' }}>
                        <Calendar size={12} />
                        <span>{ord.validTill ? new Date(ord.validTill).toLocaleDateString() : '—'}</span>
                      </div>
                    </td>
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
      )}

      {selectedCardholderForDetails && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: '1200px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            padding: 0,
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 24px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.02)'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>Cardholder Detailed Profile</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                  Detailed data auditing and verification for production print.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedCardholderForDetails(null);
                  setSelectedCardholderIndexForDetails(null);
                  setIsEditingDetail(false);
                  setDetailsPreviewSide('front');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--muted)',
                  cursor: 'pointer',
                  fontSize: '1.25rem',
                  lineHeight: 1
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(320px, 1fr) 1.2fr',
              gap: '24px',
              padding: '24px',
              overflowY: 'auto'
            }}>
              {/* Left Column: Visual Preview */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '16px'
              }}>
                <div style={{
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'center',
                  background: 'rgba(0,0,0,0.4)',
                  padding: '20px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.06)'
                }}>
                  {(() => {
                    const selectedTemplate = templates.find(t => String(t.id) === templateId);
                    if (!selectedTemplate) {
                      return (
                        <div style={{ color: 'var(--muted)', fontSize: '0.85rem', padding: '40px 0', textAlign: 'center' }}>
                          Select a template in the main form to render this card.
                        </div>
                      );
                    }
                    
                    const matchedPhoto = photosMap.get(selectedCardholderForDetails.sanitizedKey);
                    const cardholderForPreview = {
                      id: selectedCardholderForDetails.id,
                      name: selectedCardholderForDetails.name,
                      designation: selectedCardholderForDetails.designation,
                      photoUrl: selectedCardholderForDetails.hasPhoto && matchedPhoto ? matchedPhoto.url : null,
                      cardSerial: selectedCardholderForDetails.uniqueKey || selectedCardholderForDetails.cardSerial || null,
                      customFields: JSON.stringify(selectedCardholderForDetails.customFields || {})
                    };

                    return (
                      <CardPreview
                        template={selectedTemplate}
                        cardholder={cardholderForPreview}
                        side={detailsPreviewSide}
                        pressFonts={loadedPressFonts}
                        validTill={validTill}
                        style={{ maxWidth: '100%', maxHeight: '380px', objectFit: 'contain', borderRadius: '6px' }}
                      />
                    );
                  })()}
                </div>

                <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                  <button
                    type="button"
                    className={`btn ${detailsPreviewSide === 'front' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, padding: '8px', fontSize: '0.8rem' }}
                    onClick={() => setDetailsPreviewSide('front')}
                  >
                    Front Preview
                  </button>
                  {(() => {
                    const selectedTemplate = templates.find(t => String(t.id) === templateId);
                    return selectedTemplate?.backImageUrl ? (
                      <button
                        type="button"
                        className={`btn ${detailsPreviewSide === 'back' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ flex: 1, padding: '8px', fontSize: '0.8rem' }}
                        onClick={() => setDetailsPreviewSide('back')}
                      >
                        Back Preview
                      </button>
                    ) : null;
                  })()}
                </div>
              </div>

              {/* Right Column: Key-Value Field Explorer */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--primary)' }}>Record Fields (Excel Data)</h4>
                  {isEditingDetail && (
                    <span style={{ fontSize: '0.75rem', color: '#ffc107', background: 'rgba(255,193,7,0.1)', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                      Editing Mode (Live Preview)
                    </span>
                  )}
                </div>
                
                <div style={{
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '8px',
                  overflow: 'hidden'
                }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }} className="custom-table">
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.02)', textAlign: 'left' }}>
                        <th style={{ padding: '10px 16px', fontWeight: 600, width: '40%' }}>Field Name / Column</th>
                        <th style={{ padding: '10px 16px', fontWeight: 600 }}>Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '10px 16px', color: 'var(--muted)', fontWeight: 500 }}>Name</td>
                        <td style={{ padding: '10px 16px', fontWeight: 600 }}>
                          {isEditingDetail ? (
                            <input 
                              type="text" 
                              className="form-input" 
                              style={{ padding: '4px 8px', fontSize: '0.85rem', width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px' }}
                              value={selectedCardholderForDetails.name || ''} 
                              onChange={e => setSelectedCardholderForDetails((prev: any) => ({ ...prev, name: e.target.value }))}
                            />
                          ) : (
                            selectedCardholderForDetails.name
                          )}
                        </td>
                      </tr>
                      <tr style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '10px 16px', color: 'var(--muted)' }}>Designation</td>
                        <td style={{ padding: '10px 16px' }}>
                          {isEditingDetail ? (
                            <input 
                              type="text" 
                              className="form-input" 
                              style={{ padding: '4px 8px', fontSize: '0.85rem', width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px' }}
                              value={selectedCardholderForDetails.designation || ''} 
                              onChange={e => setSelectedCardholderForDetails((prev: any) => ({ ...prev, designation: e.target.value }))}
                            />
                          ) : (
                            selectedCardholderForDetails.designation || <em style={{ color: 'rgba(255,255,255,0.3)' }}>empty</em>
                          )}
                        </td>
                      </tr>
                      <tr style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '10px 16px', color: 'var(--muted)' }}>Unique Key / ID</td>
                        <td style={{ padding: '10px 16px', fontFamily: 'monospace' }}>
                          {isEditingDetail ? (
                            <input 
                              type="text" 
                              className="form-input" 
                              style={{ padding: '4px 8px', fontSize: '0.85rem', width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px' }}
                              value={selectedCardholderForDetails.uniqueKey || ''} 
                              onChange={e => setSelectedCardholderForDetails((prev: any) => ({ ...prev, uniqueKey: e.target.value }))}
                            />
                          ) : (
                            selectedCardholderForDetails.uniqueKey || <em style={{ color: 'rgba(255,255,255,0.3)' }}>empty</em>
                          )}
                        </td>
                      </tr>
                      <tr style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '10px 16px', color: 'var(--muted)' }}>Photo Filename (sanitized)</td>
                        <td style={{ padding: '10px 16px', fontFamily: 'monospace' }}>{selectedCardholderForDetails.sanitizedKey}</td>
                      </tr>
                      
                      {/* Dynamic Custom Fields */}
                      {Object.entries(selectedCardholderForDetails.customFields || {}).map(([key, val]) => (
                        <tr key={key} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '10px 16px', color: 'var(--muted)' }}>{key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^./, s => s.toUpperCase())}</td>
                          <td style={{ padding: '10px 16px' }}>
                            {typeof val === 'string' && val.startsWith('blob:') ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <img src={val} alt={key} style={{ maxHeight: '40px', maxWidth: '100px', objectFit: 'contain', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', background: 'rgba(0,0,0,0.2)', padding: '2px' }} />
                                <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Image Asset</span>
                              </div>
                            ) : (
                              isEditingDetail ? (
                                <input 
                                  type="text" 
                                  className="form-input" 
                                  style={{ padding: '4px 8px', fontSize: '0.85rem', width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px' }}
                                  value={String(val || '')} 
                                  onChange={e => {
                                    const newVal = e.target.value;
                                    setSelectedCardholderForDetails((prev: any) => {
                                      const updatedCustom = { ...prev.customFields, [key]: newVal };
                                      return { ...prev, customFields: updatedCustom };
                                    });
                                  }}
                                />
                              ) : (
                                String(val || '') || <em style={{ color: 'rgba(255,255,255,0.3)' }}>empty</em>
                              )
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              padding: '16px 24px',
              borderTop: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.02)',
              gap: '12px'
            }}>
              {isEditingDetail ? (
                <>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      if (selectedCardholderIndexForDetails !== null) {
                        setSelectedCardholderForDetails(parsedCardholders[selectedCardholderIndexForDetails]);
                      }
                      setIsEditingDetail(false);
                    }}
                  >
                    Cancel Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleSaveCardholderEdit}
                  >
                    Save Changes
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ border: '1px solid rgba(255, 255, 255, 0.15)', background: 'transparent' }}
                    onClick={() => setIsEditingDetail(true)}
                  >
                    Edit Profile Details
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      setSelectedCardholderForDetails(null);
                      setSelectedCardholderIndexForDetails(null);
                      setDetailsPreviewSide('front');
                    }}
                  >
                    Close Details
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
