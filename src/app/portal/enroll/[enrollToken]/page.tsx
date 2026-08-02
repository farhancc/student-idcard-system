'use client';

import React, { useState, useEffect, useRef, use, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ImageCropper from '@/app/components/ImageCropper';
import CardPreview from '@/app/components/CardPreview';
import { formatFieldLabel } from '@/lib/pdf/card-renderer-client';

import { Upload, Check, AlertCircle, Loader, CreditCard, Camera, X } from 'lucide-react';

interface FieldCoordinate {
  field: string;
  type: string;
  prefix?: string;
  suffix?: string;
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

const cleanFieldKey = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

const isDateField = (fieldKey: string, fieldType?: string) => {
  if (fieldType && fieldType.toLowerCase() === 'date') return true;
  const clean = cleanFieldKey(fieldKey);
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

export default function EnrollmentPage({ params }: { params: Promise<{ enrollToken: string }> }) {
  const { enrollToken } = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [client, setClient] = useState<Client | null>(null);
  const [template, setTemplate] = useState<Template | null>(null);
  const [departmentName, setDepartmentName] = useState<string | null>(null);
  const [formFields, setFormFields] = useState<string[]>([]);
  const [fieldTypeMap, setFieldTypeMap] = useState<Record<string, string>>({});
  const [fieldCoordsMap, setFieldCoordsMap] = useState<Record<string, FieldCoordinate>>({});
  const [customImgFields, setCustomImgFields] = useState<FieldCoordinate[]>([]);
  const [pressFonts, setPressFonts] = useState<any[]>([]);

  // Field visibility states
  const [hasName, setHasName] = useState(true);
  const [hasDesignation, setHasDesignation] = useState(false);
  const [hasPhoto, setHasPhoto] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [designation, setDesignation] = useState('');
  const [customFields, setCustomFields] = useState<Record<string, string>>({});
  const [photoUrl, setPhotoUrl] = useState('');

  // Cropper states
  const [rawImage, setRawImage] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [activeCropField, setActiveCropField] = useState<string | null>(null);

  // Webcam states
  const [showWebcam, setShowWebcam] = useState(false);
  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null);
  const [webcamError, setWebcamError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const webcamCanvasRef = useRef<HTMLCanvasElement>(null);

  // Inline validation — tracks which fields user has touched
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Preview side state (kept for future use)
  const [previewSide, setPreviewSide] = useState<'front' | 'back'>('front');
  const [hasBackFields, setHasBackFields] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

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
        setShowPreview(data.share?.showPreview ?? false);
        setPressFonts(data.pressFonts || []);

        // Parse fields
        const front = JSON.parse(data.template.frontFields || '[]');
        const back = JSON.parse(data.template.backFields || '[]');
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

        // Identify fields that are mapped to 'qr', 'barcode', 'id' or static fields to restrict editing on enrollment page
        const restrictedFields = new Set(
          allFields
            .filter(f => f.type === 'qr' || f.type === 'barcode' || f.type === 'id' || (f as any).staticValue !== undefined)
            .map(f => f.field)
        );

        // Unique text, date & number fields (excluding restricted, ID, and serial field types)
        const textAndDateFields = allFields.filter(f => (f.type === 'text' || f.type === 'date' || f.type === 'number' || !f.type) && f.type !== 'id' && (f as any).staticValue === undefined && !restrictedFields.has(f.field));
        const keys = Array.from(new Set(textAndDateFields.map(f => f.field)));
        
        const cleanFieldKey = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

        // Remove standard system photo & serial attributes from form fields (allow date fields like dob, doj, valid till, etc.)
        const filteredKeys = keys.filter(k => {
          const clean = cleanFieldKey(k);
          const f = coordsMap[k];
          return clean !== 'photo' && 
            clean !== 'avatar' &&
            clean !== 'cardserial' &&
            !clean.includes('serial') &&
            f?.type !== 'id' &&
            (f as any)?.staticValue === undefined;
        });
        setFormFields(filteredKeys);

        // Find all non-restricted image fields
        const imageFields = allFields.filter(f => f.type === 'image' && !restrictedFields.has(f.field));
        // Main photo field is named 'photo' or 'avatar', or the first one if neither exists
        const mainPhoto = imageFields.find(f => {
          const clean = cleanFieldKey(f.field);
          return clean === 'photo' || 
            clean === 'avatar' || 
            clean === 'photourl' ||
            clean.includes('photo') || 
            clean.includes('avatar') || 
            clean.includes('profile');
        }) || null;
        // Custom image fields are all other image fields
        const customImages = imageFields.filter(f => f !== mainPhoto);
        setCustomImgFields(customImages);

        // Detect visibility of standard fields (excluding restricted fields)
        const mappedFields = allFields.map(f => cleanFieldKey(f.field));
        setHasName(mappedFields.some(f => ['name', 'fullname', 'studentname', 'employeename', 'membername', 'staffname', 'cardholdername', 'username'].includes(f)) && !restrictedFields.has('name') && !restrictedFields.has('fullName'));
        setHasDesignation(mappedFields.some(f => ['designation', 'role', 'jobtitle', 'post', 'profession'].includes(f)) && !restrictedFields.has('designation') && !restrictedFields.has('role'));
        setHasPhoto(mainPhoto !== null);

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

  const markTouched = (field: string) => setTouched(prev => ({ ...prev, [field]: true }));

  const validateField = useCallback((field: string, value: string): string => {
    if (field === 'name' && !value.trim()) return 'Full name is required.';
    return '';
  }, []);

  const handleBlur = (field: string, value: string) => {
    markTouched(field);
    setFieldErrors(prev => ({ ...prev, [field]: validateField(field, value) }));
  };

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

  // ── Webcam helpers ────────────────────────────────────────────────────────
  const startWebcam = async (fieldKey: string) => {
    setWebcamError('');
    setActiveCropField(fieldKey);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      setWebcamStream(stream);
      setShowWebcam(true);
      // Attach stream after the video element mounts
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 100);
    } catch (err: any) {
      setWebcamError('Camera not accessible: ' + (err.message || 'Permission denied'));
    }
  };

  const stopWebcam = () => {
    webcamStream?.getTracks().forEach(t => t.stop());
    setWebcamStream(null);
    setShowWebcam(false);
  };

  const captureWebcam = () => {
    const video = videoRef.current;
    const canvas = webcamCanvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/png');
    stopWebcam();
    setRawImage(dataUrl);
    setShowCropper(true);
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
      setError(err.message || 'Error uploading photo');
    } finally {
      setUploadingPhoto(false);
      setActiveCropField(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
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
    if (!finalName) {
      setError('Name is required');
      return;
    }
    if (hasPhoto && !photoUrl) {
      setError('Please upload and crop your profile photo');
      return;
    }

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
          setError(`${label} must be a valid number`);
          return;
        }
        if (minCap !== undefined && minCap !== null && numVal < minCap) {
          setError(`${label} must be at least ${minCap}`);
          return;
        }
        if (maxCap !== undefined && maxCap !== null && numVal > maxCap) {
          setError(`${label} cannot be greater than ${maxCap}`);
          return;
        }
      }
    }

    setLoading(true);
    setError('');

    try {
      const updatedCustomFields = { ...customFields };
      if (photoUrl) {
        customImgFields.forEach(f => {
          if (!updatedCustomFields[f.field]) {
            updatedCustomFields[f.field] = photoUrl;
          }
        });
      }

      const payload = {
        name: finalName,
        designation: hasDesignation ? (designation || null) : null,
        photoUrl: hasPhoto ? (photoUrl || null) : null,
        customFields: updatedCustomFields,
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
            <span style={{ display: 'block', marginTop: '16px', padding: '10px 14px', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.15)', fontSize: '0.82rem', color: '#10b981' }}>
              <strong>To edit or correct your details:</strong> please contact your department head.
            </span>
          </p>
          <button type="button" className="btn btn-secondary" style={{ width: '100%' }} onClick={() => {
            setName('');
            setDesignation('');
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
    const allImageFields = all.filter((f: FieldCoordinate) => f.type === 'image');
    return allImageFields.find((f: FieldCoordinate) => f.field === 'photo' || f.field === 'avatar') || allImageFields[0] || null;
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
      const allImageFields = all.filter((f: FieldCoordinate) => f.type === 'image');
      return allImageFields.find((f: FieldCoordinate) => f.field === 'photo' || f.field === 'avatar') || allImageFields[0] || null;
    }
    return all.find((f: FieldCoordinate) => f.field === activeCropField) || null;
  })() : null;

  const targetAspectRatio = activeFieldCoord && activeFieldCoord.width && activeFieldCoord.height
    ? activeFieldCoord.width / activeFieldCoord.height
    : 0.75; // Default 3:4 portrait

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)', color: 'var(--foreground)', padding: '40px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ maxWidth: showPreview ? '1100px' : '550px', width: '100%', transition: 'max-width 0.3s ease' }}>
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
          <div style={{ 
            marginTop: '12px', 
            padding: '8px 16px', 
            background: 'linear-gradient(90deg, rgba(79, 70, 229, 0.1) 0%, rgba(124, 58, 237, 0.1) 100%)', 
            border: '1px solid rgba(99, 102, 241, 0.2)', 
            borderRadius: '20px', 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '8px',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)'
          }}>
            <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--primary)' }}></span>
            <span style={{ fontSize: '0.78rem', color: '#a5b4fc', fontWeight: 500 }}>
              To edit or modify your details, please contact your department head.
            </span>
          </div>
        </div>



        {error && (
          <div className="alert alert-danger" style={{ marginBottom: '24px', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <AlertCircle size={16} />
            <span style={{ fontSize: '0.85rem' }}>{error}</span>
          </div>
        )}

        <div className={showPreview ? "portal-layout" : ""}>
          <div className={showPreview ? "portal-form-col" : ""}>
            <form onSubmit={handleSubmit} className="card" style={{ padding: '32px', background: 'var(--card-bg)', border: '1px solid var(--glass-border)', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <input type="file" id="photo-input" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
              {/* Hidden canvas for webcam capture */}
              <canvas ref={webcamCanvasRef} style={{ display: 'none' }} />

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
                    This enrollment template does not have any input fields configured.
                  </div>
                </div>
              )}
          
          {/* Photo upload + Cropper trigger */}
          {hasPhoto && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{
                width: `${mainBoxWidth}px`,
                height: `${mainBoxHeight}px`,
                background: '#111',
                borderRadius: `${mainBoxBorderRadius}px`,
                border: `2px dashed ${photoUrl ? 'var(--primary)' : 'var(--glass-border)'}`,
                position: 'relative',
                overflow: 'hidden',
                cursor: 'pointer',
                marginBottom: '12px',
                transition: 'border-color 0.2s',
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
              {/* Upload + Camera buttons */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <button type="button" className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '6px 12px', gap: '5px' }} onClick={() => triggerUpload('photo')}>
                  <Upload size={13} /> Upload
                </button>
                <button type="button" className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '6px 12px', gap: '5px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8' }} onClick={() => startWebcam('photo')}>
                  <Camera size={13} /> Use Camera
                </button>
              </div>
              {webcamError && <p style={{ color: 'var(--danger)', fontSize: '0.72rem', margin: '0 0 4px' }}>{webcamError}</p>}
              <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Crop tool will match target dimensions and shape.</span>
            </div>
          )}

          {/* Custom image fields */}
          {customImgFields.map(field => {
            const label = formatFieldLabel(field.field);
            const value = customFields[field.field] || '';
            const fieldWidth = field.width || 120;
            const fieldHeight = field.height || 160;
            
            // Scaled dimensions for the preview box (maintaining aspect ratio, max-width 120px)
            const boxWidth = 120;
            const boxHeight = (fieldHeight / fieldWidth) * boxWidth;
            const boxBorderRadius = field.borderRadius ? (field.borderRadius / fieldWidth) * boxWidth : 8;

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

          {/* Fields dynamically extracted from template */}
          {formFields.map(field => {
            const label = formatFieldLabel(field);
            const clean = cleanFieldKey(field);
            const isNameLike = ['name', 'fullname', 'studentname', 'employeename', 'membername', 'staffname', 'cardholdername', 'username'].includes(clean);
            const isDesignationLike = ['designation', 'role', 'jobtitle', 'post', 'profession'].includes(clean);
            const isDate = isDateField(field, fieldTypeMap[field]);
            const isNumber = fieldTypeMap[field] === 'number';
            const coord = fieldCoordsMap[field];
            const maxCap = (coord as any)?.max;
            const minCap = (coord as any)?.min;

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

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '12px' }} disabled={loading || uploadingPhoto}>
            {loading ? 'Submitting...' : 'Submit Details'}
          </button>
            </form>
          </div>

          {/* Real-time Preview */}
          {showPreview && template && (
            <div className="portal-preview-col">
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '16px',
                width: '100%',
              }}>
                <p style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', fontWeight: 600, margin: 0 }}>
                  Live ID Card Preview
                </p>
                <div style={{
                  display: 'flex',
                  gap: '24px',
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                  width: '100%',
                }}>
                  {/* Front Side Preview */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <CardPreview
                      template={template}
                      cardholder={{
                        name: name || 'Full Name',
                        designation: designation || 'Designation',
                        photoUrl: photoUrl || null,
                        uniqueKey: customFields.uniqueKey || customFields.id || customFields.unique_key || null,
                        cardSerial: 'STU-0000',
                        customFields: JSON.stringify(customFields),
                      }}
                      side="front"
                      pressFonts={pressFonts}
                      forceWeb={true}
                      style={{
                        width: '240px',
                        boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
                        borderRadius: '12px',
                      }}
                    />
                    <span style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 500 }}>Front View</span>
                  </div>

                  {/* Back Side Preview */}
                  {template.backImageUrl && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <CardPreview
                        template={template}
                        cardholder={{
                          name: name || 'Full Name',
                          designation: designation || 'Designation',
                          photoUrl: photoUrl || null,
                          uniqueKey: customFields.uniqueKey || customFields.id || customFields.unique_key || null,
                          cardSerial: 'STU-0000',
                          customFields: JSON.stringify(customFields),
                        }}
                        side="back"
                        pressFonts={pressFonts}
                        forceWeb={true}
                        style={{
                          width: '240px',
                          boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
                          borderRadius: '12px',
                        }}
                      />
                      <span style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 500 }}>Back View</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
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

      {/* Webcam Capture Modal */}
      {showWebcam && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '24px'
        }}>
          <div style={{ background: 'var(--card-bg)', borderRadius: '16px', overflow: 'hidden', maxWidth: '480px', width: '100%', border: '1px solid var(--glass-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--glass-border)' }}>
              <span style={{ fontWeight: '600', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Camera size={16} color="var(--primary)" /> Take Photo
              </span>
              <button type="button" onClick={stopWebcam} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '4px' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ position: 'relative', background: '#000' }}>
              <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', display: 'block', maxHeight: '360px', objectFit: 'cover' }} />
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={stopWebcam}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" style={{ flex: 1, gap: '6px' }} onClick={captureWebcam}>
                <Camera size={14} /> Capture
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
