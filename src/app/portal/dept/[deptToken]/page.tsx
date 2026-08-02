'use client';

import React, { useState, useEffect, use } from 'react';
import ImageCropper from '@/app/components/ImageCropper';
import ConfirmDialog from '@/app/components/ConfirmDialog';
import { ToastProvider, useToast } from '@/components/ui/toast';
import { getResolvedFieldValue, isPlaceholderStaticValue, formatFieldLabel } from '@/lib/pdf/card-renderer-client';

import {
  Users,
  Copy,
  Check,
  Plus,
  Edit2,
  Trash2,
  Search,
  Upload,
  Loader,
  AlertCircle,
  Eye,
  Building,
  FileText,
  Download,
} from 'lucide-react';

const isDateField = (fieldKey: string, fieldType?: string) => {
  if (fieldType && fieldType.toLowerCase() === 'date') return true;
  const clean = fieldKey.toLowerCase().replace(/[^a-z]/g, '');
  if (
    clean.includes('no') ||
    clean.includes('num') ||
    clean.includes('id') ||
    clean.includes('place') ||
    clean.includes('branch') ||
    clean.includes('cert')
  ) {
    return false;
  }
  return (
    clean.includes('date') ||
    clean.includes('dob') ||
    clean.includes('doj') ||
    clean.includes('expiry') ||
    clean.includes('validity') ||
    clean.includes('validtill') ||
    clean.includes('issue') ||
    clean.includes('admission') ||
    clean.includes('birth') ||
    clean.includes('joining')
  );
};

interface Cardholder {
  id: number;
  name: string;
  designation?: string;
  photoUrl?: string;
  customFields?: string;
  uniqueKey?: string;
  cardSerial?: string;
  createdAt: string;
  templateName?: string;
}

interface FieldCoordinate {
  field: string;
  type: string;
  width?: number;
  height?: number;
  borderRadius?: number;
}

interface Client {
  id: number;
  name: string;
  type: string;
}

interface Template {
  id: number;
  name: string;
  width?: number;
  height?: number;
  frontImageUrl?: string;
  backImageUrl?: string;
  frontOriginalUrl?: string | null;
  backOriginalUrl?: string | null;
  frontFields?: string;
  backFields?: string;
  validTillDate?: string | null;
}

interface ApprovalJob {
  id: number;
  downloadUrl?: string;
}

interface TemplateField {
  field: string;
  type: string;
  isMainPhoto?: boolean;
  isName?: boolean;
  width?: number;
  height?: number;
  borderRadius?: number;
}

const cleanFieldKey = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

export default function DeptPortalPage({ params }: { params: Promise<{ deptToken: string }> }) {
  return (
    <ToastProvider>
      <DeptPortalPageContent params={params} />
    </ToastProvider>
  );
}

function DeptPortalPageContent({ params }: { params: Promise<{ deptToken: string }> }) {
  const { toast } = useToast();
  const { deptToken } = use(params);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // Card selection states
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const toggleSelect = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    const visibleIds = filtered.map(ch => ch.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...visibleIds])));
    }
  };



  const handleDownloadExcel = () => {
    if (selectedIds.length === 0) return;
    const url = `/api/portal/dept/${deptToken}/excel?ids=${selectedIds.join(',')}`;
    window.open(url, '_blank');
  };

  // Confirm dialog state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string; message: string; confirmLabel: string; variant: 'danger' | 'warning'; onConfirm: () => void;
  } | null>(null);
  const showConfirm = (cfg: typeof confirmConfig) => { setConfirmConfig(cfg); setConfirmOpen(true); };
  const closeConfirm = () => { setConfirmOpen(false); setConfirmConfig(null); };

  const [client, setClient] = useState<Client | null>(null);
  const [template, setTemplate] = useState<Template | null>(null);
  const [enrollToken, setEnrollToken] = useState('');
  const [latestApprovalJob, setLatestApprovalJob] = useState<ApprovalJob | null>(null);
  const [cardholders, setCardholders] = useState<Cardholder[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplateFilter, setSelectedTemplateFilter] = useState<string>('ALL');
  const [filterWarningsOnly, setFilterWarningsOnly] = useState(false);
  const [formFields, setFormFields] = useState<string[]>([]);
  const [customImgFields, setCustomImgFields] = useState<FieldCoordinate[]>([]);
  const [templateFields, setTemplateFields] = useState<TemplateField[]>([]);
  const [fieldTypeMap, setFieldTypeMap] = useState<Record<string, string>>({});
  const [fieldCoordsMap, setFieldCoordsMap] = useState<Record<string, FieldCoordinate>>({});

  // Field visibility states
  const [hasName, setHasName] = useState(true);
  const [hasDesignation, setHasDesignation] = useState(false);
  const [hasPhoto, setHasPhoto] = useState(false);
  const hasUniqueKey = false;

  // Modal States
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingCardholderId, setEditingCardholderId] = useState<number | null>(null);
  const [previewCardholder, setPreviewCardholder] = useState<Cardholder | null>(null);
  const [previewSide, setPreviewSide] = useState<'front' | 'back'>('front');

  // Form States
  const [name, setName] = useState('');
  const [designation, setDesignation] = useState('');
  const [customFields, setCustomFields] = useState<Record<string, string>>({});
  const [photoUrl, setPhotoUrl] = useState('');

  // Cropper States
  const [rawImage, setRawImage] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [activeCropField, setActiveCropField] = useState<string | null>(null);

  const loadPortalData = async () => {
    try {
      const shareRes = await fetch(`/api/portal/shares/${deptToken}`);
      if (!shareRes.ok) throw new Error('Portal link is invalid or deactivated');
      const shareData = await shareRes.json();

      if (shareData.type !== 'dept') {
        throw new Error('This link is not a Department Head portal link');
      }

      setClient(shareData.client);
      setTemplate(shareData.template);
      setEnrollToken(shareData.share.enrollToken);
      setLatestApprovalJob(shareData.latestApprovalJob);

      const front = JSON.parse(shareData.template.frontFields || '[]');
      const back = JSON.parse(shareData.template.backFields || '[]');
      const allFields: FieldCoordinate[] = [...front, ...back];

      const typeMap: Record<string, string> = {};
      const coordsMap: Record<string, FieldCoordinate> = {};
      allFields.forEach(f => {
        if (f.field) {
          typeMap[f.field] = f.type || 'text';
          coordsMap[f.field] = f;
        }
      });
      setFieldTypeMap(typeMap);
      setFieldCoordsMap(coordsMap);

      // Identify fields that are mapped to 'qr', 'barcode', 'id' or static fields to exclude from user forms
      const restrictedFields = new Set(
        allFields
          .filter(f => f.type === 'qr' || f.type === 'barcode' || f.type === 'id' || (f as any).staticValue !== undefined)
          .map(f => f.field)
      );

      // Include user-fillable text, date, and number fields (excluding restricted and ID types)
      const textFields = allFields.filter(f => (f.type === 'text' || f.type === 'date' || f.type === 'number' || !f.type) && f.type !== 'id' && (f as any).staticValue === undefined && !restrictedFields.has(f.field));
      const keys = Array.from(new Set(textFields.map(f => f.field)));
      const cleanFieldKey = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

      const filteredKeys = keys.filter(k => {
        const clean = cleanFieldKey(k);
        const meta = coordsMap[k];
        return clean !== 'photo' && 
          clean !== 'avatar' &&
          clean !== 'cardserial' &&
          !clean.includes('serial') &&
          meta?.type !== 'id' &&
          (meta as any)?.staticValue === undefined;
      });
      setFormFields(filteredKeys);

      // Find all image fields
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
      const customImages = imageFields.filter(f => f !== mainPhoto);
      setCustomImgFields(customImages);

      // Extract template fields in order
      const uniqueFields: TemplateField[] = [];
      const seen = new Set<string>();
      
      if (mainPhoto) {
        uniqueFields.push({ field: mainPhoto.field, type: 'image', isMainPhoto: true });
        seen.add(mainPhoto.field);
      }
      
      const nameField = allFields.find(f => {
        const clean = cleanFieldKey(f.field);
        return clean === 'name' || clean === 'fullname' || clean === 'studentname';
      });
      if (nameField) {
        uniqueFields.push({ field: nameField.field, type: 'text', isName: true });
        seen.add(nameField.field);
      }
      
      allFields.forEach(f => {
        if (seen.has(f.field)) return;
        uniqueFields.push({
          field: f.field,
          type: f.type,
          width: f.width,
          height: f.height,
          borderRadius: f.borderRadius
        });
        seen.add(f.field);
      });
      setTemplateFields(uniqueFields);

      const mappedFields = allFields.map(f => cleanFieldKey(f.field));
      setHasName(mappedFields.some(f => ['name', 'fullname', 'studentname', 'employeename', 'membername', 'staffname', 'cardholdername', 'username'].includes(f)));
      setHasDesignation(mappedFields.some(f => ['designation', 'role', 'jobtitle', 'post', 'profession'].includes(f)));
      setHasPhoto(mainPhoto !== null);

      const chRes = await fetch(`/api/portal/dept/${deptToken}/cardholders`);
      if (!chRes.ok) throw new Error('Failed to load cardholders');
      const chData = await chRes.json();
      setCardholders(chData.cardholders);
      setSelectedIds([]);
    } catch (err: any) {
      setError(err.message || 'An error occurred loading the portal');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPortalData();
  }, [deptToken]);

  const copyEnrollmentLink = () => {
    const link = `${window.location.origin}/portal/enroll/${enrollToken}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openAddModal = () => {
    setModalMode('add');
    setName('');
    setDesignation('');
    setPhotoUrl('');
    const initialCustom: Record<string, string> = {};
    formFields.forEach(k => { initialCustom[k] = ''; });
    customImgFields.forEach(imgField => { initialCustom[imgField.field] = ''; });
    setCustomFields(initialCustom);
    setShowModal(true);
  };

  const openEditModal = (ch: Cardholder) => {
    setModalMode('edit');
    setEditingCardholderId(ch.id);
    
    let parsedCustom: Record<string, string> = {};
    try {
      parsedCustom = typeof ch.customFields === 'string' ? JSON.parse(ch.customFields) : (ch.customFields || {});
    } catch { parsedCustom = {}; }

    let resolvedName = ch.name;
    let resolvedDesignation = ch.designation || '';

    if ((!resolvedName || resolvedName === 'Cardholder') && parsedCustom) {
      const customName = getCustomFieldValueCaseInsensitive(parsedCustom, 'name') ||
                         getCustomFieldValueCaseInsensitive(parsedCustom, 'fullName') ||
                         getCustomFieldValueCaseInsensitive(parsedCustom, 'NAME');
      if (customName) resolvedName = customName;
    }
    if (!resolvedDesignation && parsedCustom) {
      const customDesig = getCustomFieldValueCaseInsensitive(parsedCustom, 'designation') ||
                          getCustomFieldValueCaseInsensitive(parsedCustom, 'role') ||
                          getCustomFieldValueCaseInsensitive(parsedCustom, 'DESIGNATION');
      if (customDesig) resolvedDesignation = customDesig;
    }

    setName(resolvedName);
    setDesignation(resolvedDesignation);
    setPhotoUrl(ch.photoUrl || '');
    
    const finalCustom: Record<string, string> = {};
    formFields.forEach(k => {
      let val = getCustomFieldValueCaseInsensitive(parsedCustom, k) || '';
      if (!val) {
        const clean = cleanFieldKey(k);
        if (['name', 'fullname', 'studentname', 'employeename', 'membername', 'staffname', 'cardholdername', 'username'].includes(clean)) {
          val = resolvedName;
        } else if (['designation', 'role', 'jobtitle', 'post', 'profession'].includes(clean)) {
          val = resolvedDesignation;
        }
      }
      finalCustom[k] = val;
    });
    customImgFields.forEach(imgField => { finalCustom[imgField.field] = getCustomFieldValueCaseInsensitive(parsedCustom, imgField.field) || ''; });
    setCustomFields(finalCustom);
    setShowModal(true);
  };

  const triggerUpload = (fieldKey: string) => {
    setActiveCropField(fieldKey);
    document.getElementById('dept-modal-photo-input')?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setRawImage(reader.result as string); setShowCropper(true); };
    reader.readAsDataURL(file);
    e.target.value = ''; // Reset
  };

  const handleCropComplete = async (croppedBase64: string) => {
    setShowCropper(false);
    setUploadingPhoto(true);
    try {
      const resBlob = await fetch(croppedBase64);
      const blob = await resBlob.blob();
      const file = new File([blob], `cropped_${activeCropField || 'avatar'}.png`, { type: 'image/png' });
      const formData = new FormData();
      formData.append('file', file);
      formData.append('token', deptToken);
      formData.append('type', 'photo');
      const uploadRes = await fetch('/api/portal/upload', { method: 'POST', body: formData });
      if (!uploadRes.ok) throw new Error('Failed to upload image');
      const data = await uploadRes.json();
      const uploadedUrl = data.url || '';
      if (!uploadedUrl) throw new Error('Upload succeeded but no URL was returned');
      
      if (activeCropField === 'photo') {
        setPhotoUrl(uploadedUrl);
      } else if (activeCropField) {
        setCustomFields(prev => ({
          ...prev,
          [activeCropField]: uploadedUrl,
        }));
      }
    } catch (err: any) {
      toast(err.message || 'Error uploading photo', 'error');
    } finally {
      setUploadingPhoto(false);
      setActiveCropField(null);
    }
  };

  const handleSaveCardholder = async (e: React.FormEvent) => {
    e.preventDefault();
    let resolvedName = name.trim();
    if (!resolvedName) {
      for (const k of formFields) {
        if (customFields[k] && customFields[k].trim()) {
          resolvedName = customFields[k].trim();
          break;
        }
      }
    }
    const finalName = resolvedName || 'Cardholder';
    if (!finalName) return;

    // Validate number fields min/max caps before submission
    for (const field of formFields) {
      const coord = fieldCoordsMap[field];
      const type = (coord?.type || fieldTypeMap[field]) || 'text';
      const val = customFields[field];

      if (type === 'number' && val !== undefined && val !== null && String(val).trim() !== '') {
        const numVal = Number(val);
        const label = formatFieldLabel(field);
        const minCap = (coord as any)?.min;
        const maxCap = (coord as any)?.max;

        if (isNaN(numVal)) {
          toast(`${label} must be a valid number`, 'error');
          return;
        }
        if (minCap !== undefined && minCap !== null && numVal < minCap) {
          toast(`${label} must be at least ${minCap}`, 'error');
          return;
        }
        if (maxCap !== undefined && maxCap !== null && numVal > maxCap) {
          toast(`${label} cannot be greater than ${maxCap}`, 'error');
          return;
        }
      }
    }

    setLoading(true);
    try {
      const payload = {
        name: finalName,
        designation: hasDesignation ? (designation || null) : null,
        photoUrl: hasPhoto ? (photoUrl || null) : null,
        customFields,
      };
      const url = modalMode === 'add'
        ? `/api/portal/dept/${deptToken}/cardholders`
        : `/api/portal/dept/${deptToken}/cardholders/${editingCardholderId}`;
      const res = await fetch(url, {
        method: modalMode === 'add' ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save cardholder details');
      }
      setShowModal(false);
      await loadPortalData();
      toast('Cardholder saved successfully', 'success');
    } catch (err: any) {
      toast(err.message, 'error');
      setLoading(false);
    }
  };

  const handleDeleteCardholder = (id: number) => {
    showConfirm({
      title: 'Delete Cardholder',
      message: 'This will permanently delete the cardholder and all their card data. This action cannot be undone.',
      confirmLabel: 'Delete',
      variant: 'danger',
      onConfirm: async () => {
        closeConfirm();
        setLoading(true);
        try {
          const res = await fetch(`/api/portal/dept/${deptToken}/cardholders/${id}`, { method: 'DELETE' });
          if (!res.ok) throw new Error('Failed to delete cardholder');
          await loadPortalData();
          toast('Cardholder deleted successfully', 'success');
        } catch (err: any) {
          toast(err.message, 'error');
          setLoading(false);
        }
      },
    });
  };

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

  const getCardholderWarnings = (ch: Cardholder) => {
    const warnings: string[] = [];
    if (!template) return warnings;

    try {
      const front = JSON.parse(template.frontFields || '[]');
      const back = JSON.parse(template.backFields || '[]');
      const allFields: any[] = [...front, ...back];

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

        if (f.staticValue !== undefined && f.staticValue !== null && !isPlaceholderStaticValue(f.staticValue, f.field)) {
          return;
        }

        const fieldClean = f.field.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (fieldClean === 'validtill' || fieldClean === 'validtilldate' || fieldClean === 'cardserial') {
          return;
        }

        if (checkedFields.has(f.field)) return;
        checkedFields.add(f.field);

        if (fieldClean === 'name' || fieldClean === 'fullname' || fieldClean === 'studentname') {
          if (!ch.name || ch.name.trim() === '') {
            warnings.push('Name is required');
          }
          return;
        }

        if (fieldClean === 'designation' || fieldClean === 'role') {
          if (!ch.designation || ch.designation.trim() === '') {
            warnings.push('Designation is missing');
          }
          return;
        }

        if (f.type === 'id' || fieldClean === 'uniquekey' || fieldClean === 'id' || fieldClean === 'studentid' || fieldClean === 'rollnumber' || fieldClean === 'admissionnumber' || fieldClean.includes('id')) {
          const idVal = getResolvedFieldValue(f.field, cardholderData, ch, f.type) || ch.uniqueKey || parsedCustom.uniqueKey || parsedCustom.id || parsedCustom.unique_key;
          if (!idVal || String(idVal).trim() === '' || String(idVal).startsWith('C-')) {
            const label = formatFieldLabel(f.field) || 'ID';
            warnings.push(`${label} is missing`);
          }
          return;
        }

        if (f.type === 'image') {
          const imgVal = getResolvedFieldValue(f.field, cardholderData, ch) || (fieldClean.includes('photo') || fieldClean.includes('avatar') || fieldClean.includes('profile') ? ch.photoUrl : null);
          if (!imgVal || String(imgVal).trim() === '' || String(imgVal) === 'null' || String(imgVal) === 'undefined') {
            const label = formatFieldLabel(f.field);
            warnings.push(`${label} is missing`);
          }
          return;
        }

        const val = getResolvedFieldValue(f.field, cardholderData, ch);
        if (val === undefined || val === null || String(val).trim() === '' || String(val) === 'null' || String(val) === 'undefined') {
          const label = formatFieldLabel(f.field);
          warnings.push(`${label} is missing`);
        }
      });
    } catch (e) {
      console.error('Error validating cardholder in dept portal', e);
    }
    
    return warnings;
  };

  const filtered = cardholders.filter(ch => {
    const q = searchQuery.toLowerCase();
    const custom = ch.customFields ? (typeof ch.customFields === 'string' ? JSON.parse(ch.customFields) : ch.customFields) : {};
    const idVal = ch.uniqueKey || custom.uniqueKey || custom.id || custom.unique_key || '';
    const matchesSearch = ch.name.toLowerCase().includes(q) ||
      (ch.designation && ch.designation.toLowerCase().includes(q)) ||
      String(idVal).toLowerCase().includes(q);
      
    const matchesWarnings = !filterWarningsOnly || getCardholderWarnings(ch).length > 0;
    
    return matchesSearch && matchesWarnings;
  });

  const allTemplateNames = React.useMemo(() => {
    const set = new Set<string>();
    cardholders.forEach(ch => {
      const tName = (ch.templateName && ch.templateName !== '—') ? ch.templateName : (template?.name || 'General Template');
      set.add(tName);
    });
    if (set.size === 0 && template?.name) {
      set.add(template.name);
    }
    return Array.from(set);
  }, [cardholders, template]);

  const groupedByTemplate = React.useMemo(() => {
    const map = new Map<string, Cardholder[]>();
    filtered.forEach(ch => {
      const tName = (ch.templateName && ch.templateName !== '—') ? ch.templateName : (template?.name || 'General Template');
      if (!map.has(tName)) {
        map.set(tName, []);
      }
      map.get(tName)!.push(ch);
    });
    return map;
  }, [filtered, template]);

  if (loading && cardholders.length === 0 && !error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--page-bg)', color: 'var(--foreground)' }}>
        <div style={{ textAlign: 'center' }}>
          <Loader className="animate-spin" size={48} style={{ margin: '0 auto 16px', color: 'var(--primary)' }} />
          <p style={{ color: 'var(--muted)' }}>Loading department portal...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--page-bg)', padding: '24px' }}>
        <div className="card" style={{ maxWidth: '400px', width: '100%', padding: '24px', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          <AlertCircle size={48} style={{ color: 'var(--danger)', margin: '0 auto 16px' }} />
          <h3 style={{ marginBottom: '8px' }}>Portal Error</h3>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '24px' }}>{error}</p>
        </div>
      </div>
    );
  }

  // Find active field coordinate for cropper overlay shape
  const activeFieldCoord = template ? (() => {
    const front = JSON.parse(template.frontFields || '[]');
    const back = JSON.parse(template.backFields || '[]');
    const all = [...front, ...back];
    if (activeCropField === 'photo') {
      const allImageFields = all.filter((f: FieldCoordinate) => f.type === 'image');
      return allImageFields.find((f: FieldCoordinate) => f.field === 'photo' || f.field === 'avatar') || allImageFields[0] || null;
    }
    return all.find((f: FieldCoordinate) => f.field === activeCropField) || null;
  })() : null;

  const targetAspectRatio = activeFieldCoord && activeFieldCoord.width && activeFieldCoord.height
    ? activeFieldCoord.width / activeFieldCoord.height
    : 0.75; // Default 3:4 portrait

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)', color: 'var(--foreground)', padding: '40px 24px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '24px', marginBottom: '32px', paddingBottom: '24px', borderBottom: '1px solid var(--glass-border)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <Building size={16} style={{ color: '#f59e0b' }} />
              <span style={{ fontSize: '0.85rem', color: '#f59e0b', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Department Head Portal
              </span>
            </div>
            <h1 style={{ fontSize: '2.2rem', marginTop: '0', marginBottom: '4px' }}>{client?.name}</h1>
            <p style={{ color: 'var(--muted)', fontSize: '0.95rem' }}>Active Template: <span style={{ color: 'var(--foreground)' }}>{template?.name}</span></p>
          </div>

          <button className="btn btn-secondary" onClick={copyEnrollmentLink} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
            Copy Staff Enrollment Link
          </button>
        </div>

        {/* Notice — department capabilities */}
        <div className="card" style={{ padding: '16px 20px', background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)', marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <AlertCircle size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
          <p style={{ fontSize: '0.875rem', color: 'var(--muted)', margin: 0 }}>
            You have <strong style={{ color: 'var(--foreground)' }}>Department Head</strong> access — you can manage cardholders, export their details to Excel, and download approval PDFs for verification.
          </p>
        </div>

        {/* Automatic Review Warning Banner */}
        {(() => {
          const problematicCount = cardholders.filter(c => getCardholderWarnings(c).length > 0).length;
          if (problematicCount > 0) {
            return (
              <div 
                style={{ 
                  background: 'rgba(245, 158, 11, 0.04)', 
                  border: '1px solid rgba(245, 158, 11, 0.25)', 
                  padding: '16px 20px', 
                  marginBottom: '20px', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  borderRadius: '10px',
                  gap: '16px',
                  flexWrap: 'wrap',
                  width: '100%'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <AlertCircle size={22} style={{ color: '#fbbf24', flexShrink: 0 }} />
                  <div>
                    <h4 style={{ color: '#fff', fontSize: '0.92rem', margin: '0 0 2px 0', fontWeight: '600' }}>Automatic Review Warnings</h4>
                    <p style={{ color: 'var(--muted)', fontSize: '0.8rem', margin: 0 }}>
                      We detected <strong>{problematicCount}</strong> record(s) with missing mandatory fields (photos, IDs, or custom attributes) required by the card template.
                    </p>
                  </div>
                </div>
                <button
                  className="btn"
                  onClick={() => setFilterWarningsOnly(!filterWarningsOnly)}
                  style={{
                    fontSize: '0.78rem',
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

        {/* Toolbar, Search & Template Filters */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: '340px' }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '40px' }}
                placeholder="Search name, designation, ID..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Template Filter Pills */}
            {allTemplateNames.length > 1 && (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setSelectedTemplateFilter('ALL')}
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.8rem',
                    fontWeight: '600',
                    borderRadius: '6px',
                    border: selectedTemplateFilter === 'ALL' ? '1px solid var(--primary)' : '1px solid var(--glass-border)',
                    background: selectedTemplateFilter === 'ALL' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.03)',
                    color: selectedTemplateFilter === 'ALL' ? 'var(--primary)' : 'var(--muted)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  All Templates ({filtered.length})
                </button>
                {allTemplateNames.map(tName => {
                  const tCount = cardholders.filter(c => ((c.templateName && c.templateName !== '—') ? c.templateName : (template?.name || 'General Template')) === tName).length;
                  return (
                    <button
                      key={tName}
                      type="button"
                      onClick={() => setSelectedTemplateFilter(tName)}
                      style={{
                        padding: '6px 12px',
                        fontSize: '0.8rem',
                        fontWeight: '600',
                        borderRadius: '6px',
                        border: selectedTemplateFilter === tName ? '1px solid var(--primary)' : '1px solid var(--glass-border)',
                        background: selectedTemplateFilter === tName ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.03)',
                        color: selectedTemplateFilter === tName ? 'var(--primary)' : 'var(--muted)',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      {tName} ({tCount})
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {selectedIds.length > 0 && (
              <span style={{ fontSize: '0.875rem', color: 'var(--muted)', marginRight: '8px' }}>
                {selectedIds.length} selected
              </span>
            )}
            <button
              className="btn btn-secondary"
              onClick={handleDownloadExcel}
              disabled={selectedIds.length === 0}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                opacity: selectedIds.length === 0 ? 0.5 : 1,
                cursor: selectedIds.length === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              <Download size={16} /> Export Excel
            </button>
            {latestApprovalJob && latestApprovalJob.downloadUrl ? (
              <a
                href={latestApprovalJob.downloadUrl}
                target="_blank"
                rel="noreferrer"
                className="btn btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  textDecoration: 'none'
                }}
              >
                <FileText size={16} /> Download Approval PDF
              </a>
            ) : (
              <button
                className="btn btn-primary"
                disabled
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  opacity: 0.5,
                  cursor: 'not-allowed'
                }}
                title="Approval PDF has not been compiled by the print provider yet."
              >
                <FileText size={16} /> Approval PDF Not Ready
              </button>
            )}
            <button className="btn btn-secondary" onClick={openAddModal} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Plus size={16} /> Add Cardholder
            </button>
          </div>
        </div>

        {/* Cardholders Tables Grouped By Template */}
        {filtered.length === 0 ? (
          <div className="card" style={{ padding: '48px', textAlign: 'center', border: '1.5px dashed var(--glass-border)' }}>
            <Users size={48} style={{ color: 'var(--muted)', margin: '0 auto 16px' }} />
            <h3>No cardholders enrolled yet</h3>
            <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '24px' }}>
              Share the staff enrollment link or add cardholders manually.
            </p>
            <button className="btn btn-primary" onClick={openAddModal}>Add First Cardholder</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {Array.from(groupedByTemplate.entries())
              .filter(([tName]) => selectedTemplateFilter === 'ALL' || selectedTemplateFilter === tName)
              .map(([tName, tCardholders]) => (
                <div key={tName} className="card" style={{ padding: '0', overflow: 'hidden', border: '1px solid var(--glass-border)', borderRadius: '12px' }}>
                  {/* Template Header Banner */}
                  <div style={{
                    padding: '16px 20px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    borderBottom: '1px solid var(--glass-border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        background: 'rgba(59, 130, 246, 0.15)',
                        color: 'var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <FileText size={16} />
                      </div>
                      <div>
                        <h3 style={{ fontSize: '1.05rem', margin: 0, fontWeight: 'bold' }}>{tName}</h3>
                        <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>Template Section</span>
                      </div>
                    </div>
                    <span style={{
                      fontSize: '0.8rem',
                      fontWeight: '600',
                      padding: '4px 12px',
                      borderRadius: '20px',
                      background: 'rgba(59, 130, 246, 0.15)',
                      color: 'var(--primary)',
                      border: '1px solid rgba(59, 130, 246, 0.3)'
                    }}>
                      {tCardholders.length} Enrolled {tCardholders.length === 1 ? 'Record' : 'Records'}
                    </span>
                  </div>

                  {/* Dedicated Template Table */}
                  <div className="table-container" style={{ margin: 0 }}>
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th style={{ width: '40px' }}>
                            <input
                              type="checkbox"
                              checked={tCardholders.length > 0 && tCardholders.every(ch => selectedIds.includes(ch.id))}
                              onChange={() => {
                                const groupIds = tCardholders.map(c => c.id);
                                const allSelected = groupIds.every(id => selectedIds.includes(id));
                                if (allSelected) {
                                  setSelectedIds(prev => prev.filter(id => !groupIds.includes(id)));
                                } else {
                                  setSelectedIds(prev => Array.from(new Set([...prev, ...groupIds])));
                                }
                              }}
                              style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                            />
                          </th>
                          {templateFields.map(tf => {
                            const label = formatFieldLabel(tf.field);
                            return <th key={tf.field}>{label}</th>;
                          })}
                          <th>Enrolled On</th>
                          <th className="sticky-actions">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tCardholders.map(ch => {
                          let parsedCustom: Record<string, string> = {};
                          try {
                            parsedCustom = typeof ch.customFields === 'string' ? JSON.parse(ch.customFields) : (ch.customFields || {});
                          } catch { parsedCustom = {}; }

                          return (
                            <tr key={ch.id}>
                              <td>
                                <input
                                  type="checkbox"
                                  checked={selectedIds.includes(ch.id)}
                                  onChange={() => toggleSelect(ch.id)}
                                  style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                                />
                              </td>
                              {templateFields.map(tf => {
                                if (tf.isMainPhoto) {
                                  return (
                                    <td key={tf.field}>
                                      <div style={{ width: '40px', height: '52px', borderRadius: '4px', background: '#222', overflow: 'hidden', border: '1px solid var(--glass-border)' }}>
                                        {(() => {
                                          const effectivePhoto = getEffectivePhotoUrl(ch);
                                          return effectivePhoto ? (
                                            <img src={effectivePhoto} alt={ch.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                          ) : (
                                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', color: 'var(--muted)' }}>No Pix</div>
                                          );
                                        })()}
                                      </div>
                                    </td>
                                  );
                                }
                                if (tf.isName) {
                                  return (
                                    <td key={tf.field} style={{ fontWeight: 'bold' }}>
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
                                                <AlertCircle size={12} />
                                                {warnings.length} Issue{warnings.length > 1 ? 's' : ''}
                                              </span>
                                            );
                                          }
                                          return null;
                                        })()}
                                      </div>
                                    </td>
                                  );
                                }
                                if (tf.field === 'designation' || tf.field === 'role') {
                                  return <td key={tf.field}>{ch.designation || <span style={{ color: 'var(--muted)' }}>—</span>}</td>;
                                }
                                if (tf.field === 'uniqueKey' || tf.type === 'id' || tf.field.toLowerCase().replace(/[^a-z0-9]/g, '').includes('id')) {
                                  const custom = ch.customFields ? (typeof ch.customFields === 'string' ? JSON.parse(ch.customFields) : ch.customFields) : {};
                                  const rawVal = ch.uniqueKey || custom.uniqueKey || custom.id || custom.unique_key || parsedCustom[tf.field];
                                  const idVal = (rawVal && !String(rawVal).startsWith('C-')) ? rawVal : null;
                                  return <td key={tf.field}>{idVal ? <code>{idVal}</code> : <span style={{ color: 'var(--muted)' }}>—</span>}</td>;
                                }
                                if (tf.type === 'image') {
                                  const val = parsedCustom[tf.field];
                                  return (
                                    <td key={tf.field}>
                                      {val ? (
                                        <div style={{ width: '40px', height: '30px', borderRadius: '4px', background: '#f1f5f9', overflow: 'hidden', border: '1px solid var(--glass-border)' }}>
                                          <img src={val} alt={tf.field} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        </div>
                                      ) : (
                                        <span style={{ color: 'var(--muted)' }}>—</span>
                                      )}
                                    </td>
                                  );
                                }
                                return (
                                  <td key={tf.field}>{parsedCustom[tf.field] || <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                                );
                              })}
                              <td style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{new Date(ch.createdAt).toLocaleDateString()}</td>
                              <td className="sticky-actions">
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <button className="btn btn-secondary" style={{ padding: '6px 10px', borderColor: 'rgba(59, 130, 246, 0.3)' }} onClick={() => { setPreviewCardholder(ch); setPreviewSide('front'); }} title="Preview ID Card">
                                    <Eye size={14} style={{ color: 'var(--primary)' }} />
                                  </button>
                                  <button className="btn btn-secondary" style={{ padding: '6px 10px' }} onClick={() => openEditModal(ch)} title="Edit Cardholder">
                                    <Edit2 size={14} />
                                  </button>
                                  <button className="btn btn-danger" style={{ padding: '6px 10px' }} onClick={() => handleDeleteCardholder(ch.id)} title="Delete Cardholder">
                                    <Trash2 size={14} />
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
              ))}
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', padding: '32px', borderRadius: '16px', background: 'var(--card-bg)', border: '1px solid var(--glass-border)' }}>
            <h2 style={{ fontSize: '1.4rem', marginBottom: '24px' }}>
              {modalMode === 'add' ? 'Add New Cardholder' : 'Edit Cardholder'}
            </h2>
            <form onSubmit={handleSaveCardholder} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <input type="file" id="dept-modal-photo-input" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />

              {formFields.length === 0 && (
                <div style={{
                  padding: '12px 16px',
                  borderRadius: '8px',
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.2)',
                  color: '#fbbf24',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  lineHeight: '1.4'
                }}>
                  <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    This department template does not have any input fields configured.
                  </div>
                </div>
              )}
              
              {hasPhoto && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
                  <div style={{ width: '60px', height: '80px', borderRadius: '6px', background: '#111', overflow: 'hidden', border: '1.5px dashed var(--glass-border)', position: 'relative' }}>
                    {photoUrl ? (
                      <img src={photoUrl} alt="Cropped" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    ) : uploadingPhoto && activeCropField === 'photo' ? (
                      <div style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}><Loader className="animate-spin" size={16} /></div>
                    ) : (
                      <div style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: '0.6rem', color: 'var(--muted)', textAlign: 'center' }}>No Photo</span></div>
                    )}
                  </div>
                  <div>
                    <button type="button" className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', padding: '6px 12px' }} onClick={() => triggerUpload('photo')}>
                      <Upload size={14} /> Upload & Crop
                    </button>
                  </div>
                </div>
              )}

              {/* Custom image fields */}
              {customImgFields.map(field => {
                const label = formatFieldLabel(field.field);
                const value = customFields[field.field] || '';
                const fieldWidth = field.width || 120;
                const fieldHeight = field.height || 160;
                
                const boxWidth = 60;
                const boxHeight = (fieldHeight / fieldWidth) * boxWidth;
                const boxBorderRadius = field.borderRadius ? (field.borderRadius / fieldWidth) * boxWidth : 6;

                return (
                  <div key={field.field} style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
                    <div style={{
                      width: `${boxWidth}px`,
                      height: `${boxHeight}px`,
                      borderRadius: `${boxBorderRadius}px`,
                      background: '#111',
                      overflow: 'hidden',
                      border: '1.5px dashed var(--glass-border)',
                      position: 'relative'
                    }}>
                      {value ? (
                        <img src={value} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      ) : uploadingPhoto && activeCropField === field.field ? (
                        <div style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                          <Loader className="animate-spin" size={16} />
                        </div>
                      ) : (
                        <div style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: '0.55rem', color: 'var(--muted)', textAlign: 'center' }}>No Image</span>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.85rem', marginBottom: '4px' }}>{label}</label>
                      <button type="button" className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', padding: '4px 10px' }} onClick={() => triggerUpload(field.field)}>
                        <Upload size={12} /> Upload & Crop
                      </button>
                    </div>
                  </div>
                );
              })}

              {formFields.map(field => {
                const label = formatFieldLabel(field);
                const clean = cleanFieldKey(field);
                const isNameLike = ['name', 'fullname', 'studentname', 'employeename', 'membername', 'staffname', 'cardholdername', 'username'].includes(clean);
                const isDesignationLike = ['designation', 'role', 'jobtitle', 'post', 'profession'].includes(clean);
                const fieldMeta = fieldCoordsMap[field];
                const isDate = isDateField(field, fieldMeta?.type || fieldTypeMap[field]);
                const isNumber = (fieldMeta?.type || fieldTypeMap[field]) === 'number';
                const minCap = (fieldMeta as any)?.min;
                const maxCap = (fieldMeta as any)?.max;

                return (
                  <div className="form-group" key={field}>
                    <label className="form-label">
                      {label}{isNameLike ? ' *' : ''}
                      {isNumber && (minCap !== undefined || maxCap !== undefined) && (
                        <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginLeft: '6px', fontWeight: 'normal' }}>
                          ({minCap !== undefined && maxCap !== undefined ? `Range: ${minCap} - ${maxCap}` : (minCap !== undefined ? `Min: ${minCap}` : `Max: ${maxCap}`)})
                        </span>
                      )}
                    </label>
                    <input
                      type={isNumber ? "number" : (isDate ? "date" : "text")}
                      min={isNumber && minCap !== undefined ? minCap : undefined}
                      max={isNumber && maxCap !== undefined ? maxCap : undefined}
                      maxLength={!isNumber && !isDate && maxCap !== undefined && maxCap > 0 ? maxCap : undefined}
                      required={isNameLike}
                      className="form-input"
                      value={customFields[field] || ''}
                      onChange={e => {
                        let val = e.target.value;
                        if (isNumber && val !== '') {
                          const numVal = Number(val);
                          if (!isNaN(numVal)) {
                            if (maxCap !== undefined && maxCap !== null && numVal > maxCap) {
                              val = String(maxCap);
                            }
                          }
                        } else if (!isNumber && !isDate && maxCap !== undefined && maxCap > 0 && val.length > maxCap) {
                          val = val.substring(0, maxCap);
                        }
                        setCustomFields(prev => ({
                          ...prev,
                          [field]: val,
                        }));
                        if (isNameLike) {
                          setName(val);
                        } else if (isDesignationLike) {
                          setDesignation(val);
                        }
                      }}
                      onBlur={e => {
                        if (isNumber && e.target.value !== '') {
                          const numVal = Number(e.target.value);
                          if (!isNaN(numVal)) {
                            let clamped = numVal;
                            if (minCap !== undefined && minCap !== null && clamped < minCap) clamped = minCap;
                            if (maxCap !== undefined && maxCap !== null && clamped > maxCap) clamped = maxCap;
                            if (clamped !== numVal) {
                              setCustomFields(prev => ({ ...prev, [field]: String(clamped) }));
                            }
                          }
                        }
                      }}
                      onClick={e => {
                        if (isDate && e.currentTarget && 'showPicker' in e.currentTarget) {
                          try {
                            (e.currentTarget as any).showPicker();
                          } catch {}
                        }
                      }}
                      placeholder={
                        isNumber
                          ? (minCap !== undefined && maxCap !== undefined ? `Enter number (${minCap} to ${maxCap})` : `Enter number for ${label.toLowerCase()}`)
                          : (isDate ? 'YYYY-MM-DD' : `Enter ${label.toLowerCase()}`)
                      }
                      style={{ cursor: isDate ? 'pointer' : 'text' }}
                    />
                  </div>
                );
              })}
              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={uploadingPhoto}>Save Details</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cropper */}
      {showCropper && rawImage && (
        <ImageCropper
          imageSrc={rawImage}
          onCropComplete={handleCropComplete}
          onCancel={() => {
            setShowCropper(false);
            setActiveCropField(null);
          }}
          aspectRatio={targetAspectRatio}
          targetWidth={activeFieldCoord?.width || 120}
          targetBorderRadius={activeFieldCoord?.borderRadius || 0}
        />
      )}

      {/* Preview Modal */}
      {previewCardholder && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '480px', padding: '32px', borderRadius: '16px', background: 'var(--card-bg)', border: '1px solid var(--glass-border)', textAlign: 'center' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>ID Card Preview</h3>
            <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '20px' }}>Previewing card for <strong>{previewCardholder.name}</strong></p>
            <div style={{ borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'rgba(59,130,246,0.04)', padding: '24px', marginBottom: '20px', textAlign: 'left' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cardholder Details</div>
              {(() => {
                const photo = getEffectivePhotoUrl(previewCardholder);
                return photo ? (
                  <div style={{ marginBottom: '12px' }}>
                    <img src={photo} alt={previewCardholder.name} style={{ width: '60px', height: '80px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--glass-border)' }} />
                  </div>
                ) : null;
              })()}
              <div style={{ fontWeight: '700', fontSize: '1.1rem', marginBottom: '4px' }}>{previewCardholder.name}</div>
              {previewCardholder.designation && <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '4px' }}>{previewCardholder.designation}</div>}
              {(() => {
                const custom = previewCardholder.customFields ? (typeof previewCardholder.customFields === 'string' ? JSON.parse(previewCardholder.customFields) : previewCardholder.customFields) : {};
                const idVal = previewCardholder.uniqueKey || custom.uniqueKey || custom.id || custom.unique_key;
                return idVal ? <div style={{ fontSize: '0.8rem', color: 'var(--primary)' }}>ID: {idVal}</div> : null;
              })()}
              <div style={{ marginTop: '12px', fontSize: '0.75rem', color: 'var(--muted)', padding: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', border: '1px solid var(--glass-border)' }}>
                ℹ️ Card template preview is available in the Desktop App only.
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
              {(() => {
                const backParsed = JSON.parse(template?.backFields || '[]');
                const hasBack = backParsed.length > 0;
                if (!hasBack) return <div />;
                return (
                  <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '3px' }}>
                    {(['front', 'back'] as const).map(s => (
                      <button key={s} type="button" onClick={() => setPreviewSide(s)} style={{ padding: '4px 12px', fontSize: '0.75rem', fontWeight: '500', borderRadius: '6px', border: 'none', cursor: 'pointer', background: previewSide === s ? 'var(--primary)' : 'transparent', color: previewSide === s ? '#fff' : 'var(--muted)', transition: 'all 0.2s' }}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>
                );
              })()}
              <button className="btn btn-primary" onClick={() => setPreviewCardholder(null)}>Close Preview</button>
            </div>
          </div>
        </div>
      )}

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
