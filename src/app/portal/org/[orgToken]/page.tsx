'use client';

import React, { useState, useEffect, use } from 'react';
import ImageCropper from '@/app/components/ImageCropper';
import ConfirmDialog from '@/app/components/ConfirmDialog';
import CardPreview from '@/app/components/CardPreview';
import { ToastProvider, useToast } from '@/components/ui/toast';
import { getResolvedFieldValue, isPlaceholderStaticValue } from '@/lib/pdf/card-renderer-client';

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
  ExternalLink,
  Eye,
  Building,
  CheckCircle2,
  X
} from 'lucide-react';

interface Cardholder {
  id: number;
  name: string;
  designation?: string;
  photoUrl?: string;
  customFields?: string; // JSON string
  uniqueKey?: string;
  cardSerial?: string;
  createdAt: string;
  enrollToken?: string;
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
  cardWidth: number;
  cardHeight: number;
  frontImageUrl: string;
  backImageUrl: string | null;
  frontOriginalUrl?: string | null;
  backOriginalUrl?: string | null;
  frontFields: string;
  backFields: string;
  validTillDate?: string | null;
}

interface Department {
  id: number;
  name: string;
  deptToken: string;
  enrollToken: string;
  enrolledCount: number;
}

export default function OrgPortalPage({ params }: { params: Promise<{ orgToken: string }> }) {
  return (
    <ToastProvider>
      <OrgPortalPageContent params={params} />
    </ToastProvider>
  );
}

function OrgPortalPageContent({ params }: { params: Promise<{ orgToken: string }> }) {
  const { toast } = useToast();
  const { orgToken } = use(params);

  const [activeTab, setActiveTab] = useState<'cardholders' | 'departments'>('cardholders');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedDeptToken, setCopiedDeptToken] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [togglingPreview, setTogglingPreview] = useState(false);

  const [client, setClient] = useState<Client | null>(null);
  const [template, setTemplate] = useState<Template | null>(null);
  const [enrollToken, setEnrollToken] = useState('');
  const [cardholders, setCardholders] = useState<Cardholder[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [newDeptName, setNewDeptName] = useState('');
  const [creatingDept, setCreatingDept] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterWarningsOnly, setFilterWarningsOnly] = useState(false);
  const [formFields, setFormFields] = useState<string[]>([]);
  const [customImgFields, setCustomImgFields] = useState<FieldCoordinate[]>([]);

  // Field visibility states
  const [hasName, setHasName] = useState(true);
  const [hasDesignation, setHasDesignation] = useState(false);
  const [hasPhoto, setHasPhoto] = useState(false);

  // Modal States
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingCardholderId, setEditingCardholderId] = useState<number | null>(null);
  const [previewCardholder, setPreviewCardholder] = useState<Cardholder | null>(null);
  const [previewSide, setPreviewSide] = useState<'front' | 'back'>('front');
  const [selectedCh, setSelectedCh] = useState<Cardholder | null>(null);
  const [pressFonts, setPressFonts] = useState<any[]>([]);
  const [hasInitialSelected, setHasInitialSelected] = useState(false);

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

  // Confirm dialog state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string; message: string; confirmLabel: string; variant: 'danger' | 'warning'; onConfirm: () => void;
  } | null>(null);
  const showConfirm = (cfg: typeof confirmConfig) => { setConfirmConfig(cfg); setConfirmOpen(true); };
  const closeConfirm = () => { setConfirmOpen(false); setConfirmConfig(null); };

  // Fetch initial portal configuration & cardholders list
  const loadPortalData = async () => {
    try {
      // 1. Fetch share details
      const shareRes = await fetch(`/api/portal/shares/${orgToken}`);
      if (!shareRes.ok) throw new Error('Portal link is invalid or deactivated');
      const shareData = await shareRes.json();
      setClient(shareData.client);
      setTemplate(shareData.template);
      setEnrollToken(shareData.share.enrollToken);
      setShowPreview(shareData.share.showPreview ?? false);
      setPressFonts(shareData.pressFonts || []);

      // Parse fields
      const front = JSON.parse(shareData.template.frontFields || '[]');
      const back = JSON.parse(shareData.template.backFields || '[]');
      const allFields: FieldCoordinate[] = [...front, ...back];
      // Include user-fillable text and ID fields
      const textFields = allFields.filter(f => f.type === 'text' || f.type === 'id');
      const keys = Array.from(new Set(textFields.map(f => f.field)));
      const filteredKeys = keys.filter(k => 
        k !== 'name' && 
        k !== 'fullName' &&
        k !== 'designation' && 
        k !== 'role' &&
        k !== 'photo' && 
        k !== 'avatar' &&
        k !== 'validTill' &&
        k !== 'validTillDate' &&
        k !== 'cardSerial'
      );
      setFormFields(filteredKeys);

      // Find all image fields
      const imageFields = allFields.filter(f => f.type === 'image');
      const mainPhoto = imageFields.find(f => 
        f.field === 'photo' || 
        f.field === 'avatar' || 
        f.field === 'photoUrl' ||
        f.field.toLowerCase().includes('photo') || 
        f.field.toLowerCase().includes('avatar') || 
        f.field.toLowerCase().includes('profile')
      ) || null;
      const customImages = imageFields.filter(f => f !== mainPhoto);
      setCustomImgFields(customImages);

      // Detect visibility of standard fields
      const mappedFields = allFields.map(f => f.field);
      setHasName(mappedFields.includes('name') || mappedFields.includes('fullName'));
      setHasDesignation(mappedFields.includes('designation') || mappedFields.includes('role'));
      setHasPhoto(mainPhoto !== null);

      // 2. Fetch cardholders
      const chRes = await fetch(`/api/portal/org/${orgToken}/cardholders`);
      if (!chRes.ok) throw new Error('Failed to load cardholders');
      const chData = await chRes.json();
      setCardholders(chData.cardholders);
      setSelectedCh(prev => {
        if (prev) {
          return chData.cardholders.find((c: any) => c.id === prev.id) || null;
        }
        if (!hasInitialSelected) {
          setHasInitialSelected(true);
          return chData.cardholders[0] || null;
        }
        return null;
      });

      // 3. Fetch departments
      const deptRes = await fetch(`/api/portal/org/${orgToken}/departments`);
      if (deptRes.ok) {
        const deptData = await deptRes.json();
        setDepartments(deptData.departments);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred loading the portal');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPortalData();
  }, [orgToken]);

  // Copy Enrollment Link helper
  const copyEnrollmentLink = () => {
    const link = `${window.location.origin}/portal/enroll/${enrollToken}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const togglePreview = async () => {
    setTogglingPreview(true);
    try {
      const res = await fetch(`/api/portal/shares/${orgToken}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showPreview: !showPreview }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowPreview(data.showPreview);
      }
    } catch (err) {
      console.error('Failed to toggle preview:', err);
    } finally {
      setTogglingPreview(false);
    }
  };



  // Copy department links helper
  const copyDeptLink = (token: string, type: 'dept' | 'enroll') => {
    const link = type === 'dept'
      ? `${window.location.origin}/portal/dept/${token}`
      : `${window.location.origin}/portal/enroll/${token}`;
    
    navigator.clipboard.writeText(link);
    setCopiedDeptToken(`${type}-${token}`);
    setTimeout(() => setCopiedDeptToken(null), 2000);
  };

  // Handle department creation
  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim()) return;

    setCreatingDept(true);
    try {
      const res = await fetch(`/api/portal/org/${orgToken}/departments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newDeptName }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create department');
      }

      setNewDeptName('');
      
      // Reload department list and counts
      const deptRes = await fetch(`/api/portal/org/${orgToken}/departments`);
      if (deptRes.ok) {
        const deptData = await deptRes.json();
        setDepartments(deptData.departments);
      }
      toast('Department created successfully', 'success');
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setCreatingDept(false);
    }
  };

  // Handle department deletion
  const handleDeleteDepartment = (id: number) => {
    showConfirm({
      title: 'Delete Department',
      message: 'Cardholders enrolled through this department link will remain, but the department link will stop working.',
      confirmLabel: 'Delete',
      variant: 'danger',
      onConfirm: async () => {
        closeConfirm();
        try {
          const res = await fetch(`/api/portal/org/${orgToken}/departments/${id}`, { method: 'DELETE' });
          if (!res.ok) throw new Error('Failed to delete department');
          setDepartments(departments.filter(d => d.id !== id));
          toast('Department deleted successfully', 'success');
        } catch (err: any) { toast(err.message, 'error'); }
      },
    });
  };

  // Open modal helper
  const openAddModal = () => {
    setModalMode('add');
    setName('');
    setDesignation('');
    setPhotoUrl('');
    const initialCustom: Record<string, string> = {};
    formFields.forEach(k => {
      initialCustom[k] = '';
    });
    customImgFields.forEach(imgField => {
      initialCustom[imgField.field] = '';
    });
    setCustomFields(initialCustom);
    setShowModal(true);
  };

  const openEditModal = (ch: Cardholder) => {
    setModalMode('edit');
    setEditingCardholderId(ch.id);
    setName(ch.name);
    setDesignation(ch.designation || '');
    setPhotoUrl(ch.photoUrl || '');
    
    // Parse custom fields
    let parsedCustom: Record<string, string> = {};
    try {
      parsedCustom = typeof ch.customFields === 'string' ? JSON.parse(ch.customFields) : (ch.customFields || {});
    } catch (e) {
      parsedCustom = {};
    }
    
    // Ensure all template fields exist in customFields
    const finalCustom: Record<string, string> = {};
    formFields.forEach(k => {
      finalCustom[k] = getCustomFieldValueCaseInsensitive(parsedCustom, k) || '';
    });
    customImgFields.forEach(imgField => {
      finalCustom[imgField.field] = getCustomFieldValueCaseInsensitive(parsedCustom, imgField.field) || '';
    });
    setCustomFields(finalCustom);
    setShowModal(true);
  };

  const triggerUpload = (fieldKey: string) => {
    setActiveCropField(fieldKey);
    document.getElementById('org-modal-photo-input')?.click();
  };

  // Crop image handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setRawImage(reader.result as string);
      setShowCropper(true);
    };
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
      formData.append('token', orgToken);
      formData.append('type', 'photo');

      const uploadRes = await fetch('/api/portal/upload', {
        method: 'POST',
        body: formData,
      });

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

  // Save Cardholder (Submit handler)
  const handleSaveCardholder = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = hasName ? name : 'Cardholder';
    if (!finalName) return;

    setLoading(true);
    try {
      const payload = {
        name: finalName,
        designation: hasDesignation ? (designation || null) : null,
        photoUrl: hasPhoto ? (photoUrl || null) : null,
        customFields,
      };

      const url = modalMode === 'add'
        ? `/api/portal/org/${orgToken}/cardholders`
        : `/api/portal/org/[orgToken]/cardholders/${editingCardholderId}`; // Wait, let's keep the exact original template string: /api/portal/org/${orgToken}/cardholders/${editingCardholderId}
      const res = await fetch(modalMode === 'add' ? `/api/portal/org/${orgToken}/cardholders` : `/api/portal/org/${orgToken}/cardholders/${editingCardholderId}`, {
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

  // Delete Cardholder
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
          const res = await fetch(`/api/portal/org/${orgToken}/cardholders/${id}`, { method: 'DELETE' });
          if (!res.ok) throw new Error('Failed to delete cardholder');
          setSelectedCh(prev => prev?.id === id ? null : prev);
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

        if (f.type === 'id' || fieldClean === 'uniquekey' || fieldClean === 'id' || fieldClean === 'studentid' || fieldClean === 'rollnumber' || fieldClean === 'admissionnumber') {
          const idVal = getResolvedFieldValue(f.field, cardholderData, ch) || ch.uniqueKey || parsedCustom.uniqueKey || parsedCustom.id || parsedCustom.unique_key;
          if (!idVal || String(idVal).trim() === '') {
            warnings.push('Unique ID/Key is missing');
          }
          return;
        }

        if (f.type === 'image') {
          const imgVal = getResolvedFieldValue(f.field, cardholderData, ch) || (fieldClean.includes('photo') || fieldClean.includes('avatar') || fieldClean.includes('profile') ? ch.photoUrl : null);
          if (!imgVal || String(imgVal).trim() === '' || String(imgVal) === 'null' || String(imgVal) === 'undefined') {
            const label = f.field.replace(/([A-Z])/g, ' $1').replace(/^./, (str: string) => str.toUpperCase());
            warnings.push(`${label} is missing`);
          }
          return;
        }

        const val = getResolvedFieldValue(f.field, cardholderData, ch);
        if (val === undefined || val === null || String(val).trim() === '' || String(val) === 'null' || String(val) === 'undefined') {
          const label = f.field.replace(/([A-Z])/g, ' $1').replace(/^./, (str: string) => str.toUpperCase());
          warnings.push(`${label} is missing`);
        }
      });
    } catch (e) {
      console.error('Error validating cardholder in org portal', e);
    }
    
    return warnings;
  };

  // Filtered cardholders
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

  // Helper to find a department's name based on cardholder's enrollToken
  const getCardholderDeptName = (ch: Cardholder) => {
    if (!ch.enrollToken) return '—';
    if (ch.enrollToken === enrollToken) return 'Global (No Dept)';
    const dept = departments.find(d => d.enrollToken === ch.enrollToken);
    return dept ? dept.name : 'Unknown Department';
  };

  if (loading && cardholders.length === 0 && !error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--page-bg)', color: 'var(--foreground)' }}>
        <div style={{ textAlign: 'center' }}>
          <Loader className="animate-spin" size={48} style={{ margin: '0 auto 16px', color: 'var(--primary)' }} />
          <p style={{ color: 'var(--muted)' }}>Loading client portal...</p>
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
        
        {/* Header Section */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '24px', marginBottom: '24px', paddingBottom: '24px', borderBottom: '1px solid var(--glass-border)' }}>
          <div>
            <span style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {client?.type} MANAGEMENT PORTAL (ORGANISATION HEAD)
            </span>
            <h1 style={{ fontSize: '2.2rem', marginTop: '8px', marginBottom: '4px' }}>{client?.name}</h1>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn btn-secondary" onClick={copyEnrollmentLink} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
              Copy Global Staff Link
            </button>
          </div>
        </div>

        {/* Tab Selection Navigation */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '28px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '8px' }}>
          <button 
            type="button" 
            onClick={() => setActiveTab('cardholders')}
            style={{
              padding: '8px 16px',
              fontWeight: '600',
              fontSize: '0.95rem',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'cardholders' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
              color: activeTab === 'cardholders' ? 'var(--primary)' : 'var(--muted)',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Users size={16} /> Enrolled Cardholders
          </button>
          <button 
            type="button" 
            onClick={() => setActiveTab('departments')}
            style={{
              padding: '8px 16px',
              fontWeight: '600',
              fontSize: '0.95rem',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'departments' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
              color: activeTab === 'departments' ? 'var(--primary)' : 'var(--muted)',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Building size={16} /> Departments ({departments.length})
          </button>
        </div>

        {activeTab === 'cardholders' ? (
          <>
            {/* Info Box */}
            <div className="card" style={{ padding: '20px', background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.1)', marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h4 style={{ fontSize: '0.95rem', marginBottom: '4px' }}>Register cardholders or share links</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: 0 }}>
                  You can register cardholders manually or generate department links so department managers can handle registration.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                {/* Card Preview Toggle */}
                <button
                  type="button"
                  onClick={togglePreview}
                  disabled={togglingPreview}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 14px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    borderRadius: '8px',
                    border: showPreview ? '1px solid rgba(16,185,129,0.7)' : '1px solid var(--glass-border)',
                    background: showPreview ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255,255,255,0.05)',
                    color: showPreview ? '#10b981' : 'var(--muted)',
                    cursor: togglingPreview ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    opacity: togglingPreview ? 0.6 : 1,
                  }}
                  title={showPreview ? 'Click to hide card preview on enrollment form' : 'Click to show card preview on enrollment form'}
                >
                  <Eye size={14} />
                  {showPreview ? 'Preview: ON' : 'Preview: OFF'}
                </button>
                <a 
                  href={`/portal/enroll/${enrollToken}`} 
                  target="_blank" 
                  rel="noreferrer" 
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 'bold' }}
                >
                  Open Global Enrollment Form <ExternalLink size={14} />
                </a>
              </div>
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

            <div style={{
              display: 'flex',
              gap: '24px',
              alignItems: 'flex-start',
              width: '100%',
              position: 'relative'
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Toolbar & Search */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative', width: '100%', maxWidth: '400px' }}>
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

                  <button className="btn btn-secondary" onClick={openAddModal} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Plus size={16} /> Add Cardholder
                  </button>
                </div>

                {/* Cardholders Table */}
                {filtered.length === 0 ? (
                  <div className="card" style={{ padding: '48px', textAlign: 'center', border: '1.5px dashed var(--glass-border)' }}>
                    <Users size={48} style={{ color: 'var(--muted)', margin: '0 auto 16px' }} />
                    <h3>No cardholders enrolled yet</h3>
                    <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '24px' }}>
                      Enrolled students or employees will appear here in real-time.
                    </p>
                    <button className="btn btn-primary" onClick={openAddModal}>Add First Cardholder</button>
                  </div>
                ) : (
                  <div className="table-container">
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>Photo</th>
                          <th>Name</th>
                          <th>Department</th>
                          {hasDesignation && <th>Designation</th>}
                          {/* Dynamic Custom Text Fields */}
                          {formFields.map(field => {
                            const label = field.replace(/([A-Z])/g, ' $1').replace(/^./, (str: string) => str.toUpperCase());
                            return <th key={field}>{label}</th>;
                          })}
                          {/* Dynamic Custom Image Fields */}
                          {customImgFields.map(field => {
                            const label = field.field.replace(/([A-Z])/g, ' $1').replace(/^./, (str: string) => str.toUpperCase());
                            return <th key={field.field}>{label}</th>;
                          })}
                          <th>Enrolled On</th>
                          <th className="sticky-actions">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map(ch => {
                          let parsedCustom: Record<string, string> = {};
                          try {
                            parsedCustom = typeof ch.customFields === 'string' ? JSON.parse(ch.customFields) : (ch.customFields || {});
                          } catch { parsedCustom = {}; }

                          return (
                            <tr 
                              key={ch.id}
                              onClick={() => setSelectedCh(ch)}
                              style={{
                                cursor: 'pointer',
                                background: selectedCh?.id === ch.id ? 'rgba(59, 130, 246, 0.08)' : undefined,
                                transition: 'all 0.2s',
                              }}
                            >
                              <td>
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
                              <td style={{ fontWeight: 'bold' }}>
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
                              <td style={{ fontSize: '0.85rem' }}>
                                <span style={{
                                  padding: '3px 8px',
                                  borderRadius: '4px',
                                  background: ch.enrollToken === enrollToken || !ch.enrollToken ? 'rgba(255,255,255,0.05)' : 'rgba(59, 130, 246, 0.1)',
                                  color: ch.enrollToken === enrollToken || !ch.enrollToken ? 'var(--muted)' : 'var(--primary)',
                                  border: '1px solid var(--glass-border)'
                                }}>
                                  {getCardholderDeptName(ch)}
                                </span>
                              </td>
                              {hasDesignation && <td>{ch.designation || <span style={{ color: 'var(--muted)' }}>—</span>}</td>}

                              {/* Dynamic Custom Text Fields */}
                              {formFields.map(field => (
                                <td key={field}>{parsedCustom[field] || <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                              ))}

                              {/* Dynamic Custom Image Fields */}
                              {customImgFields.map(field => {
                                const val = parsedCustom[field.field];
                                return (
                                  <td key={field.field}>
                                    {val ? (
                                      <div style={{ width: '40px', height: '30px', borderRadius: '4px', background: '#222', overflow: 'hidden', border: '1px solid var(--glass-border)' }}>
                                        <img src={val} alt={field.field} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                      </div>
                                    ) : (
                                      <span style={{ color: 'var(--muted)' }}>—</span>
                                    )}
                                  </td>
                                );
                              })}

                              <td style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                                {new Date(ch.createdAt).toLocaleDateString()}
                              </td>
                              <td className="sticky-actions">
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <button className="btn btn-secondary" style={{ padding: '6px 10px', borderColor: 'rgba(59, 130, 246, 0.3)' }} onClick={(e) => { e.stopPropagation(); setSelectedCh(ch); }} title="Preview ID Card">
                                    <Eye size={14} style={{ color: 'var(--primary)' }} />
                                  </button>
                                  <button className="btn btn-secondary" style={{ padding: '6px 10px' }} onClick={(e) => { e.stopPropagation(); openEditModal(ch); }} title="Edit Cardholder">
                                    <Edit2 size={14} />
                                  </button>
                                  <button className="btn btn-danger" style={{ padding: '6px 10px' }} onClick={(e) => { e.stopPropagation(); handleDeleteCardholder(ch.id); }} title="Delete Cardholder">
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
                )}
              </div>

              {/* Side Preview Panel */}
              {selectedCh && template && (
                <div style={{
                  width: '360px',
                  flexShrink: 0,
                  position: 'sticky',
                  top: '24px',
                  background: 'var(--card-bg)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '16px',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '20px',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                  maxHeight: 'calc(100vh - 80px)',
                  overflowY: 'auto'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>ID Card Preview</h3>
                    <button 
                      onClick={() => setSelectedCh(null)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--muted)',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '50%',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Card Preview Renderer */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                    <CardPreview
                      template={template}
                      cardholder={{
                        ...selectedCh,
                        customFields: typeof selectedCh.customFields === 'string' ? selectedCh.customFields : JSON.stringify(selectedCh.customFields || {}),
                      }}
                      side={previewSide}
                      pressFonts={pressFonts}
                      forceWeb={true}
                      style={{
                        width: '100%',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                        borderRadius: '12px',
                      }}
                    />

                    {/* Front / Back switch */}
                    {template.backImageUrl && (
                      <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                        <button
                          onClick={() => setPreviewSide('front')}
                          style={{
                            padding: '6px 16px',
                            borderRadius: '6px',
                            border: 'none',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            background: previewSide === 'front' ? 'var(--primary)' : 'transparent',
                            color: previewSide === 'front' ? '#000' : 'var(--muted)',
                            transition: 'all 0.2s'
                          }}
                        >
                          Front
                        </button>
                        <button
                          onClick={() => setPreviewSide('back')}
                          style={{
                            padding: '6px 16px',
                            borderRadius: '6px',
                            border: 'none',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            background: previewSide === 'back' ? 'var(--primary)' : 'transparent',
                            color: previewSide === 'back' ? '#000' : 'var(--muted)',
                            transition: 'all 0.2s'
                          }}
                        >
                          Back
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Cardholder metadata */}
                  <div style={{
                    borderTop: '1px solid var(--glass-border)',
                    paddingTop: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    fontSize: '0.85rem'
                  }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Cardholder Information</div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--muted)' }}>Name:</span>
                      <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>{selectedCh.name}</span>
                    </div>

                    {hasDesignation && selectedCh.designation && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--muted)' }}>Designation:</span>
                        <span style={{ color: 'var(--foreground)' }}>{selectedCh.designation}</span>
                      </div>
                    )}



                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--muted)' }}>Department:</span>
                      <span style={{ color: 'var(--foreground)' }}>{getCardholderDeptName(selectedCh)}</span>
                    </div>

                    {/* Custom fields */}
                    {(() => {
                      let parsedCustom: Record<string, string> = {};
                      try {
                        parsedCustom = typeof selectedCh.customFields === 'string' ? JSON.parse(selectedCh.customFields) : (selectedCh.customFields || {});
                      } catch { parsedCustom = {}; }
                      
                      const entries = Object.entries(parsedCustom).filter(([k, v]) => {
                        return v && typeof v === 'string' && !v.startsWith('data:') && !v.startsWith('http');
                      });

                      if (entries.length === 0) return null;

                      return (
                        <>
                          <div style={{ borderTop: '1px solid var(--glass-border)', margin: '4px 0' }} />
                          {entries.map(([key, val]) => {
                            const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                            return (
                              <div key={key} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--muted)' }}>{label}:</span>
                                <span style={{ color: 'var(--foreground)', textAlign: 'right' }}>{val}</span>
                              </div>
                            );
                          })}
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          /* DEPARTMENTS TAB CONTENT */
          <div>
            <div className="card" style={{ padding: '24px', background: 'var(--card-bg)', border: '1px solid var(--glass-border)', borderRadius: '12px', marginBottom: '32px' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Building size={18} style={{ color: 'var(--primary)' }} /> Create a Department
              </h3>
              <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '20px' }}>
                Create a department to generate a separate Department Head link (for managing department-level data) and a Staff Enrollment Link (for staff to submit their data).
              </p>
              
              <form onSubmit={handleCreateDepartment} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <input 
                  type="text" 
                  className="form-input" 
                  style={{ flex: 1, minWidth: '240px' }} 
                  placeholder="e.g. Sales, Human Resources, Engineering..."
                  value={newDeptName}
                  onChange={e => setNewDeptName(e.target.value)}
                  required
                />
                <button type="submit" className="btn btn-primary" disabled={creatingDept}>
                  {creatingDept ? 'Creating...' : 'Create Department'}
                </button>
              </form>
            </div>

            {/* List of Departments */}
            {departments.length === 0 ? (
              <div className="card" style={{ padding: '48px', textAlign: 'center', border: '1.5px dashed var(--glass-border)' }}>
                <Building size={48} style={{ color: 'var(--muted)', margin: '0 auto 16px' }} />
                <h3>No departments created yet</h3>
                <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
                  Create departments above to start structuring your organization.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {departments.map(dept => (
                  <div 
                    key={dept.id} 
                    className="card" 
                    style={{ 
                      padding: '24px', 
                      background: 'var(--card-bg)', 
                      border: '1px solid var(--glass-border)', 
                      borderRadius: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '16px'
                    }}
                  >
                    {/* Dept Title and Stats */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)' }} />
                        <h3 style={{ margin: 0, fontSize: '1.25rem' }}>{dept.name}</h3>
                        <span style={{
                          fontSize: '0.75rem',
                          background: 'rgba(59, 130, 246, 0.1)',
                          color: 'var(--primary)',
                          padding: '3px 8px',
                          borderRadius: '12px',
                          fontWeight: 'bold'
                        }}>
                          {dept.enrolledCount} Member{dept.enrolledCount !== 1 ? 's' : ''} Enrolled
                        </span>
                      </div>
                      <button 
                        type="button" 
                        className="btn btn-danger" 
                        style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                        onClick={() => handleDeleteDepartment(dept.id)}
                      >
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>

                    {/* Department Head & Staff Links */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginTop: '8px' }}>
                      {/* Dept Head Link */}
                      <div style={{ background: 'rgba(0,0,0,0.15)', padding: '14px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#f59e0b' }}>
                            Department Head Portal Link
                          </span>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button 
                              type="button"
                              className="btn btn-secondary" 
                              style={{ padding: '3px 8px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                              onClick={() => copyDeptLink(dept.deptToken, 'dept')}
                            >
                              {copiedDeptToken === `dept-${dept.deptToken}` ? <CheckCircle2 size={12} style={{ color: 'var(--success)' }} /> : <Copy size={12} />}
                              Copy
                            </button>
                            <a 
                              href={`/portal/dept/${dept.deptToken}`} 
                              target="_blank" 
                              rel="noreferrer"
                              className="btn btn-secondary"
                              style={{ padding: '3px 6px', display: 'flex', alignItems: 'center' }}
                            >
                              <ExternalLink size={12} />
                            </a>
                          </div>
                        </div>
                        <code style={{ fontSize: '0.75rem', color: 'var(--muted)', wordBreak: 'break-all' }}>
                          {window.location.origin}/portal/dept/{dept.deptToken}
                        </code>
                      </div>

                      {/* Staff Link */}
                      <div style={{ background: 'rgba(0,0,0,0.15)', padding: '14px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#10b981' }}>
                            Department Staff Enrollment Link
                          </span>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button 
                              type="button"
                              className="btn btn-secondary" 
                              style={{ padding: '3px 8px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                              onClick={() => copyDeptLink(dept.enrollToken, 'enroll')}
                            >
                              {copiedDeptToken === `enroll-${dept.enrollToken}` ? <CheckCircle2 size={12} style={{ color: 'var(--success)' }} /> : <Copy size={12} />}
                              Copy
                            </button>
                            <a 
                              href={`/portal/enroll/${dept.enrollToken}`} 
                              target="_blank" 
                              rel="noreferrer"
                              className="btn btn-secondary"
                              style={{ padding: '3px 6px', display: 'flex', alignItems: 'center' }}
                            >
                              <ExternalLink size={12} />
                            </a>
                          </div>
                        </div>
                        <code style={{ fontSize: '0.75rem', color: 'var(--muted)', wordBreak: 'break-all' }}>
                          {window.location.origin}/portal/enroll/{dept.enrollToken}
                        </code>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Add / Edit Cardholder Modal */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(4px)',
          zIndex: 999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', padding: '32px', borderRadius: '16px', background: 'var(--card-bg)', border: '1px solid var(--glass-border)' }}>
            <h2 style={{ fontSize: '1.4rem', marginBottom: '24px' }}>
              {modalMode === 'add' ? 'Add New Cardholder' : 'Edit Cardholder'}
            </h2>

            <form onSubmit={handleSaveCardholder} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <input type="file" id="org-modal-photo-input" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
              
              {/* Photo Input with Crop */}
              {hasPhoto && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
                  <div style={{
                    width: '60px',
                    height: '80px',
                    borderRadius: '6px',
                    background: '#111',
                    overflow: 'hidden',
                    border: '1.5px dashed var(--glass-border)',
                    position: 'relative',
                  }}>
                    {photoUrl ? (
                      <img src={photoUrl} alt="Cropped" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    ) : uploadingPhoto && activeCropField === 'photo' ? (
                      <div style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                        <Loader className="animate-spin" size={16} />
                      </div>
                    ) : (
                      <div style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '0.6rem', color: 'var(--muted)', textAlign: 'center' }}>No Photo</span>
                      </div>
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
                const label = field.field.replace(/([A-Z])/g, ' $1').replace(/^./, (str: string) => str.toUpperCase());
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

              {/* Standard inputs */}
              {hasName && (
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input type="text" className="form-input" required value={name} onChange={e => setName(e.target.value)} placeholder="Full Name" />
                </div>
              )}

              {hasDesignation && (
                <div className="form-group">
                  <label className="form-label">Designation / Role</label>
                  <input type="text" className="form-input" value={designation} onChange={e => setDesignation(e.target.value)} placeholder="Student, Employee, etc." />
                </div>
              )}



              {/* Custom fields mapped dynamically */}
              {formFields.map(field => {
                const label = field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                return (
                  <div className="form-group" key={field}>
                    <label className="form-label">{label}</label>
                    <input
                      type="text"
                      className="form-input"
                      value={customFields[field] || ''}
                      onChange={e => {
                        setCustomFields({
                          ...customFields,
                          [field]: e.target.value,
                        });
                      }}
                      placeholder={`Enter ${label.toLowerCase()}`}
                    />
                  </div>
                );
              })}

              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={uploadingPhoto}>
                  Save Details
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cropper Overlay */}
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

      {/* Card Preview Modal */}
      {previewCardholder && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(6px)',
          zIndex: 999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '480px', padding: '32px', borderRadius: '16px', background: 'var(--card-bg)', border: '1px solid var(--glass-border)', textAlign: 'center' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>ID Card Preview</h3>
            <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '20px' }}>
              Previewing card for <strong>{previewCardholder.name}</strong>
            </p>

            {/* Preview: template images stored locally on Desktop App — not available on web portal */}
            <div style={{
              borderRadius: '12px',
              border: '1px solid var(--glass-border)',
              background: 'rgba(59,130,246,0.04)',
              padding: '24px',
              marginBottom: '20px',
              textAlign: 'left',
            }}>
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

            {/* Toggle / Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
              {/* Back side toggle if backFields has fields */}
              {(() => {
                const backParsed = JSON.parse(template?.backFields || '[]');
                const hasBack = backParsed.length > 0;
                if (!hasBack) return <div />;
                return (
                  <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '3px' }}>
                    {(['front', 'back'] as const).map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setPreviewSide(s)}
                        style={{
                          padding: '4px 12px',
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          borderRadius: '6px',
                          border: 'none',
                          cursor: 'pointer',
                          background: previewSide === s ? 'var(--primary)' : 'transparent',
                          color: previewSide === s ? '#fff' : 'var(--muted)',
                          transition: 'all 0.2s',
                        }}
                      >
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>
                );
              })()}

              <button className="btn btn-primary" onClick={() => setPreviewCardholder(null)}>
                Close Preview
              </button>
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
