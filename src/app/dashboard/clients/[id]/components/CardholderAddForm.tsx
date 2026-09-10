'use client';

import React, { useState } from 'react';
import { useToast } from '@/components/ui/toast';

interface CardholderAddFormProps {
  clientId: number;
  clientTemplates: any[];
  onSuccess: () => void;
  onCancel: () => void;
}

export function CardholderAddForm({
  clientId,
  clientTemplates,
  onSuccess,
  onCancel,
}: CardholderAddFormProps) {
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [designation, setDesignation] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [uniqueKey, setUniqueKey] = useState('');
  const [customFields, setCustomFields] = useState('');
  const [addError, setAddError] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [addTemplateId, setAddTemplateId] = useState('');

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
      onSuccess();
    } catch (err: any) {
      setAddError(err.message || 'JSON parsing or server error occurred');
    } finally {
      setAddLoading(false);
    }
  };

  return (
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
          <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={addLoading}>
            {addLoading ? 'Saving...' : 'Add Cardholder'}
          </button>
        </div>
      </form>
    </div>
  );
}
