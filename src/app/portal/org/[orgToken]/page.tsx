'use client';

import React, { useState, useEffect, use } from 'react';
import ImageCropper from '@/app/components/ImageCropper';
import ConfirmDialog from '@/app/components/ConfirmDialog';
import CardPreview from '@/app/components/CardPreview';
import { 
  Users, 
  FileText, 
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
  CheckCircle2
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
}

interface Department {
  id: number;
  name: string;
  deptToken: string;
  enrollToken: string;
  enrolledCount: number;
}

export default function OrgPortalPage({ params }: { params: Promise<{ orgToken: string }> }) {
  const { orgToken } = use(params);

  const [activeTab, setActiveTab] = useState<'cardholders' | 'departments'>('cardholders');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedDeptToken, setCopiedDeptToken] = useState<string | null>(null);

  const [client, setClient] = useState<any>(null);
  const [template, setTemplate] = useState<any>(null);
  const [enrollToken, setEnrollToken] = useState('');
  const [cardholders, setCardholders] = useState<Cardholder[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [newDeptName, setNewDeptName] = useState('');
  const [creatingDept, setCreatingDept] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [formFields, setFormFields] = useState<string[]>([]);
  const [customImgFields, setCustomImgFields] = useState<any[]>([]);

  // Field visibility states
  const [hasName, setHasName] = useState(true);
  const [hasDesignation, setHasDesignation] = useState(false);
  const [hasPhoto, setHasPhoto] = useState(false);
  const [hasUniqueKey, setHasUniqueKey] = useState(false);

  // Modal States
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingCardholderId, setEditingCardholderId] = useState<number | null>(null);
  const [previewCardholder, setPreviewCardholder] = useState<Cardholder | null>(null);
  const [previewSide, setPreviewSide] = useState<'front' | 'back'>('front');

  // Form States
  const [name, setName] = useState('');
  const [designation, setDesignation] = useState('');
  const [uniqueKey, setUniqueKey] = useState('');
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

      // Parse fields
      const front = JSON.parse(shareData.template.frontFields || '[]');
      const back = JSON.parse(shareData.template.backFields || '[]');
      const allFields: any[] = [...front, ...back];
      const textFields = allFields.filter(f => f.type === 'text' || f.type === 'qr' || f.type === 'barcode' || f.type === 'id');
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
        k !== 'cardSerial' &&
        k !== 'uniqueKey'
      );
      setFormFields(filteredKeys);

      // Find all image fields
      const imageFields = allFields.filter(f => f.type === 'image');
      const mainPhoto = imageFields.find(f => f.field === 'photo' || f.field === 'avatar') || imageFields[0] || null;
      const customImages = imageFields.filter(f => f !== mainPhoto);
      setCustomImgFields(customImages);

      // Detect visibility of standard fields
      const mappedFields = allFields.map(f => f.field);
      setHasName(mappedFields.includes('name') || mappedFields.includes('fullName'));
      setHasDesignation(mappedFields.includes('designation') || mappedFields.includes('role'));
      setHasPhoto(mainPhoto !== null);
      setHasUniqueKey(mappedFields.includes('uniqueKey'));

      // 2. Fetch cardholders
      const chRes = await fetch(`/api/portal/org/${orgToken}/cardholders`);
      if (!chRes.ok) throw new Error('Failed to load cardholders');
      const chData = await chRes.json();
      setCardholders(chData.cardholders);

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

  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const handleDownloadPDF = async () => {
    if (cardholders.length === 0) return;
    try {
      setDownloadingPdf(true);
      const cardholdersData = cardholders.map(ch => ({
        id: ch.id,
        name: ch.name,
        designation: ch.designation || null,
        photoUrl: ch.photoUrl || null,
        cardSerial: ch.uniqueKey || null,
        customFields: ch.customFields ? JSON.parse(ch.customFields) : {},
      }));

      const { generateApprovalPdfClient } = await import('@/lib/pdf/approval-pdf-generator');
      
      const pdfBlob = await generateApprovalPdfClient(
        client?.name || 'Client',
        client?.name || 'Organisation',
        template,
        cardholdersData,
        []
      );

      const downloadUrl = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `Approval_Proof_${(client?.name || 'Client').replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch (err: any) {
      console.error('Failed to compile approval PDF client-side:', err);
      alert(`Error generating PDF: ${err.message || err}`);
    } finally {
      setDownloadingPdf(false);
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
    } catch (err: any) {
      alert(err.message);
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
        } catch (err: any) { alert(err.message); }
      },
    });
  };

  // Open modal helper
  const openAddModal = () => {
    setModalMode('add');
    setName('');
    setDesignation('');
    setUniqueKey('');
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
    setUniqueKey(ch.uniqueKey || '');
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
      finalCustom[k] = parsedCustom[k] || '';
    });
    customImgFields.forEach(imgField => {
      finalCustom[imgField.field] = parsedCustom[imgField.field] || '';
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
      
      if (activeCropField === 'photo') {
        setPhotoUrl(data.url);
      } else if (activeCropField) {
        setCustomFields(prev => ({
          ...prev,
          [activeCropField]: data.url,
        }));
      }
    } catch (err: any) {
      alert(err.message || 'Error uploading photo');
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
        uniqueKey: hasUniqueKey ? (uniqueKey || null) : null,
      };

      const url = modalMode === 'add'
        ? `/api/portal/org/${orgToken}/cardholders`
        : `/api/portal/org/${orgToken}/cardholders/${editingCardholderId}`;

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
    } catch (err: any) {
      alert(err.message);
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
          await loadPortalData();
        } catch (err: any) { alert(err.message); setLoading(false); }
      },
    });
  };

  // Filtered cardholders
  const filtered = cardholders.filter(ch => {
    const q = searchQuery.toLowerCase();
    return (
      ch.name.toLowerCase().includes(q) ||
      (ch.designation && ch.designation.toLowerCase().includes(q)) ||
      (ch.uniqueKey && ch.uniqueKey.toLowerCase().includes(q))
    );
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
      const allImageFields = all.filter((f: any) => f.type === 'image');
      return allImageFields.find((f: any) => f.field === 'photo' || f.field === 'avatar') || allImageFields[0] || null;
    }
    return all.find((f: any) => f.field === activeCropField) || null;
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
            <p style={{ color: 'var(--muted)', fontSize: '0.95rem' }}>Active Template: <span style={{ color: 'var(--foreground)' }}>{template?.name}</span></p>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn btn-secondary" onClick={copyEnrollmentLink} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
              Copy Global Staff Link
            </button>
            <button 
              onClick={handleDownloadPDF}
              disabled={cardholders.length === 0 || downloadingPdf}
              className="btn btn-primary" 
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                opacity: (cardholders.length === 0 || downloadingPdf) ? 0.5 : 1,
                cursor: (cardholders.length === 0 || downloadingPdf) ? 'not-allowed' : 'pointer'
              }}
            >
              {downloadingPdf ? (
                <>
                  <Loader size={16} className="animate-spin" /> Generating PDF...
                </>
              ) : (
                <>
                  <FileText size={16} /> Download Approval PDF
                </>
              )}
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
              <a 
                href={`/portal/enroll/${enrollToken}`} 
                target="_blank" 
                rel="noreferrer" 
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 'bold' }}
              >
                Open Global Enrollment Form <ExternalLink size={14} />
              </a>
            </div>

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
                      <th>Template Name</th>
                      <th>Department</th>
                      <th>Designation</th>
                      <th>Unique Key</th>
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
                      <th>Card Serial</th>
                      <th>Enrolled On</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(ch => {
                      let parsedCustom: Record<string, string> = {};
                      try {
                        parsedCustom = typeof ch.customFields === 'string' ? JSON.parse(ch.customFields) : (ch.customFields || {});
                      } catch { parsedCustom = {}; }

                      return (
                        <tr key={ch.id}>
                          <td>
                            <div style={{ width: '40px', height: '52px', borderRadius: '4px', background: '#222', overflow: 'hidden', border: '1px solid var(--glass-border)' }}>
                              {ch.photoUrl ? (
                                <img src={ch.photoUrl} alt={ch.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', color: 'var(--muted)' }}>No Pix</div>
                              )}
                            </div>
                          </td>
                          <td style={{ fontWeight: 'bold' }}>{ch.name}</td>
                          <td>{ch.templateName || <span style={{ color: 'var(--muted)' }}>—</span>}</td>
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
                          <td>{ch.designation || <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                          <td><code>{ch.uniqueKey || '—'}</code></td>

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

                          <td><code>{ch.cardSerial || '—'}</code></td>
                          <td style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                            {new Date(ch.createdAt).toLocaleDateString()}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button className="btn btn-secondary" style={{ padding: '6px 10px', borderColor: 'rgba(59, 130, 246, 0.3)' }} onClick={() => { setPreviewCardholder(ch); setPreviewSide('front'); }} title="Preview ID Card">
                                <Eye size={14} style={{ color: 'var(--primary)' }} />
                              </button>
                              <button className="btn btn-secondary" style={{ padding: '6px 10px' }} onClick={() => openEditModal(ch)}>
                                <Edit2 size={14} />
                              </button>
                              <button className="btn btn-danger" style={{ padding: '6px 10px' }} onClick={() => handleDeleteCardholder(ch.id)}>
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
                const boxBorderRadius = field.borderRadius ? (field.borderRadius / field.width) * boxWidth : 6;

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

              {hasUniqueKey && (
                <div className="form-group">
                  <label className="form-label">Unique Key / Roll No / Emp ID</label>
                  <input type="text" className="form-input" value={uniqueKey} onChange={e => setUniqueKey(e.target.value)} placeholder="Unique ID" />
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

            {/* Preview Image Frame */}
            <div style={{
              borderRadius: '12px',
              overflow: 'hidden',
              border: '1px solid var(--glass-border)',
              background: '#111',
              padding: '16px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: '260px',
              position: 'relative',
              marginBottom: '20px',
            }}>
              {template && (
                <CardPreview
                  template={template}
                  cardholder={previewCardholder}
                  side={previewSide}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '360px',
                    borderRadius: '8px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                  }}
                  key={`${previewCardholder.id}-${previewSide}`}
                />
              )}
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
