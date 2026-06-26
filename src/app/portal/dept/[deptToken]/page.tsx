'use client';

import React, { useState, useEffect, use } from 'react';
import ImageCropper from '@/app/components/ImageCropper';
import ConfirmDialog from '@/app/components/ConfirmDialog';

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
}

export default function DeptPortalPage({ params }: { params: Promise<{ deptToken: string }> }) {
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

  const [client, setClient] = useState<any>(null);
  const [template, setTemplate] = useState<any>(null);
  const [enrollToken, setEnrollToken] = useState('');
  const [latestApprovalJob, setLatestApprovalJob] = useState<any>(null);
  const [cardholders, setCardholders] = useState<Cardholder[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [formFields, setFormFields] = useState<string[]>([]);
  const [customImgFields, setCustomImgFields] = useState<any[]>([]);
  const [templateFields, setTemplateFields] = useState<any[]>([]);

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

      // Extract template fields in order
      const uniqueFields: any[] = [];
      const seen = new Set<string>();
      
      if (mainPhoto) {
        uniqueFields.push({ field: mainPhoto.field, type: 'image', isMainPhoto: true });
        seen.add(mainPhoto.field);
      }
      
      const nameField = allFields.find(f => f.field === 'name' || f.field === 'fullName');
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

      const mappedFields = allFields.map(f => f.field);
      setHasName(mappedFields.includes('name') || mappedFields.includes('fullName'));
      setHasDesignation(mappedFields.includes('designation') || mappedFields.includes('role'));
      setHasPhoto(mainPhoto !== null);
      setHasUniqueKey(mappedFields.includes('uniqueKey'));

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
    setUniqueKey('');
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
    setName(ch.name);
    setDesignation(ch.designation || '');
    setUniqueKey(ch.uniqueKey || '');
    setPhotoUrl(ch.photoUrl || '');
    let parsedCustom: Record<string, string> = {};
    try {
      parsedCustom = typeof ch.customFields === 'string' ? JSON.parse(ch.customFields) : (ch.customFields || {});
    } catch { parsedCustom = {}; }
    const finalCustom: Record<string, string> = {};
    formFields.forEach(k => { finalCustom[k] = parsedCustom[k] || ''; });
    customImgFields.forEach(imgField => { finalCustom[imgField.field] = parsedCustom[imgField.field] || ''; });
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
    } catch (err: any) {
      alert(err.message);
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
        } catch (err: any) { alert(err.message); setLoading(false); }
      },
    });
  };

  const filtered = cardholders.filter(ch => {
    const q = searchQuery.toLowerCase();
    return (
      ch.name.toLowerCase().includes(q) ||
      (ch.designation && ch.designation.toLowerCase().includes(q)) ||
      (ch.uniqueKey && ch.uniqueKey.toLowerCase().includes(q))
    );
  });

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

        {/* Toolbar */}
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

        {/* Cardholders Table */}
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
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && filtered.every(ch => selectedIds.includes(ch.id))}
                      onChange={toggleSelectAll}
                      style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                    />
                  </th>
                  {templateFields.map(tf => {
                    const label = tf.field.replace(/([A-Z])/g, ' $1').replace(/^./, (str: string) => str.toUpperCase());
                    return <th key={tf.field}>{label}</th>;
                  })}
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
                                {ch.photoUrl ? (
                                  <img src={ch.photoUrl} alt={ch.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', color: 'var(--muted)' }}>No Pix</div>
                                )}
                              </div>
                            </td>
                          );
                        }
                        if (tf.isName) {
                          return <td key={tf.field} style={{ fontWeight: 'bold' }}>{ch.name}</td>;
                        }
                        if (tf.field === 'designation' || tf.field === 'role') {
                          return <td key={tf.field}>{ch.designation || <span style={{ color: 'var(--muted)' }}>—</span>}</td>;
                        }
                        if (tf.field === 'uniqueKey') {
                          return <td key={tf.field}><code>{ch.uniqueKey || '—'}</code></td>;
                        }
                        if (tf.type === 'image') {
                          const val = parsedCustom[tf.field];
                          return (
                            <td key={tf.field}>
                              {val ? (
                                <div style={{ width: '40px', height: '30px', borderRadius: '4px', background: '#222', overflow: 'hidden', border: '1px solid var(--glass-border)' }}>
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
              {formFields.map(field => {
                const label = field.replace(/([A-Z])/g, ' $1').replace(/^./, (str: string) => str.toUpperCase());
                return (
                  <div className="form-group" key={field}>
                    <label className="form-label">{label}</label>
                    <input type="text" className="form-input" value={customFields[field] || ''} onChange={e => setCustomFields({ ...customFields, [field]: e.target.value })} placeholder={`Enter ${label.toLowerCase()}`} />
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
              {previewCardholder.photoUrl && (
                <div style={{ marginBottom: '12px' }}>
                  <img src={previewCardholder.photoUrl} alt={previewCardholder.name} style={{ width: '60px', height: '80px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--glass-border)' }} />
                </div>
              )}
              <div style={{ fontWeight: '700', fontSize: '1.1rem', marginBottom: '4px' }}>{previewCardholder.name}</div>
              {previewCardholder.designation && <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '4px' }}>{previewCardholder.designation}</div>}
              {previewCardholder.uniqueKey && <div style={{ fontSize: '0.8rem', color: 'var(--primary)' }}>ID: {previewCardholder.uniqueKey}</div>}
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
