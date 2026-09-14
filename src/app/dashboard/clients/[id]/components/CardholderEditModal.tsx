'use client';
import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { getCustomFieldValueCaseInsensitive } from './utils';
import { formatFieldLabel, normalizeGoogleDriveUrl } from '@/lib/pdf/card-renderer-client';

export function CardholderEditModal({
  cardholder,
  clientTemplates,
  onSave,
  onClose,
}: {
  cardholder: any;
  clientTemplates: any[];
  onSave: () => void;
  onClose: () => void;
}) {
  const { toast } = useToast();

  const [editName, setEditName] = useState('');
  const [editDesignation, setEditDesignation] = useState('');
  const [editUniqueKey, setEditUniqueKey] = useState('');
  const [editPhotoUrl, setEditPhotoUrl] = useState('');
  const [editCustomFieldsMap, setEditCustomFieldsMap] = useState<Record<string, string>>({});
  const [editTemplateFields, setEditTemplateFields] = useState<any[]>([]);
  
  const [editHasName, setEditHasName] = useState(true);
  const [editHasDesignation, setEditHasDesignation] = useState(true);
  const [editHasPhoto, setEditHasPhoto] = useState(true);
  const [editHasUniqueKey, setEditHasUniqueKey] = useState(true);
  
  const [uploadingEditPhoto, setUploadingEditPhoto] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [uploadingCustomImages, setUploadingCustomImages] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!cardholder) return;
    const ch = cardholder;
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
  }, [cardholder, clientTemplates]);

  const handleSaveEditCardholder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardholder) return;
    setEditError('');
    setEditLoading(true);

    try {
      // Build customFields from the structured map (skip empty values)
      const customJson: Record<string, string> | null =
        Object.keys(editCustomFieldsMap).length > 0
          ? Object.fromEntries(Object.entries(editCustomFieldsMap).filter(([, v]) => v.trim() !== ''))
          : null;

      const res = await fetch(`/api/cardholders/${cardholder.id}`, {
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

      toast('Cardholder updated successfully', 'success');
      onSave(); // this calls fetchData and setEditingCardholder(null) in parent
    } catch (err: any) {
      setEditError(err.message || 'Server error occurred');
    } finally {
      setEditLoading(false);
    }
  };

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

  return (
    <div
      onClick={onClose}
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
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}>
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
              <label className="form-label" style={{ fontWeight: '500' }}>Photo</label>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                {editPhotoUrl && (
                  <img 
                    src={normalizeGoogleDriveUrl(editPhotoUrl) || editPhotoUrl} 
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
                              src={normalizeGoogleDriveUrl(val) || val} 
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
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={editLoading}>
              {editLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
