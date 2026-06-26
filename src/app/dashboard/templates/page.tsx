'use client';

import React, { useEffect, useState } from 'react';
import { Plus, LayoutGrid, Sliders, Save, Image as ImageIcon, Eye } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import ConfirmDialog from '@/app/components/ConfirmDialog';
import CardPreview from '@/app/components/CardPreview';

const getOptimizedImageUrl = (url: string) => {
  if (!url) return '';
  if (url.endsWith('.pdf')) {
    return url.replace('.pdf', '.png');
  }
  if (url.toLowerCase().endsWith('.svg')) {
    if (url.includes('/image/upload/')) {
      // Cloudinary URL: replace format and request w_2000 transformation for high clarity
      return url.replace('/image/upload/', '/image/upload/w_2000/').replace('.svg', '.png');
    }
    return url.replace('.svg', '.png');
  }
  return url;
};

interface FieldCoordinate {
  field: string;
  type: 'text' | 'image' | 'qr' | 'barcode' | 'id';
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number;
  fontWeight?: string;
  fontStyle?: 'normal' | 'italic';
  fontFamily?: string;
  color?: string;
  align?: 'left' | 'center' | 'right';
  borderRadius?: number;
  prefix?: string;
  suffix?: string;
  letterSpacing?: number;
  lineHeight?: number;
  textDecoration?: 'none' | 'underline' | 'line-through';
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  opacity?: number;
}

export default function TemplatesPage() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isElectron, setIsElectron] = useState(true);
  const [pressId, setPressId] = useState<number | null>(null);

  useEffect(() => {
    setIsElectron(typeof window !== 'undefined' && !!(window as any).electronAPI);
  }, []);

  useEffect(() => {
    fetch('/api/press/profile')
      .then(r => r.json())
      .then(d => { if (d.press?.id) setPressId(d.press.id); })
      .catch(() => {});
  }, []);
  // Form toggling
  const [showForm, setShowForm] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [cardWidth, setCardWidth] = useState(1011);
  const [cardHeight, setCardHeight] = useState(638);
  const [frontImageUrl, setFrontImageUrl] = useState('');
  const [backImageUrl, setBackImageUrl] = useState('');
  const [frontLocalPath, setFrontLocalPath] = useState('');
  const [backLocalPath, setBackLocalPath] = useState('');
  const [frontWebUrl, setFrontWebUrl] = useState('');
  const [backWebUrl, setBackWebUrl] = useState('');
  const [frontFields, setFrontFields] = useState<FieldCoordinate[]>([]);
  const [backFields, setBackFields] = useState<FieldCoordinate[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [uploadingFront, setUploadingFront] = useState(false);
  const [uploadingBack, setUploadingBack] = useState(false);

  // Preview State
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [previewSide, setPreviewSide] = useState<'front' | 'back'>('front');
  const [showTestData, setShowTestData] = useState(false);
  const [testData, setTestData] = useState<Record<string, string>>({});

  // Visual mapping state variables
  const [selectedFieldIndex, setSelectedFieldIndex] = useState<number | null>(null);
  const [selectedSide, setSelectedSide] = useState<'front' | 'back'>('front');
  const [dragState, setDragState] = useState<{
    index: number;
    side: 'front' | 'back';
    type: 'move' | 'resize';
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
  } | null>(null);

  // Confirm dialog state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string; message: string; confirmLabel: string; variant: 'danger' | 'warning'; onConfirm: () => void;
  } | null>(null);
  const showConfirm = (cfg: typeof confirmConfig) => { setConfirmConfig(cfg); setConfirmOpen(true); };
  const closeConfirm = () => { setConfirmOpen(false); setConfirmConfig(null); };

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/templates');
      if (res.ok) {
        const json = await res.json();
        setTemplates(json.templates || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleAddField = (side: 'front' | 'back') => {
    const defaultField = 'rollNo';
    const newField: FieldCoordinate = {
      field: defaultField,
      type: 'text',
      x: 100,
      y: 100,
      width: 200,
      height: 30,
      fontSize: 18,
      fontWeight: 'normal',
      color: '#000000',
      align: 'left',
      prefix: 'Roll No : ',
    };

    if (side === 'front') {
      setFrontFields([...frontFields, newField]);
    } else {
      setBackFields([...backFields, newField]);
    }
  };

  const handleRemoveField = (side: 'front' | 'back', index: number) => {
    if (side === 'front') {
      setFrontFields(frontFields.filter((_, i) => i !== index));
    } else {
      setBackFields(backFields.filter((_, i) => i !== index));
    }
  };

  const handleFieldChange = (side: 'front' | 'back', index: number, key: keyof FieldCoordinate, val: any) => {
    const fields = side === 'front' ? [...frontFields] : [...backFields];
    const oldField = fields[index];
    
    let updatedField = { ...oldField, [key]: val };
    
    // Auto-update prefix if field name changes and prefix was default or empty
    if (key === 'field') {
      const formatLabel = (name: string) => {
        return name
          .replace(/([A-Z])/g, ' $1')
          .replace(/_/g, ' ')
          .trim()
          .replace(/^./, str => str.toUpperCase());
      };
      const oldDefaultPrefix1 = `${oldField.field}: `;
      const oldDefaultPrefix2 = `${oldField.field} : `;
      const oldFormattedPrefix1 = `${formatLabel(oldField.field)}: `;
      const oldFormattedPrefix2 = `${formatLabel(oldField.field)} : `;
      
      if (
        !oldField.prefix || 
        oldField.prefix === oldDefaultPrefix1 || 
        oldField.prefix === oldDefaultPrefix2 || 
        oldField.prefix === oldFormattedPrefix1 ||
        oldField.prefix === oldFormattedPrefix2 ||
        oldField.prefix === 'Roll No: ' ||
        oldField.prefix === 'Roll No : ' ||
        oldField.prefix === `${oldField.field}:` ||
        oldField.prefix === `${oldField.field} :`
      ) {
        updatedField.prefix = `${formatLabel(val)} : `;
      }
    }
    
    fields[index] = updatedField;

    if (side === 'front') {
      setFrontFields(fields);
    } else {
      setBackFields(fields);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, side: 'front' | 'back') => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Automatically detect image dimensions for setting card width and height
    const isVector = file.type === 'application/pdf' || 
                     file.name.toLowerCase().endsWith('.pdf') || 
                     file.type === 'image/svg+xml' || 
                     file.name.toLowerCase().endsWith('.svg');

    if (isVector) {
      if (side === 'front') { setCardWidth(1011); setCardHeight(638); }
    } else {
      const img = new Image();
      img.onload = () => { if (side === 'front') { setCardWidth(img.width); setCardHeight(img.height); } };
      img.src = URL.createObjectURL(file);
    }

    if (side === 'front') setUploadingFront(true);
    else setUploadingBack(true);

    try {
      const electronAPI = (window as any).electronAPI;
      if (electronAPI?.saveTemplateImage) {
        // ── Electron path: save to local disk ──────────────────────
        const arrayBuffer = await file.arrayBuffer();
        const base64Data = Buffer.from(arrayBuffer).toString('base64');
        const result = await electronAPI.saveTemplateImage({
          pressId: pressId ?? 0,
          fileName: file.name,
          base64Data,
          mimeType: file.type,
        });
        if (!result.success) throw new Error(result.error || 'Failed to save image locally');
        
        // Show high-res local preview instantly in editor
        if (side === 'front') {
          setFrontImageUrl(result.url);
          setFrontLocalPath(result.localPath);
          setFrontWebUrl(''); // Reset during upload
        } else {
          setBackImageUrl(result.url);
          setBackLocalPath(result.localPath);
          setBackWebUrl(''); // Reset during upload
        }

        // Helper to generate a cheap low-res preview as a compressed base64 data URI
        const createCheapCopyBase64 = async (previewUrl: string): Promise<string> => {
          return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
              try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) throw new Error('Could not get canvas context');

                // Max dimensions for the cheap copy
                const maxDim = 1000;
                let width = img.width;
                let height = img.height;
                if (width > maxDim || height > maxDim) {
                  if (width > height) {
                    height = Math.round((height * maxDim) / width);
                    width = maxDim;
                  } else {
                    width = Math.round((width * maxDim) / height);
                    height = maxDim;
                  }
                }

                canvas.width = width;
                canvas.height = height;
                // Draw background white
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);

                // Compress to 60% quality jpeg
                const cheapDataUrl = canvas.toDataURL('image/jpeg', 0.6);
                resolve(cheapDataUrl);
              } catch (err) {
                reject(err);
              }
            };
            img.onerror = () => {
              reject(new Error('Failed to load local template image for preview generation'));
            };
            img.src = previewUrl;
          });
        };

        // Trigger base64 preview generation in background
        createCheapCopyBase64(result.url)
          .then(webUrl => {
            if (side === 'front') {
              setFrontWebUrl(webUrl);
            } else {
              setBackWebUrl(webUrl);
            }
            toast(`Web preview prepared successfully for ${side} side`, 'success');
          })
          .catch(err => {
            console.error('Failed to generate cheap copy base64:', err);
            toast(`Failed to prepare ${side} side web preview. Previews may not be visible to organizations.`, 'warning');
          });

      } else {
        // ── Web fallback: not supported for template images ─────────
        throw new Error('Template image upload is only supported in the Desktop App.');
      }
    } catch (err: any) {
      toast(err.message || 'Failed to upload image', 'error');
    } finally {
      if (side === 'front') setUploadingFront(false);
      else setUploadingBack(false);
    }
  };

  const handleMouseDown = (
    e: React.MouseEvent, 
    side: 'front' | 'back', 
    index: number, 
    type: 'move' | 'resize',
    scale: number
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedFieldIndex(index);
    setSelectedSide(side);

    const fields = side === 'front' ? frontFields : backFields;
    const field = fields[index];

    setDragState({
      index,
      side,
      type,
      startX: e.clientX,
      startY: e.clientY,
      origX: field.x,
      origY: field.y,
      origW: field.width,
      origH: field.height,
    });
  };

  const handleMouseMove = (e: MouseEvent, scale: number) => {
    if (!dragState) return;

    const dx = (e.clientX - dragState.startX) / scale;
    const dy = (e.clientY - dragState.startY) / scale;

    const fields = dragState.side === 'front' ? [...frontFields] : [...backFields];
    const field = { ...fields[dragState.index] };

    if (dragState.type === 'move') {
      field.x = Math.max(0, Math.round(dragState.origX + dx));
      field.y = Math.max(0, Math.round(dragState.origY + dy));
    } else {
      field.width = Math.max(10, Math.round(dragState.origW + dx));
      field.height = Math.max(10, Math.round(dragState.origH + dy));
    }

    fields[dragState.index] = field;

    if (dragState.side === 'front') {
      setFrontFields(fields);
    } else {
      setBackFields(fields);
    }
  };

  const handleMouseUp = () => {
    setDragState(null);
  };

  useEffect(() => {
    if (!dragState) return;

    const scale = 480 / cardWidth;

    const onMouseMove = (e: MouseEvent) => handleMouseMove(e, scale);
    const onMouseUp = () => handleMouseUp();

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [dragState, frontFields, backFields, cardWidth]);

  const handleEditorMouseDown = (e: React.MouseEvent<HTMLDivElement>, side: 'front' | 'back') => {
    if (e.target !== e.currentTarget) return;

    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const scale = 480 / cardWidth;
    
    const startCardX = Math.round((e.clientX - rect.left) / scale);
    const startCardY = Math.round((e.clientY - rect.top) / scale);

    const newIndex = side === 'front' ? frontFields.length : backFields.length;
    const newField: FieldCoordinate = {
      field: `field_${newIndex + 1}`,
      type: 'text',
      x: startCardX,
      y: startCardY,
      width: 150,
      height: 30,
      fontSize: 18,
      fontWeight: 'normal',
      color: '#000000',
      align: 'left',
      prefix: `field_${newIndex + 1}: `,
    };

    if (side === 'front') {
      setFrontFields([...frontFields, newField]);
      setSelectedSide('front');
    } else {
      setBackFields([...backFields, newField]);
      setSelectedSide('back');
    }

    setSelectedFieldIndex(newIndex);

    setDragState({
      index: newIndex,
      side: side,
      type: 'resize',
      startX: e.clientX,
      startY: e.clientY,
      origX: startCardX,
      origY: startCardY,
      origW: 150,
      origH: 30,
    });
  };

  const getBoxStyle = (f: FieldCoordinate, isSelected: boolean, scale: number) => {
    const type = f.type;
    let color = '59, 130, 246';
    if (type === 'image') color = '16, 185, 129';
    if (type === 'qr') color = '139, 92, 246';
    if (type === 'barcode') color = '245, 158, 11';
    if (type === 'id') color = '219, 39, 119'; // Pink/Magenta for ID Field

    const isTextLike = type === 'text' || type === 'id';

    if (showTestData) {
      return {
        border: isSelected ? '1.5px dashed var(--primary)' : '1px dashed rgba(255,255,255,0.15)',
        background: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
        boxShadow: 'none',
        zIndex: isSelected ? 100 : 10,
        borderRadius: type === 'image' && f.borderRadius ? `${f.borderRadius * scale}px` : undefined,
      };
    }

    return {
      border: isSelected ? '2.5px solid #ffffff' : `1.5px solid rgb(${color})`,
      background: `rgba(${color}, ${isSelected ? '0.35' : '0.15'})`,
      boxShadow: isSelected ? '0 0 10px rgba(255,255,255,0.6)' : 'none',
      zIndex: isSelected ? 100 : 10,
      // Apply border radius for image fields so the overlay matches the rendered output
      borderRadius: type === 'image' && f.borderRadius ? `${f.borderRadius * scale}px` : undefined,
      // Reflect font styling on text labels inside the overlay
      fontStyle: isTextLike && f.fontStyle === 'italic' ? 'italic' : 'normal',
      fontWeight: isTextLike && f.fontWeight ? f.fontWeight : 'normal',
      fontFamily: isTextLike && f.fontFamily ? f.fontFamily : undefined,
      letterSpacing: isTextLike && f.letterSpacing ? `${f.letterSpacing * scale}px` : undefined,
      lineHeight: isTextLike && f.lineHeight ? f.lineHeight : undefined,
      textDecoration: isTextLike && f.textDecoration ? f.textDecoration : undefined,
      textTransform: isTextLike && f.textTransform ? f.textTransform : undefined,
      opacity: f.opacity != null ? f.opacity : undefined,
    };
  };
  const getFieldDefaultValue = (fieldName: string, fieldType: string) => {
    const nameLower = fieldName.toLowerCase();
    if (fieldType === 'id') {
      return '0042';
    } else if (nameLower.includes('name') || nameLower.includes('fullname')) {
      return 'John Doe';
    } else if (nameLower.includes('designation') || nameLower.includes('role') || nameLower.includes('title')) {
      return 'Software Engineer';
    } else if (nameLower.includes('serial') || nameLower.includes('cardserial')) {
      return 'EMP-0042';
    } else if (nameLower.includes('blood') || nameLower.includes('group')) {
      return 'O+';
    } else if (nameLower.includes('roll') || nameLower.includes('rollno') || nameLower.includes('rollnumber')) {
      return '2026-0042';
    } else if (nameLower.includes('phone') || nameLower.includes('mobile') || nameLower.includes('contact')) {
      return '+1 234 567 8900';
    } else if (nameLower.includes('email') || nameLower.includes('mail')) {
      return 'johndoe@example.com';
    } else if (nameLower.includes('dob') || nameLower.includes('birth') || nameLower.includes('dateofbirth')) {
      return '12/05/2000';
    } else {
      return fieldName;
    }
  };

  const getTestDataValue = (f: FieldCoordinate) => {
    const customVal = testData[f.field];
    const val = (customVal !== undefined && customVal !== '') ? customVal : getFieldDefaultValue(f.field, f.type);
    return `${f.prefix || ''}${val}${f.suffix || ''}`;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const electronAPI = (window as any).electronAPI;
      const finalFrontWebUrl = frontWebUrl || (frontImageUrl.startsWith('local://') ? '' : frontImageUrl);
      const finalBackWebUrl = backWebUrl || (backImageUrl.startsWith('local://') ? '' : backImageUrl);

      if (!finalFrontWebUrl) throw new Error('Front background web preview is still uploading or missing.');

      const url = editingTemplateId ? `/api/templates/${editingTemplateId}` : '/api/templates';
      const method = editingTemplateId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          cardWidth,
          cardHeight,
          frontImageUrl: finalFrontWebUrl,
          backImageUrl: finalBackWebUrl || null,
          frontFields: JSON.stringify(frontFields),
          backFields: JSON.stringify(backFields),
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save template');

      const savedTemplate = json.template;
      if (electronAPI?.finalizeTemplateOriginals && savedTemplate?.id) {
        await electronAPI.finalizeTemplateOriginals({
          templateId: savedTemplate.id,
          frontLocalPath,
          backLocalPath
        });
      }

      // Reset
      setName('');
      setCardWidth(1011);
      setCardHeight(638);
      setFrontImageUrl('');
      setBackImageUrl('');
      setFrontLocalPath('');
      setBackLocalPath('');
      setFrontWebUrl('');
      setBackWebUrl('');
      setFrontFields([]);
      setBackFields([]);
      setShowForm(false);
      setEditingTemplateId(null);
      setTestData({});
      fetchTemplates();
    } catch (err: any) {
      setError(err.message || 'Error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditClick = (tmpl: any) => {
    setEditingTemplateId(tmpl.id);
    setName(tmpl.name);
    setCardWidth(tmpl.cardWidth);
    setCardHeight(tmpl.cardHeight);
    setFrontImageUrl(tmpl.frontImageUrl);
    setBackImageUrl(tmpl.backImageUrl || '');
    setFrontWebUrl(tmpl.frontImageUrl);
    setBackWebUrl(tmpl.backImageUrl || '');
    setFrontLocalPath('');
    setBackLocalPath('');
    setFrontFields(JSON.parse(tmpl.frontFields || '[]'));
    setBackFields(JSON.parse(tmpl.backFields || '[]'));
    setShowForm(true);
  };

  const handleDeleteTemplate = (id: number) => {
    showConfirm({
      title: 'Delete Template',
      message: 'All history and field configurations for this layout will be permanently removed. This action cannot be undone.',
      confirmLabel: 'Delete',
      variant: 'danger',
      onConfirm: async () => {
        closeConfirm();
        try {
          const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' });
          if (res.ok) { fetchTemplates(); }
          else { const data = await res.json(); toast(data.error || 'Failed to delete template', 'error'); }
        } catch (err) { console.error(err); toast('Error deleting template', 'error'); }
      },
    });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1>Card Templates</h1>
          <p style={{ marginTop: '4px' }}>Upload design layouts and configure placement coordinate fields.</p>
        </div>
        {isElectron ? (
          <button className="btn btn-primary" onClick={() => {
            if (showForm) {
              setEditingTemplateId(null);
              setName('');
              setCardWidth(1011);
              setCardHeight(638);
              setFrontImageUrl('');
              setBackImageUrl('');
              setFrontFields([]);
              setBackFields([]);
              setTestData({});
            }
            setShowForm(!showForm);
          }}>
            <Plus size={18} /> {showForm ? 'Hide Form' : 'Create Template'}
          </button>
        ) : (
          <div style={{ padding: '8px 14px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', fontSize: '0.85rem', color: '#a0aec0', border: '1px solid rgba(255,255,255,0.08)' }}>
            ℹ️ Design functions only available in Desktop App
          </div>
        )}
      </div>

      {showForm && (
        <div className="glass-panel" style={{ marginBottom: '32px' }}>
          <h3 style={{ marginBottom: '24px' }}>{editingTemplateId ? `Edit Template: ${name}` : 'Template Designer Setup'}</h3>
          {error && (
            <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f77', borderRadius: '6px', marginBottom: '20px', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
              <div className="form-group">
                <label className="form-label">Template Name</label>
                <input type="text" required className="form-input" placeholder="Classic Devanagari School ID" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Dimensions</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>Width (mm)</span>
                      <input 
                        type="number" 
                        step="0.1"
                        className="form-input" 
                        placeholder="e.g. 85.6" 
                        value={cardWidth ? Math.round((cardWidth * 25.4 / 300) * 10) / 10 : ''} 
                        onChange={e => {
                          const mm = Number(e.target.value);
                          setCardWidth(mm ? Math.round(mm * 300 / 25.4) : 0);
                        }} 
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>Height (mm)</span>
                      <input 
                        type="number" 
                        step="0.1"
                        className="form-input" 
                        placeholder="e.g. 54" 
                        value={cardHeight ? Math.round((cardHeight * 25.4 / 300) * 10) / 10 : ''} 
                        onChange={e => {
                          const mm = Number(e.target.value);
                          setCardHeight(mm ? Math.round(mm * 300 / 25.4) : 0);
                        }} 
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>Width (px at 300 DPI)</span>
                      <input 
                        type="number" 
                        required 
                        className="form-input" 
                        placeholder="Width" 
                        value={cardWidth || ''} 
                        onChange={e => setCardWidth(Number(e.target.value))} 
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>Height (px at 300 DPI)</span>
                      <input 
                        type="number" 
                        required 
                        className="form-input" 
                        placeholder="Height" 
                        value={cardHeight || ''} 
                        onChange={e => setCardHeight(Number(e.target.value))} 
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: '500' }}>Front Background Design Image</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <input 
                    type="file" 
                    accept=".svg,.pdf,.png" 
                    className="form-input" 
                    style={{ padding: '6px 12px', opacity: isElectron ? 1 : 0.4, cursor: isElectron ? 'pointer' : 'not-allowed' }}
                    onChange={e => handleFileUpload(e, 'front')} 
                    disabled={uploadingFront || !isElectron}
                  />
                  {!isElectron && <div style={{ fontSize: '0.75rem', color: 'var(--warning)' }}>⚠️ File upload only available in Desktop App</div>}
                  {uploadingFront && <div style={{ fontSize: '0.8rem', color: 'var(--primary)' }}>💾 Saving locally...</div>}
                  <input 
                    type="text" 
                    required 
                    className="form-input" 
                    placeholder="Or paste background image URL: https://example.com/..." 
                    value={frontImageUrl} 
                    onChange={e => setFrontImageUrl(e.target.value)} 
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: '500' }}>Back Background Design Image (Optional)</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <input 
                    type="file" 
                    accept=".svg,.pdf,.png" 
                    className="form-input" 
                    style={{ padding: '6px 12px', opacity: isElectron ? 1 : 0.4, cursor: isElectron ? 'pointer' : 'not-allowed' }}
                    onChange={e => handleFileUpload(e, 'back')} 
                    disabled={uploadingBack || !isElectron}
                  />
                  {!isElectron && <div style={{ fontSize: '0.75rem', color: 'var(--warning)' }}>⚠️ File upload only available in Desktop App</div>}
                  {uploadingBack && <div style={{ fontSize: '0.8rem', color: 'var(--primary)' }}>💾 Saving locally...</div>}
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Or paste background image URL: https://example.com/..." 
                    value={backImageUrl} 
                    onChange={e => setBackImageUrl(e.target.value)} 
                  />
                </div>
              </div>
            </div>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '30px'
            }}>
              {/* Top Block: Visual Editor Canvas */}
              <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <h4 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                    <Sliders size={18} color="var(--primary)" />
                    Visual Interactive Designer
                  </h4>
                  <label style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px', 
                    fontSize: '0.8rem', 
                    cursor: 'pointer', 
                    background: showTestData ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.05)', 
                    padding: '6px 12px', 
                    borderRadius: '8px', 
                    border: showTestData ? '1px solid var(--primary)' : '1px solid var(--glass-border)',
                    transition: 'all 0.2s',
                    userSelect: 'none',
                    fontWeight: 500,
                  }}>
                    <input 
                      type="checkbox" 
                      checked={showTestData} 
                      onChange={e => setShowTestData(e.target.checked)} 
                      style={{ cursor: 'pointer', margin: 0 }}
                    />
                    <span>Preview Test Data</span>
                  </label>
                </div>

                {showTestData && (
                  <div style={{
                    padding: '16px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '8px',
                    marginBottom: '8px'
                  }}>
                    <div style={{ 
                      fontSize: '0.85rem', 
                      fontWeight: 600, 
                      color: 'var(--primary)', 
                      marginBottom: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <Sliders size={14} />
                      Customize Preview Test Data
                    </div>
                    {(() => {
                      const getUniqueFieldsWithTypes = () => {
                        const map = new Map<string, string>();
                        [...frontFields, ...backFields].forEach(f => {
                          if (!map.has(f.field)) {
                            map.set(f.field, f.type);
                          }
                        });
                        return Array.from(map.entries()).map(([field, type]) => ({ field, type }));
                      };
                      const fields = getUniqueFieldsWithTypes();
                      if (fields.length === 0) {
                        return (
                          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', fontStyle: 'italic' }}>
                            Add field mappings below or click on the card to place a field, then customize its test value here.
                          </div>
                        );
                      }
                      return (
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                          gap: '12px'
                        }}>
                          {fields.map(({ field, type }) => (
                            <div key={field} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <span style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'flex', justifyContent: 'space-between' }}>
                                <span>{field}</span>
                                <span style={{ opacity: 0.6, fontSize: '0.65rem', textTransform: 'uppercase' }}>({type})</span>
                              </span>
                              <input
                                type="text"
                                className="form-input"
                                style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                                placeholder={getFieldDefaultValue(field, type)}
                                value={testData[field] || ''}
                                onChange={e => setTestData({ ...testData, [field]: e.target.value })}
                              />
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}

                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '24px',
                  justifyContent: 'center',
                  alignItems: 'flex-start',
                  marginTop: '10px'
                }}>
                  {/* Front Side Designer */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    <div className="badge badge-primary" style={{ padding: '6px 12px', fontSize: '0.75rem', fontWeight: 600 }}>
                      Front Side Layout Design
                    </div>
                    {frontImageUrl ? (
                      (() => {
                        const editorWidth = 480;
                        const scale = editorWidth / cardWidth;
                        const editorHeight = cardHeight * scale;
                        return (
                          <div 
                            onMouseDown={(e) => handleEditorMouseDown(e, 'front')}
                            style={{
                              width: `${editorWidth}px`,
                              height: `${editorHeight}px`,
                              backgroundImage: `url(${getOptimizedImageUrl(frontImageUrl)})`,
                              backgroundSize: '100% 100%',
                              backgroundPosition: 'center',
                              borderRadius: '8px',
                              border: '1.5px solid var(--glass-border)',
                              position: 'relative',
                              overflow: 'hidden',
                              cursor: 'crosshair',
                              boxShadow: '0 8px 30px rgba(0,0,0,0.5)'
                            }}
                          >
                            {frontFields.map((f, i) => {
                              const x = f.x * scale;
                              const y = f.y * scale;
                              const w = f.width * scale;
                              const h = f.height * scale;
                              const isSelected = selectedFieldIndex === i && selectedSide === 'front';
                              const style = getBoxStyle(f, isSelected, scale);

                              const isTextLike = f.type === 'text' || f.type === 'id';
                              const testDataStyle: React.CSSProperties = (showTestData && isTextLike) ? {
                                fontSize: `${(f.fontSize || 18) * scale}px`,
                                color: f.color || '#000000',
                                fontFamily: f.fontFamily || 'sans-serif',
                                fontWeight: f.fontWeight || 'normal',
                                fontStyle: f.fontStyle || 'normal',
                                textAlign: f.align || 'left',
                                justifyContent: f.align === 'center' ? 'center' : (f.align === 'right' ? 'flex-end' : 'flex-start'),
                                padding: '0 4px',
                                textShadow: 'none',
                                overflow: 'hidden',
                                whiteSpace: 'nowrap',
                                letterSpacing: f.letterSpacing ? `${f.letterSpacing * scale}px` : undefined,
                                lineHeight: f.lineHeight ? f.lineHeight : undefined,
                                textDecoration: f.textDecoration ? f.textDecoration : undefined,
                                textTransform: f.textTransform ? f.textTransform as any : undefined,
                                opacity: f.opacity != null ? f.opacity : undefined,
                              } : {};

                              return (
                                <div
                                  key={i}
                                  onMouseDown={(e) => handleMouseDown(e, 'front', i, 'move', scale)}
                                  style={{
                                    position: 'absolute',
                                    left: `${x}px`,
                                    top: `${y}px`,
                                    width: `${w}px`,
                                    height: `${h}px`,
                                    cursor: 'move',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '0.65rem',
                                    color: '#ffffff',
                                    textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                                    userSelect: 'none',
                                    textAlign: 'center',
                                    wordBreak: 'break-all',
                                    ...style,
                                    ...testDataStyle
                                  }}
                                >
                                  {showTestData ? (
                                    f.type === 'image' ? (
                                      <img 
                                        src={testData[f.field] || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=200&fit=crop"} 
                                        alt="Test Avatar" 
                                        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: f.borderRadius ? `${f.borderRadius * scale}px` : '0px' }} 
                                        draggable={false}
                                      />
                                    ) : f.type === 'qr' ? (
                                      <img 
                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(testData[f.field] || 'https://student-id-pdf-system.com')}`} 
                                        alt="Test QR" 
                                        style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                                        draggable={false}
                                      />
                                    ) : f.type === 'barcode' ? (
                                      <div style={{ width: '100%', height: '100%', background: '#ffffff repeating-linear-gradient(90deg, #000000, #000000 2px, #ffffff 2px, #ffffff 6px)', padding: '4px' }} />
                                    ) : (
                                      getTestDataValue(f)
                                    )
                                  ) : (
                                    f.field
                                  )}
                                  
                                  {/* Resize Handle */}
                                  <div
                                    onMouseDown={(e) => handleMouseDown(e, 'front', i, 'resize', scale)}
                                    style={{
                                      position: 'absolute',
                                      right: '0',
                                      bottom: '0',
                                      width: '10px',
                                      height: '10px',
                                      cursor: 'se-resize',
                                      background: isSelected ? '#ffffff' : 'rgba(255,255,255,0.4)',
                                      borderRadius: '50%',
                                      margin: '2px',
                                      boxShadow: '0 1px 3px rgba(0,0,0,0.5)'
                                    }}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()
                    ) : (
                      <div style={{
                        width: '480px',
                        height: '303px',
                        border: '1.5px dashed var(--glass-border)',
                        borderRadius: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--muted)',
                        gap: '10px',
                        background: 'rgba(255,255,255,0.01)'
                      }}>
                        <ImageIcon size={32} />
                        <p style={{ fontSize: '0.85rem' }}>Upload front background image to enable designer.</p>
                      </div>
                    )}
                  </div>

                  {/* Back Side Designer */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    <div className="badge badge-primary" style={{ padding: '6px 12px', fontSize: '0.75rem', fontWeight: 600 }}>
                      Back Side Layout Design
                    </div>
                    {backImageUrl ? (
                      (() => {
                        const editorWidth = 480;
                        const scale = editorWidth / cardWidth;
                        const editorHeight = cardHeight * scale;
                        return (
                          <div 
                            onMouseDown={(e) => handleEditorMouseDown(e, 'back')}
                            style={{
                              width: `${editorWidth}px`,
                              height: `${editorHeight}px`,
                              backgroundImage: `url(${getOptimizedImageUrl(backImageUrl)})`,
                              backgroundSize: '100% 100%',
                              backgroundPosition: 'center',
                              borderRadius: '8px',
                              border: '1.5px solid var(--glass-border)',
                              position: 'relative',
                              overflow: 'hidden',
                              cursor: 'crosshair',
                              boxShadow: '0 8px 30px rgba(0,0,0,0.5)'
                            }}
                          >
                            {backFields.map((f, i) => {
                              const x = f.x * scale;
                              const y = f.y * scale;
                              const w = f.width * scale;
                              const h = f.height * scale;
                              const isSelected = selectedFieldIndex === i && selectedSide === 'back';
                              const style = getBoxStyle(f, isSelected, scale);

                              const isTextLike = f.type === 'text' || f.type === 'id';
                              const testDataStyle: React.CSSProperties = (showTestData && isTextLike) ? {
                                fontSize: `${(f.fontSize || 18) * scale}px`,
                                color: f.color || '#000000',
                                fontFamily: f.fontFamily || 'sans-serif',
                                fontWeight: f.fontWeight || 'normal',
                                fontStyle: f.fontStyle || 'normal',
                                textAlign: f.align || 'left',
                                justifyContent: f.align === 'center' ? 'center' : (f.align === 'right' ? 'flex-end' : 'flex-start'),
                                padding: '0 4px',
                                textShadow: 'none',
                                overflow: 'hidden',
                                whiteSpace: 'nowrap',
                                letterSpacing: f.letterSpacing ? `${f.letterSpacing * scale}px` : undefined,
                                lineHeight: f.lineHeight ? f.lineHeight : undefined,
                                textDecoration: f.textDecoration ? f.textDecoration : undefined,
                                textTransform: f.textTransform ? f.textTransform as any : undefined,
                                opacity: f.opacity != null ? f.opacity : undefined,
                              } : {};

                              return (
                                <div
                                  key={i}
                                  onMouseDown={(e) => handleMouseDown(e, 'back', i, 'move', scale)}
                                  style={{
                                    position: 'absolute',
                                    left: `${x}px`,
                                    top: `${y}px`,
                                    width: `${w}px`,
                                    height: `${h}px`,
                                    cursor: 'move',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '0.65rem',
                                    color: '#ffffff',
                                    textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                                    userSelect: 'none',
                                    textAlign: 'center',
                                    wordBreak: 'break-all',
                                    ...style,
                                    ...testDataStyle
                                  }}
                                >
                                  {showTestData ? (
                                    f.type === 'image' ? (
                                      <img 
                                        src={testData[f.field] || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=200&fit=crop"} 
                                        alt="Test Avatar" 
                                        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: f.borderRadius ? `${f.borderRadius * scale}px` : '0px' }} 
                                        draggable={false}
                                      />
                                    ) : f.type === 'qr' ? (
                                      <img 
                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(testData[f.field] || 'https://student-id-pdf-system.com')}`} 
                                        alt="Test QR" 
                                        style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                                        draggable={false}
                                      />
                                    ) : f.type === 'barcode' ? (
                                      <div style={{ width: '100%', height: '100%', background: '#ffffff repeating-linear-gradient(90deg, #000000, #000000 2px, #ffffff 2px, #ffffff 6px)', padding: '4px' }} />
                                    ) : (
                                      getTestDataValue(f)
                                    )
                                  ) : (
                                    f.field
                                  )}
                                  
                                  {/* Resize Handle */}
                                  <div
                                    onMouseDown={(e) => handleMouseDown(e, 'back', i, 'resize', scale)}
                                    style={{
                                      position: 'absolute',
                                      right: '0',
                                      bottom: '0',
                                      width: '10px',
                                      height: '10px',
                                      cursor: 'se-resize',
                                      background: isSelected ? '#ffffff' : 'rgba(255,255,255,0.4)',
                                      borderRadius: '50%',
                                      margin: '2px',
                                      boxShadow: '0 1px 3px rgba(0,0,0,0.5)'
                                    }}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()
                    ) : (
                      <div style={{
                        width: '480px',
                        height: '303px',
                        border: '1.5px dashed var(--glass-border)',
                        borderRadius: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--muted)',
                        gap: '10px',
                        background: 'rgba(255,255,255,0.01)'
                      }}>
                        <ImageIcon size={32} />
                        <p style={{ fontSize: '0.85rem' }}>Upload back background image to enable designer.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom Block: Bounding Tables */}
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '32px',
                marginTop: '10px'
              }}>
                {/* Coordinates table - Front */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h4 style={{ fontSize: '0.95rem' }}>Front Side Coordinates mapping</h4>
                    <button type="button" className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.75rem' }} onClick={() => handleAddField('front')}>
                      + Add Field Mapping
                    </button>
                  </div>

                  {frontFields.length === 0 ? (
                    <div style={{ padding: '16px', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--glass-border)', borderRadius: '8px', textAlign: 'center', color: 'var(--muted)', fontSize: '0.8rem' }}>
                      No fields mapped on the front side yet.
                    </div>
                  ) : (
                    <div className="table-container">
                      <table className="custom-table" style={{ fontSize: '0.8rem' }}>
                        <thead>
                          <tr>
                            <th>Field Name</th>
                            <th>Type</th>
                            <th>X (px)</th>
                            <th>Y (px)</th>
                            <th>W (px)</th>
                            <th>H (px)</th>
                            <th>Options (Font/Size/Color/Radius)</th>
                            <th>Remove</th>
                          </tr>
                        </thead>
                        <tbody>
                          {frontFields.map((f, i) => (
                            <tr key={i} style={{ background: selectedFieldIndex === i && selectedSide === 'front' ? 'rgba(59, 130, 246, 0.1)' : 'transparent' }} onClick={() => { setSelectedFieldIndex(i); setSelectedSide('front'); }}>
                              <td>
                                <input type="text" className="form-input" style={{ padding: '6px 10px', fontSize: '0.8rem' }} value={f.field} onChange={e => handleFieldChange('front', i, 'field', e.target.value)} />
                              </td>
                              <td>
                                <select className="form-select" style={{ padding: '6px 10px', fontSize: '0.8rem' }} value={f.type} onChange={e => handleFieldChange('front', i, 'type', e.target.value)}>
                                  <option value="text">Text Field</option>
                                  <option value="image">Photo / Image</option>
                                  <option value="qr">QR Code</option>
                                  <option value="barcode">Barcode</option>
                                  <option value="id">ID / Serial Field</option>
                                </select>
                              </td>
                              <td><input type="number" className="form-input" style={{ padding: '6px 10px', fontSize: '0.8rem', width: '70px' }} value={f.x} onChange={e => handleFieldChange('front', i, 'x', Number(e.target.value))} /></td>
                              <td><input type="number" className="form-input" style={{ padding: '6px 10px', fontSize: '0.8rem', width: '70px' }} value={f.y} onChange={e => handleFieldChange('front', i, 'y', Number(e.target.value))} /></td>
                              <td><input type="number" className="form-input" style={{ padding: '6px 10px', fontSize: '0.8rem', width: '70px' }} value={f.width} onChange={e => handleFieldChange('front', i, 'width', Number(e.target.value))} /></td>
                              <td><input type="number" className="form-input" style={{ padding: '6px 10px', fontSize: '0.8rem', width: '70px' }} value={f.height} onChange={e => handleFieldChange('front', i, 'height', Number(e.target.value))} /></td>
                              <td>
                                {(f.type === 'text' || f.type === 'id') ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                    {/* Row 1: Size · Color · Align */}
                                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                                      <input type="number" className="form-input" style={{ padding: '4px', fontSize: '0.75rem', width: '44px' }} placeholder="Sz" value={f.fontSize || 16} onChange={e => handleFieldChange('front', i, 'fontSize', Number(e.target.value))} />
                                      <input type="color" title="Text colour" style={{ padding: '2px', height: '28px', width: '36px', border: '1px solid var(--glass-border)', borderRadius: '4px', background: 'transparent', cursor: 'pointer' }} value={f.color || '#000000'} onChange={e => handleFieldChange('front', i, 'color', e.target.value)} />
                                      <select className="form-select" style={{ padding: '4px', fontSize: '0.75rem', width: '72px' }} value={f.align || 'left'} onChange={e => handleFieldChange('front', i, 'align', e.target.value)}>
                                        <option value="left">Left</option>
                                        <option value="center">Center</option>
                                        <option value="right">Right</option>
                                      </select>
                                    </div>
                                    {/* Row 2: Font family & Basic Styles */}
                                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
                                      <select className="form-select" style={{ padding: '4px', fontSize: '0.75rem', flex: 1, minWidth: '110px', fontFamily: f.fontFamily || 'sans-serif' }} value={f.fontFamily || 'sans-serif'} onChange={e => handleFieldChange('front', i, 'fontFamily', e.target.value)}>
                                        <optgroup label="── System">
                                          <option value="sans-serif">Default Sans</option>
                                          <option value="serif">Default Serif</option>
                                          <option value="monospace">Monospace</option>
                                          <option value="Arial">Arial</option>
                                          <option value="Georgia">Georgia</option>
                                          <option value="Verdana">Verdana</option>
                                          <option value="Times New Roman">Times New Roman</option>
                                          <option value="Impact">Impact</option>
                                        </optgroup>
                                        <optgroup label="── Google – Modern">
                                          <option value="Roboto">Roboto</option>
                                          <option value="Open Sans">Open Sans</option>
                                          <option value="Lato">Lato</option>
                                          <option value="Montserrat">Montserrat</option>
                                          <option value="Poppins">Poppins</option>
                                          <option value="Raleway">Raleway</option>
                                          <option value="Oswald">Oswald</option>
                                          <option value="Nunito">Nunito</option>
                                          <option value="Ubuntu">Ubuntu</option>
                                        </optgroup>
                                        <optgroup label="── Google – Display & Script">
                                          <option value="Bebas Neue">Bebas Neue</option>
                                          <option value="Dancing Script">Dancing Script</option>
                                          <option value="Pacifico">Pacifico</option>
                                          <option value="Lobster">Lobster</option>
                                        </optgroup>
                                        <optgroup label="── Google – Hindi / Devanagari">
                                          <option value="Mukta">Mukta</option>
                                          <option value="Hind">Hind</option>
                                          <option value="Tiro Devanagari Hindi">Tiro Devanagari Hindi</option>
                                          <option value="Baloo 2">Baloo 2</option>
                                          <option value="Laila">Laila</option>
                                          <option value="Yatra One">Yatra One</option>
                                          <option value="Kalam">Kalam</option>
                                        </optgroup>
                                      </select>
                                      <select className="form-select" title="Font Weight" style={{ padding: '4px', fontSize: '0.75rem', width: '85px' }} value={f.fontWeight || 'normal'} onChange={e => handleFieldChange('front', i, 'fontWeight', e.target.value)}>
                                        <option value="100">100 - Thin</option>
                                        <option value="200">200 - ExLight</option>
                                        <option value="300">300 - Light</option>
                                        <option value="normal">400 - Normal</option>
                                        <option value="500">500 - Medium</option>
                                        <option value="600">600 - SemiBold</option>
                                        <option value="bold">700 - Bold</option>
                                        <option value="800">800 - ExBold</option>
                                        <option value="900">900 - Black</option>
                                      </select>
                                      <button type="button" title="Italic" onClick={() => handleFieldChange('front', i, 'fontStyle', f.fontStyle === 'italic' ? 'normal' : 'italic')} style={{ padding: '3px 8px', fontSize: '0.8rem', fontStyle: 'italic', borderRadius: '4px', border: '1px solid var(--glass-border)', background: f.fontStyle === 'italic' ? 'var(--primary)' : 'transparent', color: f.fontStyle === 'italic' ? '#fff' : 'var(--muted)', cursor: 'pointer' }}>I</button>
                                      <button type="button" title="Underline" onClick={() => handleFieldChange('front', i, 'textDecoration', f.textDecoration === 'underline' ? 'none' : 'underline')} style={{ padding: '3px 8px', fontSize: '0.8rem', textDecoration: 'underline', borderRadius: '4px', border: '1px solid var(--glass-border)', background: f.textDecoration === 'underline' ? 'var(--primary)' : 'transparent', color: f.textDecoration === 'underline' ? '#fff' : 'var(--muted)', cursor: 'pointer' }}>U</button>
                                      <button type="button" title="Strikethrough" onClick={() => handleFieldChange('front', i, 'textDecoration', f.textDecoration === 'line-through' ? 'none' : 'line-through')} style={{ padding: '3px 8px', fontSize: '0.8rem', textDecoration: 'line-through', borderRadius: '4px', border: '1px solid var(--glass-border)', background: f.textDecoration === 'line-through' ? 'var(--primary)' : 'transparent', color: f.textDecoration === 'line-through' ? '#fff' : 'var(--muted)', cursor: 'pointer' }}>S</button>
                                    </div>
                                    {/* Row 3: Advanced formatting controls */}
                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                        <span style={{ fontSize: '0.6rem', color: 'var(--muted)' }}>Letter Spacing</span>
                                        <input type="number" className="form-input" style={{ padding: '4px', fontSize: '0.75rem', width: '55px' }} min={-5} max={50} step={0.5} placeholder="0" value={f.letterSpacing ?? 0} onChange={e => handleFieldChange('front', i, 'letterSpacing', Number(e.target.value))} />
                                      </div>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                        <span style={{ fontSize: '0.6rem', color: 'var(--muted)' }}>Line H</span>
                                        <input type="number" className="form-input" style={{ padding: '4px', fontSize: '0.75rem', width: '45px' }} min={0.5} max={5} step={0.1} placeholder="1.2" value={f.lineHeight ?? 1.2} onChange={e => handleFieldChange('front', i, 'lineHeight', Number(e.target.value))} />
                                      </div>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                        <span style={{ fontSize: '0.6rem', color: 'var(--muted)' }}>Transform</span>
                                        <select className="form-select" style={{ padding: '4px', fontSize: '0.7rem', width: '85px' }} value={f.textTransform || 'none'} onChange={e => handleFieldChange('front', i, 'textTransform', e.target.value)}>
                                          <option value="none">Normal</option>
                                          <option value="uppercase">UPPERCASE</option>
                                          <option value="lowercase">lowercase</option>
                                          <option value="capitalize">Capitalize</option>
                                        </select>
                                      </div>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                        <span style={{ fontSize: '0.6rem', color: 'var(--muted)' }}>Opacity %</span>
                                        <input type="number" className="form-input" style={{ padding: '4px', fontSize: '0.75rem', width: '50px' }} min={10} max={100} step={5} placeholder="100" value={f.opacity != null ? Math.round(f.opacity * 100) : 100} onChange={e => handleFieldChange('front', i, 'opacity', Number(e.target.value) / 100)} />
                                      </div>
                                    </div>
                                    {/* Row 4: Prefix & Suffix */}
                                    <div style={{ display: 'flex', gap: '5px' }}>
                                      <input type="text" className="form-input" style={{ padding: '4px', fontSize: '0.75rem', width: '90px' }} placeholder="Prefix" value={f.prefix || ''} onChange={e => handleFieldChange('front', i, 'prefix', e.target.value)} />
                                      <input type="text" className="form-input" style={{ padding: '4px', fontSize: '0.75rem', width: '80px' }} placeholder="Suffix" value={f.suffix || ''} onChange={e => handleFieldChange('front', i, 'suffix', e.target.value)} />
                                    </div>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: 'var(--muted)', cursor: 'pointer' }}>
                                      <input type="checkbox" checked={!!f.prefix} onChange={e => {
                                        const isChecked = e.target.checked;
                                        const fmt = (n: string) => n.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim().replace(/^./, s => s.toUpperCase());
                                        handleFieldChange('front', i, 'prefix', isChecked ? `${fmt(f.field)} : ` : '');
                                      }} />
                                      Add Field Name
                                    </label>
                                  </div>
                                ) : f.type === 'image' ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>Border Radius (px)</label>
                                    <input type="number" className="form-input" style={{ padding: '4px', fontSize: '0.8rem', width: '90px' }} min={0} max={500} placeholder="0" value={f.borderRadius || 0} onChange={e => handleFieldChange('front', i, 'borderRadius', Number(e.target.value))} />
                                  </div>
                                ) : <span style={{ color: 'var(--muted)' }}>—</span>}
                              </td>
                              <td>
                                <button type="button" className="btn btn-danger" style={{ padding: '6px 10px', fontSize: '0.75rem' }} onClick={() => { handleRemoveField('front', i); setSelectedFieldIndex(null); }}>✕</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Coordinates table - Back */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h4 style={{ fontSize: '0.95rem' }}>Back Side Coordinates mapping</h4>
                    <button type="button" className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.75rem' }} onClick={() => handleAddField('back')}>
                      + Add Field Mapping
                    </button>
                  </div>

                  {backFields.length === 0 ? (
                    <div style={{ padding: '16px', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--glass-border)', borderRadius: '8px', textAlign: 'center', color: 'var(--muted)', fontSize: '0.8rem' }}>
                      No fields mapped on the back side yet.
                    </div>
                  ) : (
                    <div className="table-container">
                      <table className="custom-table" style={{ fontSize: '0.8rem' }}>
                        <thead>
                          <tr>
                            <th>Field Name</th>
                            <th>Type</th>
                            <th>X (px)</th>
                            <th>Y (px)</th>
                            <th>W (px)</th>
                            <th>H (px)</th>
                            <th>Options (Font/Size/Color/Radius)</th>
                            <th>Remove</th>
                          </tr>
                        </thead>
                        <tbody>
                          {backFields.map((f, i) => (
                            <tr key={i} style={{ background: selectedFieldIndex === i && selectedSide === 'back' ? 'rgba(59, 130, 246, 0.1)' : 'transparent' }} onClick={() => { setSelectedFieldIndex(i); setSelectedSide('back'); }}>
                              <td>
                                <input type="text" className="form-input" style={{ padding: '6px 10px', fontSize: '0.8rem' }} value={f.field} onChange={e => handleFieldChange('back', i, 'field', e.target.value)} />
                              </td>
                              <td>
                                <select className="form-select" style={{ padding: '6px 10px', fontSize: '0.8rem' }} value={f.type} onChange={e => handleFieldChange('back', i, 'type', e.target.value)}>
                                  <option value="text">Text Field</option>
                                  <option value="image">Photo / Image</option>
                                  <option value="qr">QR Code</option>
                                  <option value="barcode">Barcode</option>
                                  <option value="id">ID / Serial Field</option>
                                </select>
                              </td>
                              <td><input type="number" className="form-input" style={{ padding: '6px 10px', fontSize: '0.8rem', width: '70px' }} value={f.x} onChange={e => handleFieldChange('back', i, 'x', Number(e.target.value))} /></td>
                              <td><input type="number" className="form-input" style={{ padding: '6px 10px', fontSize: '0.8rem', width: '70px' }} value={f.y} onChange={e => handleFieldChange('back', i, 'y', Number(e.target.value))} /></td>
                              <td><input type="number" className="form-input" style={{ padding: '6px 10px', fontSize: '0.8rem', width: '70px' }} value={f.width} onChange={e => handleFieldChange('back', i, 'width', Number(e.target.value))} /></td>
                              <td><input type="number" className="form-input" style={{ padding: '6px 10px', fontSize: '0.8rem', width: '70px' }} value={f.height} onChange={e => handleFieldChange('back', i, 'height', Number(e.target.value))} /></td>
                              <td>
                                {(f.type === 'text' || f.type === 'id') ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                    {/* Row 1: Size · Color · Align */}
                                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                                      <input type="number" className="form-input" style={{ padding: '4px', fontSize: '0.75rem', width: '44px' }} placeholder="Sz" value={f.fontSize || 16} onChange={e => handleFieldChange('back', i, 'fontSize', Number(e.target.value))} />
                                      <input type="color" title="Text colour" style={{ padding: '2px', height: '28px', width: '36px', border: '1px solid var(--glass-border)', borderRadius: '4px', background: 'transparent', cursor: 'pointer' }} value={f.color || '#000000'} onChange={e => handleFieldChange('back', i, 'color', e.target.value)} />
                                      <select className="form-select" style={{ padding: '4px', fontSize: '0.75rem', width: '72px' }} value={f.align || 'left'} onChange={e => handleFieldChange('back', i, 'align', e.target.value)}>
                                        <option value="left">Left</option>
                                        <option value="center">Center</option>
                                        <option value="right">Right</option>
                                      </select>
                                    </div>
                                    {/* Row 2: Font family & Basic Styles */}
                                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
                                      <select className="form-select" style={{ padding: '4px', fontSize: '0.75rem', flex: 1, minWidth: '110px', fontFamily: f.fontFamily || 'sans-serif' }} value={f.fontFamily || 'sans-serif'} onChange={e => handleFieldChange('back', i, 'fontFamily', e.target.value)}>
                                        <optgroup label="── System">
                                          <option value="sans-serif">Default Sans</option>
                                          <option value="serif">Default Serif</option>
                                          <option value="monospace">Monospace</option>
                                          <option value="Arial">Arial</option>
                                          <option value="Georgia">Georgia</option>
                                          <option value="Verdana">Verdana</option>
                                          <option value="Times New Roman">Times New Roman</option>
                                          <option value="Impact">Impact</option>
                                        </optgroup>
                                        <optgroup label="── Google – Modern">
                                          <option value="Roboto">Roboto</option>
                                          <option value="Open Sans">Open Sans</option>
                                          <option value="Lato">Lato</option>
                                          <option value="Montserrat">Montserrat</option>
                                          <option value="Poppins">Poppins</option>
                                          <option value="Raleway">Raleway</option>
                                          <option value="Oswald">Oswald</option>
                                          <option value="Nunito">Nunito</option>
                                          <option value="Ubuntu">Ubuntu</option>
                                        </optgroup>
                                        <optgroup label="── Google – Display & Script">
                                          <option value="Bebas Neue">Bebas Neue</option>
                                          <option value="Dancing Script">Dancing Script</option>
                                          <option value="Pacifico">Pacifico</option>
                                          <option value="Lobster">Lobster</option>
                                        </optgroup>
                                        <optgroup label="── Google – Hindi / Devanagari">
                                          <option value="Mukta">Mukta</option>
                                          <option value="Hind">Hind</option>
                                          <option value="Tiro Devanagari Hindi">Tiro Devanagari Hindi</option>
                                          <option value="Baloo 2">Baloo 2</option>
                                          <option value="Laila">Laila</option>
                                          <option value="Yatra One">Yatra One</option>
                                          <option value="Kalam">Kalam</option>
                                        </optgroup>
                                      </select>
                                      <select className="form-select" title="Font Weight" style={{ padding: '4px', fontSize: '0.75rem', width: '85px' }} value={f.fontWeight || 'normal'} onChange={e => handleFieldChange('back', i, 'fontWeight', e.target.value)}>
                                        <option value="100">100 - Thin</option>
                                        <option value="200">200 - ExLight</option>
                                        <option value="300">300 - Light</option>
                                        <option value="normal">400 - Normal</option>
                                        <option value="500">500 - Medium</option>
                                        <option value="600">600 - SemiBold</option>
                                        <option value="bold">700 - Bold</option>
                                        <option value="800">800 - ExBold</option>
                                        <option value="900">900 - Black</option>
                                      </select>
                                      <button type="button" title="Italic" onClick={() => handleFieldChange('back', i, 'fontStyle', f.fontStyle === 'italic' ? 'normal' : 'italic')} style={{ padding: '3px 8px', fontSize: '0.8rem', fontStyle: 'italic', borderRadius: '4px', border: '1px solid var(--glass-border)', background: f.fontStyle === 'italic' ? 'var(--primary)' : 'transparent', color: f.fontStyle === 'italic' ? '#fff' : 'var(--muted)', cursor: 'pointer' }}>I</button>
                                      <button type="button" title="Underline" onClick={() => handleFieldChange('back', i, 'textDecoration', f.textDecoration === 'underline' ? 'none' : 'underline')} style={{ padding: '3px 8px', fontSize: '0.8rem', textDecoration: 'underline', borderRadius: '4px', border: '1px solid var(--glass-border)', background: f.textDecoration === 'underline' ? 'var(--primary)' : 'transparent', color: f.textDecoration === 'underline' ? '#fff' : 'var(--muted)', cursor: 'pointer' }}>U</button>
                                      <button type="button" title="Strikethrough" onClick={() => handleFieldChange('back', i, 'textDecoration', f.textDecoration === 'line-through' ? 'none' : 'line-through')} style={{ padding: '3px 8px', fontSize: '0.8rem', textDecoration: 'line-through', borderRadius: '4px', border: '1px solid var(--glass-border)', background: f.textDecoration === 'line-through' ? 'var(--primary)' : 'transparent', color: f.textDecoration === 'line-through' ? '#fff' : 'var(--muted)', cursor: 'pointer' }}>S</button>
                                    </div>
                                    {/* Row 3: Advanced formatting controls */}
                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                        <span style={{ fontSize: '0.6rem', color: 'var(--muted)' }}>Letter Spacing</span>
                                        <input type="number" className="form-input" style={{ padding: '4px', fontSize: '0.75rem', width: '55px' }} min={-5} max={50} step={0.5} placeholder="0" value={f.letterSpacing ?? 0} onChange={e => handleFieldChange('back', i, 'letterSpacing', Number(e.target.value))} />
                                      </div>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                        <span style={{ fontSize: '0.6rem', color: 'var(--muted)' }}>Line H</span>
                                        <input type="number" className="form-input" style={{ padding: '4px', fontSize: '0.75rem', width: '45px' }} min={0.5} max={5} step={0.1} placeholder="1.2" value={f.lineHeight ?? 1.2} onChange={e => handleFieldChange('back', i, 'lineHeight', Number(e.target.value))} />
                                      </div>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                        <span style={{ fontSize: '0.6rem', color: 'var(--muted)' }}>Transform</span>
                                        <select className="form-select" style={{ padding: '4px', fontSize: '0.7rem', width: '85px' }} value={f.textTransform || 'none'} onChange={e => handleFieldChange('back', i, 'textTransform', e.target.value)}>
                                          <option value="none">Normal</option>
                                          <option value="uppercase">UPPERCASE</option>
                                          <option value="lowercase">lowercase</option>
                                          <option value="capitalize">Capitalize</option>
                                        </select>
                                      </div>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                        <span style={{ fontSize: '0.6rem', color: 'var(--muted)' }}>Opacity %</span>
                                        <input type="number" className="form-input" style={{ padding: '4px', fontSize: '0.75rem', width: '50px' }} min={10} max={100} step={5} placeholder="100" value={f.opacity != null ? Math.round(f.opacity * 100) : 100} onChange={e => handleFieldChange('back', i, 'opacity', Number(e.target.value) / 100)} />
                                      </div>
                                    </div>
                                    {/* Row 4: Prefix & Suffix */}
                                    <div style={{ display: 'flex', gap: '5px' }}>
                                      <input type="text" className="form-input" style={{ padding: '4px', fontSize: '0.75rem', width: '90px' }} placeholder="Prefix" value={f.prefix || ''} onChange={e => handleFieldChange('back', i, 'prefix', e.target.value)} />
                                      <input type="text" className="form-input" style={{ padding: '4px', fontSize: '0.75rem', width: '80px' }} placeholder="Suffix" value={f.suffix || ''} onChange={e => handleFieldChange('back', i, 'suffix', e.target.value)} />
                                    </div>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: 'var(--muted)', cursor: 'pointer' }}>
                                      <input type="checkbox" checked={!!f.prefix} onChange={e => {
                                        const isChecked = e.target.checked;
                                        const fmt = (n: string) => n.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim().replace(/^./, s => s.toUpperCase());
                                        handleFieldChange('back', i, 'prefix', isChecked ? `${fmt(f.field)} : ` : '');
                                      }} />
                                      Add Field Name
                                    </label>
                                  </div>
                                ) : f.type === 'image' ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>Border Radius (px)</label>
                                    <input type="number" className="form-input" style={{ padding: '4px', fontSize: '0.8rem', width: '90px' }} min={0} max={500} placeholder="0" value={f.borderRadius || 0} onChange={e => handleFieldChange('back', i, 'borderRadius', Number(e.target.value))} />
                                  </div>
                                ) : <span style={{ color: 'var(--muted)' }}>—</span>}
                              </td>
                              <td>
                                <button type="button" className="btn btn-danger" style={{ padding: '6px 10px', fontSize: '0.75rem' }} onClick={() => { handleRemoveField('back', i); setSelectedFieldIndex(null); }}>✕</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => {
                setShowForm(false);
                setEditingTemplateId(null);
                setName('');
                setCardWidth(1011);
                setCardHeight(638);
                setFrontImageUrl('');
                setBackImageUrl('');
                setFrontFields([]);
                setBackFields([]);
                setTestData({});
              }}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                <Save size={16} /> {submitting ? 'Saving Layout...' : (editingTemplateId ? 'Update Template' : 'Save Template')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Templates List */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '50px 0' }}>
          <div className="spinner"></div>
        </div>
      ) : templates.length === 0 ? (
        <div className="glass-panel" style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--muted)' }}>
          <LayoutGrid size={40} style={{ marginBottom: '16px' }} />
          <h3>No Templates Created</h3>
          <p style={{ marginTop: '8px' }}>Create a template and map card details coordinates to begin layouts previews.</p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
          gap: '24px'
        }}>
          {templates.map((tmpl) => (
            <div key={tmpl.id} className="glass-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '1.1rem', margin: 0 }}>{tmpl.name}</h3>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span className="badge badge-primary">v{tmpl.version}</span>
                    {isElectron && (
                      <>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '4px 8px', fontSize: '0.7rem' }}
                          onClick={() => handleEditClick(tmpl)}
                        >
                          Edit
                        </button>
                        <button 
                          className="btn btn-danger" 
                          style={{ padding: '4px 8px', fontSize: '0.7rem' }}
                          onClick={() => handleDeleteTemplate(tmpl.id)}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
                
                <div style={{ 
                  width: '100%', 
                  height: '180px', 
                  borderRadius: '10px', 
                  backgroundImage: `url(${getOptimizedImageUrl(tmpl.frontImageUrl)})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  border: '1px solid var(--glass-border)',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'flex-end',
                  padding: '12px'
                }}>
                  <div className="badge badge-primary" style={{ background: 'rgba(0,0,0,0.6)', border: 'none' }}>
                    {tmpl.cardWidth} × {tmpl.cardHeight} px ({Math.round((tmpl.cardWidth * 25.4 / 300) * 10) / 10} × {Math.round((tmpl.cardHeight * 25.4 / 300) * 10) / 10} mm)
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '0.75rem' }}>
                  <span style={{ color: 'var(--muted)' }}>Front fields:</span>
                  {JSON.parse(tmpl.frontFields || '[]').map((f: any, idx: number) => (
                    <span key={idx} style={{ color: '#fff', background: 'rgba(255,255,255,0.04)', padding: '2px 6px', borderRadius: '4px' }}>{f.field}</span>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                <button className="btn btn-secondary" style={{ padding: '8px 12px', fontSize: '0.8rem', width: '50%' }} onClick={() => { setPreviewId(tmpl.id); setPreviewSide('front'); }}>
                  <Eye size={14} /> Preview Front
                </button>
                {tmpl.backImageUrl && (
                  <button className="btn btn-secondary" style={{ padding: '8px 12px', fontSize: '0.8rem', width: '50%' }} onClick={() => { setPreviewId(tmpl.id); setPreviewSide('back'); }}>
                    <Eye size={14} /> Preview Back
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview Overlay Modal */}
      {previewId && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999
        }}>
          <div className="glass-panel" style={{ width: '90%', maxWidth: '700px', textAlign: 'center' }}>
            <h3 style={{ marginBottom: '16px' }}>Template Visual Preview ({previewSide.toUpperCase()})</h3>
            
            {(() => {
              const tmpl = templates.find((t) => t.id === previewId);
              if (!tmpl) return <p>Template not found</p>;
              return (
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  background: 'rgba(0,0,0,0.4)',
                  padding: '16px',
                  borderRadius: '12px',
                  marginBottom: '20px',
                  border: '1px solid var(--glass-border)'
                }}>
                  <CardPreview
                    template={tmpl}
                    side={previewSide}
                    style={{ maxWidth: '100%', maxHeight: '400px', objectFit: 'contain', borderRadius: '8px' }}
                  />
                </div>
              );
            })()}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={() => setPreviewSide(previewSide === 'front' ? 'back' : 'front')}>
                Switch to {previewSide === 'front' ? 'Back' : 'Front'}
              </button>
              <button className="btn btn-primary" onClick={() => setPreviewId(null)}>Close Preview</button>
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
