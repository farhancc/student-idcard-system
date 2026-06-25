'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import ImageCropper from '@/app/components/ImageCropper';
import CardPreview from '@/app/components/CardPreview';
import { Upload, Check, AlertCircle, Loader, CreditCard } from 'lucide-react';

interface FieldCoordinate {
  field: string;
  type: string;
  prefix?: string;
  suffix?: string;
}

export default function EnrollmentPage({ params }: { params: Promise<{ enrollToken: string }> }) {
  const { enrollToken } = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [client, setClient] = useState<any>(null);
  const [template, setTemplate] = useState<any>(null);
  const [departmentName, setDepartmentName] = useState<string | null>(null);
  const [formFields, setFormFields] = useState<string[]>([]);
  const [customImgFields, setCustomImgFields] = useState<any[]>([]);

  // Field visibility states
  const [hasName, setHasName] = useState(true);
  const [hasDesignation, setHasDesignation] = useState(false);
  const [hasPhoto, setHasPhoto] = useState(false);
  const [hasUniqueKey, setHasUniqueKey] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [designation, setDesignation] = useState('');
  const [uniqueKey, setUniqueKey] = useState('');
  const [customFields, setCustomFields] = useState<Record<string, string>>({});
  const [photoUrl, setPhotoUrl] = useState('');

  // Cropper states
  const [rawImage, setRawImage] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [activeCropField, setActiveCropField] = useState<string | null>(null);

  // Live preview states
  const [previewSide, setPreviewSide] = useState<'front' | 'back'>('front');
  const [hasBackFields, setHasBackFields] = useState(false);

  useEffect(() => {
    const fetchPortalInfo = async () => {
      try {
        const res = await fetch(`/api/portal/shares/${enrollToken}`);
        if (!res.ok) {
          throw new Error('Link is invalid or has expired');
        }
        const data = await res.json();
        setClient(data.client);
        setTemplate(data.template);
        setDepartmentName(data.departmentName || null);

        // Parse fields
        const front = JSON.parse(data.template.frontFields || '[]');
        const back = JSON.parse(data.template.backFields || '[]');
        const allFields: FieldCoordinate[] = [...front, ...back];

        // Identify fields that are mapped to 'qr', 'barcode', or 'id' types to restrict editing on enrollment page
        const restrictedFields = new Set(
          allFields
            .filter(f => f.type === 'qr' || f.type === 'barcode' || f.type === 'id')
            .map(f => f.field)
        );

        // Unique text fields (excluding restricted fields)
        const textFields = allFields.filter(f => f.type === 'text' && !restrictedFields.has(f.field));
        const keys = Array.from(new Set(textFields.map(f => f.field)));
        
        // Remove standard and system ones from customFields list to handle separately
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

        // Find all non-restricted image fields
        const imageFields = allFields.filter(f => f.type === 'image' && !restrictedFields.has(f.field));
        // Main photo field is named 'photo' or 'avatar', or the first one if neither exists
        const mainPhoto = imageFields.find(f => f.field === 'photo' || f.field === 'avatar') || imageFields[0] || null;
        // Custom image fields are all other image fields
        const customImages = imageFields.filter(f => f !== mainPhoto);
        setCustomImgFields(customImages);

        // Detect visibility of standard fields (excluding restricted fields)
        const mappedFields = allFields.map(f => f.field);
        setHasName((mappedFields.includes('name') || mappedFields.includes('fullName')) && !restrictedFields.has('name') && !restrictedFields.has('fullName'));
        setHasDesignation((mappedFields.includes('designation') || mappedFields.includes('role')) && !restrictedFields.has('designation') && !restrictedFields.has('role'));
        setHasPhoto(mainPhoto !== null);
        setHasUniqueKey(mappedFields.includes('uniqueKey') && !restrictedFields.has('uniqueKey'));

        // Detect if back side has any fields
        const backParsed: FieldCoordinate[] = JSON.parse(data.template.backFields || '[]');
        setHasBackFields(backParsed.length > 0);

        // Initialize custom fields empty
        const initialCustom: Record<string, string> = {};
        filteredKeys.forEach(k => {
          initialCustom[k] = '';
        });
        customImages.forEach(imgField => {
          initialCustom[imgField.field] = '';
        });
        setCustomFields(initialCustom);
      } catch (err: any) {
        setError(err.message || 'Failed to load enrollment page');
      } finally {
        setLoading(false);
      }
    };

    fetchPortalInfo();
  }, [enrollToken]);

  const triggerUpload = (fieldKey: string) => {
    setActiveCropField(fieldKey);
    document.getElementById('photo-input')?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setRawImage(reader.result as string);
      setShowCropper(true);
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Reset input
  };

  const handleCropComplete = async (croppedBase64: string) => {
    setShowCropper(false);
    setUploadingPhoto(true);

    try {
      // Convert base64 to file blob
      const resBlob = await fetch(croppedBase64);
      const blob = await resBlob.blob();
      const file = new File([blob], `cropped_${activeCropField || 'avatar'}.png`, { type: 'image/png' });

      // Upload using portal upload API
      const formData = new FormData();
      formData.append('file', file);
      formData.append('token', enrollToken);
      formData.append('type', 'photo');

      const uploadRes = await fetch('/api/portal/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        const errorData = await uploadRes.json();
        throw new Error(errorData.error || 'Failed to upload image');
      }

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = hasName ? name : 'Cardholder';
    if (!finalName) {
      setError('Name is required');
      return;
    }
    if (hasPhoto && !photoUrl) {
      setError('Please upload and crop your profile photo');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload = {
        name: finalName,
        designation: hasDesignation ? (designation || null) : null,
        photoUrl: hasPhoto ? (photoUrl || null) : null,
        customFields,
        uniqueKey: hasUniqueKey ? (uniqueKey || null) : null,
      };

      const res = await fetch(`/api/portal/enroll/${enrollToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Submission failed');
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'An error occurred during submission');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !success) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--page-bg)', color: 'var(--foreground)' }}>
        <div style={{ textAlign: 'center' }}>
          <Loader className="animate-spin" size={48} style={{ margin: '0 auto 16px', color: 'var(--primary)' }} />
          <p style={{ color: 'var(--muted)' }}>Loading enrollment form...</p>
        </div>
      </div>
    );
  }

  if (error && !client) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--page-bg)', padding: '24px' }}>
        <div className="card" style={{ maxWidth: '400px', width: '100%', padding: '24px', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          <AlertCircle size={48} style={{ color: 'var(--danger)', margin: '0 auto 16px' }} />
          <h3 style={{ marginBottom: '8px' }}>Enrollment Link Invalid</h3>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '24px' }}>{error}</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--page-bg)', padding: '24px', color: 'var(--foreground)' }}>
        <div className="card" style={{ maxWidth: '450px', width: '100%', padding: '32px', textAlign: 'center', border: '1px solid var(--glass-border)', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)', background: 'var(--card-bg)' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <Check size={32} style={{ color: '#10b981' }} />
          </div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '12px' }}>Enrollment Successful!</h2>
          <p style={{ color: 'var(--muted)', fontSize: '0.95rem', lineHeight: '1.5', marginBottom: '24px' }}>
            Your details have been submitted successfully. The organization will review and compile your identity card shortly.
          </p>
          <button type="button" className="btn btn-secondary" style={{ width: '100%' }} onClick={() => {
            setName('');
            setDesignation('');
            setUniqueKey('');
            setPhotoUrl('');
            setSuccess(false);
          }}>
            Submit Another Response
          </button>
        </div>
      </div>
    );
  }



  // Find main image field coordinate for rendering dimensions in upload box
  const mainImgField = template ? (() => {
    const front = JSON.parse(template.frontFields || '[]');
    const back = JSON.parse(template.backFields || '[]');
    const all = [...front, ...back];
    const allImageFields = all.filter((f: any) => f.type === 'image');
    return allImageFields.find((f: any) => f.field === 'photo' || f.field === 'avatar') || allImageFields[0] || null;
  })() : null;

  const mainBoxWidth = 120;
  const mainBoxHeight = mainImgField && mainImgField.width && mainImgField.height
    ? (mainImgField.height / mainImgField.width) * mainBoxWidth
    : 160; // default 3:4

  const mainBoxBorderRadius = mainImgField && mainImgField.width && mainImgField.borderRadius
    ? (mainImgField.borderRadius / mainImgField.width) * mainBoxWidth
    : 8;

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
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)', color: 'var(--foreground)', padding: '40px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ maxWidth: '550px', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--primary)', fontWeight: 'bold' }}>
            {client?.type} ID Registration Portal
          </span>
          <h1 style={{ fontSize: '1.8rem', marginTop: '8px', marginBottom: '4px' }}>{client?.name}</h1>
          {departmentName && (
            <p style={{ color: 'var(--primary)', fontWeight: 'bold', fontSize: '1rem', marginTop: '4px', marginBottom: '4px' }}>
              Department: {departmentName}
            </p>
          )}
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>Fill in details to generate your ID Card</p>
        </div>

        {error && (
          <div className="alert alert-danger" style={{ marginBottom: '24px', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <AlertCircle size={16} />
            <span style={{ fontSize: '0.85rem' }}>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="card" style={{ padding: '32px', background: 'var(--card-bg)', border: '1px solid var(--glass-border)', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Photo upload + Cropper trigger */}
          {hasPhoto && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{
                width: `${mainBoxWidth}px`,
                height: `${mainBoxHeight}px`,
                background: '#111',
                borderRadius: `${mainBoxBorderRadius}px`,
                border: '2px dashed var(--glass-border)',
                position: 'relative',
                overflow: 'hidden',
                cursor: 'pointer',
                marginBottom: '12px',
              }} onClick={() => triggerUpload('photo')}>
                {photoUrl ? (
                  <img src={photoUrl} alt="Cropped profile" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                ) : uploadingPhoto && activeCropField === 'photo' ? (
                  <div style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                    <Loader className="animate-spin" size={24} style={{ color: 'var(--primary)' }} />
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                    <Upload size={24} style={{ color: 'var(--muted)', marginBottom: '8px' }} />
                    <span style={{ fontSize: '0.75rem', color: 'var(--muted)', textAlign: 'center', padding: '0 8px' }}>Upload Photo</span>
                  </div>
                )}
              </div>
              <input type="file" id="photo-input" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
              <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Crop tool will match target dimensions and shape.</span>
            </div>
          )}

          {/* Custom image fields */}
          {customImgFields.map(field => {
            const label = field.field.replace(/([A-Z])/g, ' $1').replace(/^./, (str: string) => str.toUpperCase());
            const value = customFields[field.field] || '';
            const fieldWidth = field.width || 120;
            const fieldHeight = field.height || 160;
            
            // Scaled dimensions for the preview box (maintaining aspect ratio, max-width 120px)
            const boxWidth = 120;
            const boxHeight = (fieldHeight / fieldWidth) * boxWidth;
            const boxBorderRadius = field.borderRadius ? (field.borderRadius / field.width) * boxWidth : 8;

            return (
              <div key={field.field} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '12px' }}>
                <label className="form-label" style={{ marginBottom: '8px' }}>{label}</label>
                <div style={{
                  width: `${boxWidth}px`,
                  height: `${boxHeight}px`,
                  background: '#111',
                  borderRadius: `${boxBorderRadius}px`,
                  border: '2px dashed var(--glass-border)',
                  position: 'relative',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  marginBottom: '8px',
                }} onClick={() => triggerUpload(field.field)}>
                  {value ? (
                    <img src={value} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  ) : uploadingPhoto && activeCropField === field.field ? (
                    <div style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                      <Loader className="animate-spin" size={24} style={{ color: 'var(--primary)' }} />
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                      <Upload size={20} style={{ color: 'var(--muted)', marginBottom: '4px' }} />
                      <span style={{ fontSize: '0.7rem', color: 'var(--muted)', textAlign: 'center', padding: '0 4px' }}>Upload</span>
                    </div>
                  )}
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>Crop tool will match target dimensions and shape</span>
              </div>
            );
          })}

          {/* Standard Fields */}
          {hasName && (
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input type="text" className="form-input" required value={name} onChange={e => setName(e.target.value)} placeholder="Enter full name" />
            </div>
          )}

          {hasDesignation && (
            <div className="form-group">
              <label className="form-label">Designation / Role</label>
              <input type="text" className="form-input" value={designation} onChange={e => setDesignation(e.target.value)} placeholder="Student, Employee, Staff, etc." />
            </div>
          )}

          {hasUniqueKey && (
            <div className="form-group">
              <label className="form-label">Roll Number / Employee ID (Unique Key)</label>
              <input type="text" className="form-input" value={uniqueKey} onChange={e => setUniqueKey(e.target.value)} placeholder="Enter unique ID or roll number" />
            </div>
          )}

          {/* Custom Fields dynamically extracted from template */}
          {formFields.map(field => {
            // Capitalize field name for label
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

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '12px' }} disabled={loading || uploadingPhoto}>
            {loading ? 'Submitting...' : 'Submit Details'}
          </button>
        </form>

        {/* Live ID Card Preview */}
        {template && (
          <div style={{ marginTop: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CreditCard size={18} style={{ color: 'var(--primary)' }} />
                <h3 style={{ fontSize: '1rem', fontWeight: '600' }}>Live ID Card Preview</h3>
              </div>
              {hasBackFields && (
                <div style={{ display: 'flex', gap: '4px', background: 'var(--card-bg)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '3px' }}>
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
              )}
            </div>

            <div style={{
              borderRadius: '12px',
              overflow: 'hidden',
              border: '1px solid var(--glass-border)',
              background: 'var(--card-bg)',
              padding: '16px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: '220px',
              position: 'relative',
            }}>
              <CardPreview
                template={template}
                cardholder={{
                  id: 0,
                  name: name || 'Your Name',
                  designation: designation || '',
                  photoUrl: photoUrl || '',
                  customFields: JSON.stringify(customFields),
                  uniqueKey: uniqueKey || '',
                  createdAt: new Date().toISOString(),
                }}
                side={previewSide}
                style={{
                  maxWidth: '100%',
                  maxHeight: '360px',
                  borderRadius: '8px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                }}
                key={`${name}-${designation}-${photoUrl}-${JSON.stringify(customFields)}-${uniqueKey}-${previewSide}`}
              />
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--muted)', textAlign: 'center', marginTop: '8px' }}>
              Preview updates automatically as you type
            </p>
          </div>
        )}
      </div>

      {/* Image Cropper Modal */}
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
    </div>
  );
}
