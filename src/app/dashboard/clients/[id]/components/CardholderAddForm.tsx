'use client';

import React, { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/toast';
import { Upload } from 'lucide-react';

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

  const [addTemplateId, setAddTemplateId] = useState<string>(() => {
    return clientTemplates && clientTemplates.length > 0 ? String(clientTemplates[0].id) : '';
  });

  const [dynamicFields, setDynamicFields] = useState<Record<string, string>>({});
  const [templateFieldDefs, setTemplateFieldDefs] = useState<Array<{ field: string; type: string; isRequired: boolean }>>([]);
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [addError, setAddError] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [uploadingPhotoKey, setUploadingPhotoKey] = useState<string | null>(null);

  // Helper to format field key into human readable label
  const formatFieldLabel = (field: string) => {
    return field
      .replace(/([A-Z])/g, ' $1')
      .replace(/[_-]/g, ' ')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  };

  const cleanFieldKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

  // Fetch template field definitions when template selection changes
  useEffect(() => {
    if (!addTemplateId) {
      setTemplateFieldDefs([]);
      setDynamicFields({});
      return;
    }

    const fetchTemplateFields = async () => {
      setFieldsLoading(true);
      try {
        const res = await fetch(`/api/templates/${addTemplateId}/fields`);
        if (res.ok) {
          const json = await res.json();
          const fields: Array<{ field: string; type: string; isRequired: boolean }> = json.fields || [];
          
          // Filter out QR/Barcode fields as they are auto-generated
          const allowedFields = fields.filter(f => f.type !== 'qr' && f.type !== 'barcode');
          setTemplateFieldDefs(allowedFields);

          // Initialize dynamic fields object
          const initial: Record<string, string> = {};
          allowedFields.forEach(f => {
            initial[f.field] = '';
          });
          setDynamicFields(initial);
        }
      } catch (err) {
        console.error('Failed to fetch template fields:', err);
      } finally {
        setFieldsLoading(false);
      }
    };

    fetchTemplateFields();
  }, [addTemplateId]);

  const handlePhotoUpload = async (fieldKey: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhotoKey(fieldKey);

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

      setDynamicFields(prev => ({
        ...prev,
        [fieldKey]: data.url,
      }));
    } catch (err: any) {
      toast(err.message || 'Failed to upload photo', 'error');
    } finally {
      setUploadingPhotoKey(null);
    }
  };

  const handleAddCardholder = async (e?: React.FormEvent, force: boolean = false) => {
    if (e) e.preventDefault();
    setAddError('');
    setAddLoading(true);

    try {
      let resolvedName = '';
      let resolvedDesignation = '';
      let resolvedPhotoUrl = '';
      let resolvedUniqueKey = '';

      const customObj: Record<string, any> = { ...dynamicFields };

      // Resolve standard database columns from template field definitions
      for (const f of templateFieldDefs) {
        const key = f.field;
        const val = dynamicFields[key] || '';
        const clean = cleanFieldKey(key);

        if (!resolvedName && (clean === 'name' || clean === 'fullname' || clean === 'studentname' || clean === 'employeename' || clean === 'membername')) {
          resolvedName = val;
        }
        if (!resolvedDesignation && (clean === 'designation' || clean === 'role' || clean === 'jobtitle' || clean === 'post' || clean === 'profession')) {
          resolvedDesignation = val;
        }
        if (!resolvedPhotoUrl && (clean === 'photo' || clean === 'photourl' || clean === 'image' || clean === 'avatar' || f.type === 'image')) {
          resolvedPhotoUrl = val;
        }
        if (!resolvedUniqueKey && (clean === 'id' || clean === 'rollnumber' || clean === 'rollno' || clean === 'empid' || clean === 'studentid' || clean === 'uniquekey' || clean === 'admno')) {
          resolvedUniqueKey = val;
        }
      }

      // Fallback name if no explicit name field was matched
      if (!resolvedName.trim()) {
        const firstTextVal = Object.values(dynamicFields).find(v => v.trim() !== '');
        resolvedName = firstTextVal || 'Cardholder';
      }

      const res = await fetch(`/api/clients/${clientId}/cardholders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: resolvedName,
          designation: resolvedDesignation,
          photoUrl: resolvedPhotoUrl,
          uniqueKey: resolvedUniqueKey,
          customFields: customObj,
          ignoreDuplicate: force,
          ...(addTemplateId ? { templateId: Number(addTemplateId) } : {}),
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        if (json.duplicate && !force) {
          const confirmAdd = window.confirm(
            `${json.message || 'A cardholder with this details already exists.'}\n\nDo you want to add them anyway?`
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

      setDynamicFields({});
      onSuccess();
    } catch (err: any) {
      setAddError(err.message || 'Failed to add cardholder');
    } finally {
      setAddLoading(false);
    }
  };

  return (
    <div className="glass-panel" style={{ maxWidth: '720px' }}>
      <h3 style={{ marginBottom: '6px' }}>Add Cardholder</h3>
      <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '20px' }}>
        Select a template to load the matching fields.
      </p>

      {addError && (
        <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f77', borderRadius: '6px', marginBottom: '20px', fontSize: '0.85rem' }}>
          {addError}
        </div>
      )}

      <form onSubmit={handleAddCardholder} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Template Selector */}
        <div className="form-group">
          <label className="form-label" style={{ fontWeight: '600', color: 'var(--primary)' }}>
            Card Template
          </label>
          <select
            className="form-select"
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

        {fieldsLoading && (
          <div style={{ textAlign: 'center', padding: '20px', color: 'var(--muted)', fontSize: '0.85rem' }}>
            Loading template fields...
          </div>
        )}

        {!addTemplateId && (
          <div style={{ padding: '24px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--glass-border)', textAlign: 'center', color: 'var(--muted)', fontSize: '0.85rem' }}>
            Please select a template to load its configured entry fields.
          </div>
        )}

        {/* Dynamic Template Fields ONLY */}
        {addTemplateId && !fieldsLoading && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {templateFieldDefs.length === 0 ? (
              <div style={{ gridColumn: 'span 2', padding: '20px', textAlign: 'center', color: 'var(--muted)', fontSize: '0.85rem' }}>
                No fields configured on this template.
              </div>
            ) : (
              templateFieldDefs.map(f => {
                const label = formatFieldLabel(f.field);
                const isImage = f.type === 'image' || cleanFieldKey(f.field) === 'photo' || cleanFieldKey(f.field) === 'photourl' || cleanFieldKey(f.field) === 'avatar';
                const isDate = f.type === 'date';
                const isNumber = f.type === 'number';

                if (isImage) {
                  return (
                    <div key={f.field} className="form-group" style={{ gridColumn: 'span 2' }}>
                      <label className="form-label">
                        {label} {f.isRequired && <span style={{ color: '#f87171' }}>*</span>}
                      </label>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <label className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem', gap: '6px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          <Upload size={14} /> {uploadingPhotoKey === f.field ? 'Uploading...' : 'Upload Photo'}
                          <input
                            type="file"
                            accept="image/*"
                            onChange={e => handlePhotoUpload(f.field, e)}
                            disabled={uploadingPhotoKey === f.field}
                            style={{ display: 'none' }}
                          />
                        </label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Or paste photo image URL: https://..."
                          value={dynamicFields[f.field] || ''}
                          onChange={e => setDynamicFields(prev => ({ ...prev, [f.field]: e.target.value }))}
                          style={{ flex: 1 }}
                        />
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={f.field} className="form-group">
                    <label className="form-label">
                      {label} {f.isRequired && <span style={{ color: '#f87171' }}>*</span>}
                    </label>
                    <input
                      type={isNumber ? 'number' : isDate ? 'date' : 'text'}
                      required={f.isRequired}
                      className="form-input"
                      placeholder={`Enter ${label.toLowerCase()}`}
                      value={dynamicFields[f.field] || ''}
                      onChange={e => setDynamicFields(prev => ({ ...prev, [f.field]: e.target.value }))}
                    />
                  </div>
                );
              })
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
          <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={addLoading || !!uploadingPhotoKey || !addTemplateId}>
            {addLoading ? 'Saving...' : 'Add Cardholder'}
          </button>
        </div>
      </form>
    </div>
  );
}
