'use client';

import React, { useEffect, useState } from 'react';
import { Plus, LayoutGrid, Sliders, Save, Image as ImageIcon, Eye, Grid3x3, RefreshCw, Trash2, X, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import ConfirmDialog from '@/app/components/ConfirmDialog';
import CardPreview from '@/app/components/CardPreview';
import { computeYOffsets, wrapWords } from '@/lib/pdf/card-renderer-client';

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
  fontStyle?: string;
  color?: string;
  align?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'center' | 'bottom';
  prefix?: string;
  suffix?: string;
  borderRadius?: number;
  fontFamily?: string;
  letterSpacing?: number;
  lineHeight?: number;
  textDecoration?: 'none' | 'underline' | 'line-through';
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  opacity?: number;
  staticValue?: string;
}

export default function TemplatesPage() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<any[]>([]);
  const [globalTemplates, setGlobalTemplates] = useState<any[]>([]);
  const [viewTab, setViewTab] = useState<'my' | 'starter'>('my');
  const [loading, setLoading] = useState(true);
  const [isElectron, setIsElectron] = useState(true);
  const [pressId, setPressId] = useState<number | null>(null);
  const [pressFonts, setPressFonts] = useState<any[]>([]);

  const fetchFonts = async () => {
    try {
      const res = await fetch('/api/fonts');
      if (res.ok) {
        const json = await res.json();
        setPressFonts(json.fonts || []);
      }
    } catch (err) {
      console.error('Failed to fetch press fonts:', err);
    }
  };

  const getFontFamily = (family?: string) => {
    if (!family) return 'sans-serif';
    const isCustom = pressFonts.some(pf => pf.name.toLowerCase() === family.toLowerCase());
    return isCustom ? family.replace(/\s+/g, '_') : family;
  };

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
  const [cardWidth, setCardWidth] = useState(673);
  const [cardHeight, setCardHeight] = useState(1039);
  const [frontImageUrl, setFrontImageUrl] = useState('');
  const [backImageUrl, setBackImageUrl] = useState('');
  const [frontOriginalUrl, setFrontOriginalUrl] = useState('');
  const [backOriginalUrl, setBackOriginalUrl] = useState('');
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

  // Grid overlay state
  const [showGrid, setShowGrid] = useState(false);
  const [gridSize, setGridSize] = useState(20);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [snapToGuides, setSnapToGuides] = useState(true);
  const [frontGuides, setFrontGuides] = useState<{ id: string; type: 'horizontal' | 'vertical'; value: number }[]>([]);
  const [backGuides, setBackGuides] = useState<{ id: string; type: 'horizontal' | 'vertical'; value: number }[]>([]);
  const [activeGuideDrag, setActiveGuideDrag] = useState<{ id: string; side: 'front' | 'back'; type: 'horizontal' | 'vertical'; isNew?: boolean } | null>(null);
  // Bleed & Safe Area guide overlay
  const [showBleedGuides, setShowBleedGuides] = useState(false);
  // CR80 standard at 300 DPI: 3.375" x 2.125" => 1013 x 638 px
  // Bleed: 1.5mm at 300 DPI = ~18px; Safe area: 3mm = ~35px
  const BLEED_PX = 18;
  const SAFE_PX = 35;

  // Preview State
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [previewSide, setPreviewSide] = useState<'front' | 'back'>('front');
  const [showTestData, setShowTestData] = useState(false);
  const [testData, setTestData] = useState<Record<string, string>>({});

  // Visual mapping state variables
  const [selectedFieldIndex, setSelectedFieldIndex] = useState<number | null>(null);
  const [selectedSide, setSelectedSide] = useState<'front' | 'back'>('front');
  const [activeTooltipIndex, setActiveTooltipIndex] = useState<number | null>(null);
  const [activeTooltipSide, setActiveTooltipSide] = useState<'front' | 'back' | null>(null);
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
        setGlobalTemplates(json.globalTemplates || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCloneTemplate = async (tmpl: any) => {
    setLoading(true);
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${tmpl.name} (Copy)`,
          cardWidth: tmpl.cardWidth,
          cardHeight: tmpl.cardHeight,
          frontImageUrl: tmpl.frontImageUrl,
          backImageUrl: tmpl.backImageUrl || null,
          frontOriginalUrl: tmpl.frontOriginalUrl || null,
          backOriginalUrl: tmpl.backOriginalUrl || null,
          frontFields: tmpl.frontFields,
          backFields: tmpl.backFields,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to clone template');

      toast(`Successfully cloned "${tmpl.name}" to your library!`, 'success');
      setViewTab('my');
      fetchTemplates();
    } catch (err: any) {
      toast(err.message || 'Error cloning template', 'error');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
    fetchFonts();
  }, []);

  // Load custom fonts in browser for real-time designer preview
  useEffect(() => {
    if (typeof window === 'undefined') return;
    pressFonts.forEach(font => {
      const familyName = font.name.replace(/\s+/g, '_');
      const isLoaded = Array.from(document.fonts.values()).some(
        (f: any) => f.family === familyName
      );
      if (!isLoaded && font.fileUrl) {
        const fontFace = new FontFace(familyName, `url(${font.fileUrl})`);
        fontFace.load().then(loadedFace => {
          document.fonts.add(loadedFace);
          console.log(`Loaded custom font in browser: ${familyName}`);
        }).catch(err => {
          console.error(`Failed to load font ${font.name} in browser:`, err);
        });
      }
    });
  }, [pressFonts]);

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
      verticalAlign: 'top',
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

  // ── DPI / Dimension Standards ─────────────────────────────────────────────
  // CR80 card at 300 DPI:  1013 × 638 px (landscape)
  // CR80 card at 300 DPI:   638 × 1013 px (portrait)
  // Minimum acceptable: 150 DPI => 507 × 319 px
  const CR80_300DPI_W = 1013;
  const CR80_300DPI_H = 638;
  const CR80_150DPI_W = 507;
  const CR80_150DPI_H = 319;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, side: 'front' | 'back') => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Automatically detect image dimensions for setting card width and height
    const isVector = file.type === 'application/pdf' || 
                     file.name.toLowerCase().endsWith('.pdf') || 
                     file.type === 'image/svg+xml' || 
                     file.name.toLowerCase().endsWith('.svg');

    if (isVector) {
      if (side === 'front') { setCardWidth(673); setCardHeight(1039); }
    } else {
      // DPI / Resolution validation for raster images
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          const w = img.width;
          const h = img.height;
          const isLandscape = w >= h;
          const minW = isLandscape ? CR80_150DPI_W : CR80_150DPI_H;
          const minH = isLandscape ? CR80_150DPI_H : CR80_150DPI_W;
          const idealW = isLandscape ? CR80_300DPI_W : CR80_300DPI_H;
          const idealH = isLandscape ? CR80_300DPI_H : CR80_300DPI_W;

          if (w < minW || h < minH) {
            // Hard block — below 150 DPI
            toast(
              `⛔ Image is too low-resolution (${w}×${h}px). ` +
              `Minimum for acceptable print quality is ${minW}×${minH}px (150 DPI). ` +
              `For sharp prints, use ${idealW}×${idealH}px (300 DPI).`,
              'error'
            );
            e.target.value = '';
            resolve();
            return;
          }

          if (w < idealW || h < idealH) {
            // Soft warning — below 300 DPI but usable
            toast(
              `⚠️ Low resolution detected (${w}×${h}px). ` +
              `Prints may appear soft. For crisp ID cards, use ${idealW}×${idealH}px (300 DPI).`,
              'warning'
            );
          } else {
            toast(`✅ Image resolution OK (${w}×${h}px — meets 300 DPI standard).`, 'success');
          }

          if (side === 'front') { setCardWidth(w); setCardHeight(h); }
          resolve();
        };
        img.onerror = () => resolve();
        img.src = URL.createObjectURL(file);
      });

      // Exit early if file was cleared (failed DPI check)
      if (!e.target.files?.[0]) return;
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

        let localPreviewGenerated = false;

        // Trigger base64 preview generation in background
        createCheapCopyBase64(result.url)
          .then(webUrl => {
            localPreviewGenerated = true;
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

        // Upload original to Cloudinary in the background for high-res Electron fallback
        const arrayBufferForUpload = await file.arrayBuffer();
        const uploadFormData = new FormData();
        uploadFormData.append('file', new Blob([arrayBufferForUpload], { type: file.type }), file.name);
        uploadFormData.append('type', 'template');
        fetch('/api/upload', {
          method: 'POST',
          headers: { 'x-press-id': String(pressId ?? 0) },
          body: uploadFormData,
        })
          .then(r => r.json())
          .then(result => {
            if (result.originalUrl) {
              if (side === 'front') {
                setFrontOriginalUrl(result.originalUrl);
                if (!localPreviewGenerated) {
                  createCheapCopyBase64(result.originalUrl)
                    .then(webUrl => {
                      setFrontWebUrl(webUrl);
                      toast(`Web preview prepared successfully from Cloudinary for front side`, 'success');
                    })
                    .catch(err => console.error('Cloudinary fallback web preview failed:', err));
                }
              } else {
                setBackOriginalUrl(result.originalUrl);
                if (!localPreviewGenerated) {
                  createCheapCopyBase64(result.originalUrl)
                    .then(webUrl => {
                      setBackWebUrl(webUrl);
                      toast(`Web preview prepared successfully from Cloudinary for back side`, 'success');
                    })
                    .catch(err => console.error('Cloudinary fallback web preview failed:', err));
                }
              }
            }
          })
          .catch(err => console.error('Background Cloudinary original upload failed:', err));

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

    const threshold = 6; // Snap threshold in pixels

    if (dragState.type === 'move') {
      let targetX = dragState.origX + dx;
      let targetY = dragState.origY + dy;

      // ── Vertical Snapping (X axis) ──
      let snappedX = targetX;
      let minDiffX = threshold;

      if (snapToGuides) {
        const guides = dragState.side === 'front' ? frontGuides : backGuides;
        for (const g of guides) {
          if (g.type === 'vertical') {
            // Left edge
            const diffLeft = Math.abs(targetX - g.value);
            if (diffLeft < minDiffX) {
              minDiffX = diffLeft;
              snappedX = g.value;
            }
            // Right edge
            const diffRight = Math.abs((targetX + field.width) - g.value);
            if (diffRight < minDiffX) {
              minDiffX = diffRight;
              snappedX = g.value - field.width;
            }
            // Center
            const diffCenter = Math.abs((targetX + field.width / 2) - g.value);
            if (diffCenter < minDiffX) {
              minDiffX = diffCenter;
              snappedX = g.value - field.width / 2;
            }
          }
        }
      }

      if (snapToGrid && showGrid && minDiffX === threshold) {
        const gridX = Math.round(targetX / gridSize) * gridSize;
        const diffGrid = Math.abs(targetX - gridX);
        if (diffGrid < threshold) {
          snappedX = gridX;
        }
      }
      field.x = Math.max(0, Math.round(snappedX));

      // ── Horizontal Snapping (Y axis) ──
      let snappedY = targetY;
      let minDiffY = threshold;

      if (snapToGuides) {
        const guides = dragState.side === 'front' ? frontGuides : backGuides;
        for (const g of guides) {
          if (g.type === 'horizontal') {
            // Top edge
            const diffTop = Math.abs(targetY - g.value);
            if (diffTop < minDiffY) {
              minDiffY = diffTop;
              snappedY = g.value;
            }
            // Bottom edge
            const diffBottom = Math.abs((targetY + field.height) - g.value);
            if (diffBottom < minDiffY) {
              minDiffY = diffBottom;
              snappedY = g.value - field.height;
            }
            // Center
            const diffCenter = Math.abs((targetY + field.height / 2) - g.value);
            if (diffCenter < minDiffY) {
              minDiffY = diffCenter;
              snappedY = g.value - field.height / 2;
            }
          }
        }
      }

      if (snapToGrid && showGrid && minDiffY === threshold) {
        const gridY = Math.round(targetY / gridSize) * gridSize;
        const diffGrid = Math.abs(targetY - gridY);
        if (diffGrid < threshold) {
          snappedY = gridY;
        }
      }
      field.y = Math.max(0, Math.round(snappedY));

    } else {
      let targetW = dragState.origW + dx;
      let targetH = dragState.origH + dy;

      // ── Resize Snapping (Width) ──
      let snappedW = targetW;
      let minDiffW = threshold;

      if (snapToGuides) {
        const guides = dragState.side === 'front' ? frontGuides : backGuides;
        for (const g of guides) {
          if (g.type === 'vertical') {
            const diff = Math.abs((field.x + targetW) - g.value);
            if (diff < minDiffW) {
              minDiffW = diff;
              snappedW = g.value - field.x;
            }
          }
        }
      }

      if (snapToGrid && showGrid && minDiffW === threshold) {
        const gridW = Math.round(targetW / gridSize) * gridSize;
        const diffGrid = Math.abs(targetW - gridW);
        if (diffGrid < threshold) {
          snappedW = gridW;
        }
      }
      field.width = Math.max(10, Math.round(snappedW));

      // ── Resize Snapping (Height) ──
      let snappedH = targetH;
      let minDiffH = threshold;

      if (snapToGuides) {
        const guides = dragState.side === 'front' ? frontGuides : backGuides;
        for (const g of guides) {
          if (g.type === 'horizontal') {
            const diff = Math.abs((field.y + targetH) - g.value);
            if (diff < minDiffH) {
              minDiffH = diff;
              snappedH = g.value - field.y;
            }
          }
        }
      }

      if (snapToGrid && showGrid && minDiffH === threshold) {
        const gridH = Math.round(targetH / gridSize) * gridSize;
        const diffGrid = Math.abs(targetH - gridH);
        if (diffGrid < threshold) {
          snappedH = gridH;
        }
      }
      field.height = Math.max(10, Math.round(snappedH));
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
  }, [dragState, frontFields, backFields, cardWidth, showGrid, gridSize, snapToGrid, snapToGuides, frontGuides, backGuides]);

  // ── Guide Dragging Effect ─────────────────────────────────────────────
  useEffect(() => {
    if (!activeGuideDrag) return;

    const scale = 480 / cardWidth;
    const canvasEl = document.getElementById(`designer-canvas-${activeGuideDrag.side}`);
    if (!canvasEl) return;

    const rect = canvasEl.getBoundingClientRect();

    const onMouseMove = (e: MouseEvent) => {
      let val = 0;
      if (activeGuideDrag.type === 'horizontal') {
        val = Math.round((e.clientY - rect.top) / scale);
      } else {
        val = Math.round((e.clientX - rect.left) / scale);
      }

      if (activeGuideDrag.side === 'front') {
        setFrontGuides(prev => prev.map(g => g.id === activeGuideDrag.id ? { ...g, value: val } : g));
      } else {
        setBackGuides(prev => prev.map(g => g.id === activeGuideDrag.id ? { ...g, value: val } : g));
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      let val = 0;
      const limit = activeGuideDrag.type === 'horizontal' ? cardHeight : cardWidth;
      if (activeGuideDrag.type === 'horizontal') {
        val = (e.clientY - rect.top) / scale;
      } else {
        val = (e.clientX - rect.left) / scale;
      }

      // Dragged off canvas or back to ruler → Delete
      const isOff = val < -25 || val > limit + 25;

      if (isOff) {
        if (activeGuideDrag.side === 'front') {
          setFrontGuides(prev => prev.filter(g => g.id !== activeGuideDrag.id));
        } else {
          setBackGuides(prev => prev.filter(g => g.id !== activeGuideDrag.id));
        }
      }

      setActiveGuideDrag(null);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [activeGuideDrag, cardWidth, cardHeight]);

  // ── Photoshop-style Rulers ────────────────────────────────────────────
  const renderRuler = (side: 'front' | 'back', type: 'horizontal' | 'vertical') => {
    const isHoriz = type === 'horizontal';
    const length = isHoriz ? cardWidth : cardHeight;
    const displayLength = isHoriz ? 480 : (480 / cardWidth) * cardHeight;
    const scale = 480 / cardWidth;

    const ticks = [];
    const step = 10;
    for (let i = 0; i <= length; i += step) {
      const pos = i * scale;
      const isMajor = i % 50 === 0;
      const isMedium = i % 10 === 0 && !isMajor;
      
      ticks.push({
        val: i,
        pos,
        isMajor,
        isMedium
      });
    }

    return (
      <div
        onMouseDown={(e) => {
          e.preventDefault();
          const id = `guide_${Date.now()}`;
          const newGuide = { id, type, value: 0 };
          if (side === 'front') {
            setFrontGuides(prev => [...prev, newGuide]);
          } else {
            setBackGuides(prev => [...prev, newGuide]);
          }
          setActiveGuideDrag({ id, side, type, isNew: true });
        }}
        style={{
          position: 'absolute',
          left: isHoriz ? '20px' : '0',
          top: isHoriz ? '0' : '20px',
          width: isHoriz ? `${displayLength}px` : '20px',
          height: isHoriz ? '20px' : `${displayLength}px`,
          background: '#0f172a',
          borderBottom: isHoriz ? '1px solid #334155' : 'none',
          borderRight: !isHoriz ? '1px solid #334155' : 'none',
          cursor: isHoriz ? 'ns-resize' : 'ew-resize',
          userSelect: 'none',
          zIndex: 400
        }}
        title={`Drag down to create a ${isHoriz ? 'horizontal' : 'vertical'} guideline`}
      >
        <svg style={{ width: '100%', height: '100%', overflow: 'visible' }}>
          {ticks.map((t, idx) => {
            if (isHoriz) {
              return (
                <React.Fragment key={idx}>
                  <line
                    x1={t.pos}
                    y1={t.isMajor ? 4 : (t.isMedium ? 10 : 14)}
                    x2={t.pos}
                    y2={20}
                    stroke="#475569"
                    strokeWidth="1"
                  />
                  {t.isMajor && (
                    <text
                      x={t.pos + 2}
                      y={10}
                      fill="#94a3b8"
                      fontSize="7px"
                      fontFamily="monospace"
                    >
                      {t.val}
                    </text>
                  )}
                </React.Fragment>
              );
            } else {
              return (
                <React.Fragment key={idx}>
                  <line
                    x1={t.isMajor ? 4 : (t.isMedium ? 10 : 14)}
                    y1={t.pos}
                    x2={20}
                    y2={t.pos}
                    stroke="#475569"
                    strokeWidth="1"
                  />
                  {t.isMajor && (
                    <text
                      x={2}
                      y={t.pos - 2}
                      fill="#94a3b8"
                      fontSize="7px"
                      fontFamily="monospace"
                      style={{ transform: `rotate(-90deg)`, transformOrigin: `2px ${t.pos - 2}px` }}
                    >
                      {t.val}
                    </text>
                  )}
                </React.Fragment>
              );
            }
          })}
        </svg>
      </div>
    );
  };

  const handleEditorMouseDown = (e: React.MouseEvent<HTMLDivElement>, side: 'front' | 'back') => {
    if (e.target !== e.currentTarget) return;

    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const scale = 480 / cardWidth;
    
    let startCardX = Math.round((e.clientX - rect.left) / scale);
    let startCardY = Math.round((e.clientY - rect.top) / scale);

    if (showGrid) {
      startCardX = Math.round(startCardX / gridSize) * gridSize;
      startCardY = Math.round(startCardY / gridSize) * gridSize;
    }

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

  const renderFieldTooltip = (side: 'front' | 'back', index: number, f: FieldCoordinate, scale: number) => {
    const isTextLike = f.type === 'text' || f.type === 'id';
    const fields = side === 'front' ? frontFields : backFields;
    const setFields = side === 'front' ? setFrontFields : setBackFields;

    const updateField = (updatedProps: Partial<FieldCoordinate>) => {
      const updated = [...fields];
      updated[index] = { ...updated[index], ...updatedProps };
      setFields(updated);
    };

    const deleteField = () => {
      const updated = fields.filter((_, i) => i !== index);
      setFields(updated);
      setSelectedFieldIndex(null);
      setActiveTooltipIndex(null);
      setActiveTooltipSide(null);
    };

    const x = f.x * scale;
    const yOffsets = side === 'front' ? frontYOffsets : backYOffsets;
    const yOffset = yOffsets.get(index) ?? 0;
    const y = (f.y + yOffset) * scale;
    const selfOverflow = getFieldSelfOverflow(f);
    const h = (f.height + selfOverflow) * scale;
    const isLowerHalf = y > (cardHeight * scale) / 2;

    const tooltipLeft = Math.max(0, Math.min(x, 480 - 320)); // 320px width

    const handleStaticImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          updateField({ staticValue: event.target.result as string });
        }
      };
      reader.readAsDataURL(file);
    };

    return (
      <div
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          left: `${tooltipLeft}px`,
          ...(isLowerHalf ? {
            top: `${y - 8}px`,
            transform: 'translateY(-100%)',
          } : {
            top: `${y + h + 8}px`,
          }),
          width: '320px',
          background: 'rgba(15, 23, 42, 0.96)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '8px',
          padding: '12px',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
          color: '#f8fafc',
          zIndex: 10000,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: '0.8rem',
        }}
      >
        {/* Header / Title / Delete Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '6px' }}>
          <span style={{ fontWeight: 600, color: '#38bdf8' }}>Edit Field #{index + 1}</span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button 
              type="button" 
              onClick={deleteField}
              style={{ 
                background: '#ef4444', 
                border: 'none', 
                borderRadius: '4px', 
                color: '#ffffff', 
                padding: '2px 6px', 
                fontSize: '0.7rem', 
                cursor: 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '4px',
                fontWeight: 500
              }}
            >
              <Trash2 size={10} /> Delete
            </button>
            <button 
              type="button" 
              onClick={() => {
                setActiveTooltipIndex(null);
                setActiveTooltipSide(null);
              }}
              style={{ 
                background: 'rgba(255,255,255,0.1)', 
                border: 'none', 
                borderRadius: '4px', 
                color: '#ffffff', 
                padding: '2px 6px', 
                fontSize: '0.7rem', 
                cursor: 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '4px',
                fontWeight: 500
              }}
              title="Close Editor"
            >
              <X size={12} /> Close
            </button>
          </div>
        </div>

        {/* Field Name & Type Row */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Field Name</label>
            <input 
              type="text" 
              value={f.field} 
              onChange={(e) => updateField({ field: e.target.value })}
              style={{ 
                background: '#1e293b', 
                border: '1px solid rgba(255,255,255,0.1)', 
                borderRadius: '4px', 
                color: '#ffffff', 
                padding: '4px 6px', 
                fontSize: '0.75rem' 
              }}
            />
          </div>
          <div style={{ width: '110px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Type</label>
            <select 
              value={f.type} 
              onChange={(e) => {
                const newType = e.target.value as any;
                const updates: Partial<FieldCoordinate> = { type: newType };
                if (newType === 'image') {
                  updates.borderRadius = 0;
                }
                updateField(updates);
              }}
              style={{ 
                background: '#1e293b', 
                border: '1px solid rgba(255,255,255,0.1)', 
                borderRadius: '4px', 
                color: '#ffffff', 
                padding: '4px 6px', 
                fontSize: '0.75rem',
                width: '100%'
              }}
            >
              <option style={{ background: '#1e293b', color: '#ffffff' }} value="text">Text</option>
              <option style={{ background: '#1e293b', color: '#ffffff' }} value="image">Image</option>
              <option style={{ background: '#1e293b', color: '#ffffff' }} value="qr">QR Code</option>
              <option style={{ background: '#1e293b', color: '#ffffff' }} value="barcode">Barcode</option>
              <option style={{ background: '#1e293b', color: '#ffffff' }} value="id">ID/Serial</option>
            </select>
          </div>
        </div>

        {/* Dimensions & Position Row (X, Y, Width, Height) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '0.65rem', color: '#94a3b8' }}>X (px)</label>
            <input 
              type="number" 
              value={Math.round(f.x)} 
              onChange={(e) => updateField({ x: Number(e.target.value) })}
              style={{ 
                background: '#1e293b', 
                border: '1px solid rgba(255,255,255,0.1)', 
                borderRadius: '4px', 
                color: '#ffffff', 
                padding: '4px', 
                fontSize: '0.75rem',
                width: '100%',
                textAlign: 'center'
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Y (px)</label>
            <input 
              type="number" 
              value={Math.round(f.y)} 
              onChange={(e) => updateField({ y: Number(e.target.value) })}
              style={{ 
                background: '#1e293b', 
                border: '1px solid rgba(255,255,255,0.1)', 
                borderRadius: '4px', 
                color: '#ffffff', 
                padding: '4px', 
                fontSize: '0.75rem',
                width: '100%',
                textAlign: 'center'
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '0.65rem', color: '#94a3b8' }}>W (px)</label>
            <input 
              type="number" 
              value={Math.round(f.width)} 
              onChange={(e) => updateField({ width: Number(e.target.value) })}
              style={{ 
                background: '#1e293b', 
                border: '1px solid rgba(255,255,255,0.1)', 
                borderRadius: '4px', 
                color: '#ffffff', 
                padding: '4px', 
                fontSize: '0.75rem',
                width: '100%',
                textAlign: 'center'
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '0.65rem', color: '#94a3b8' }}>H (px)</label>
            <input 
              type="number" 
              value={Math.round(f.height)} 
              onChange={(e) => updateField({ height: Number(e.target.value) })}
              style={{ 
                background: '#1e293b', 
                border: '1px solid rgba(255,255,255,0.1)', 
                borderRadius: '4px', 
                color: '#ffffff', 
                padding: '4px', 
                fontSize: '0.75rem',
                width: '100%',
                textAlign: 'center'
              }}
            />
          </div>
        </div>

        {/* Static Value Toggle & Input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input 
              type="checkbox" 
              id={`static-toggle-${side}-${index}`}
              checked={f.staticValue !== undefined && f.staticValue !== null}
              onChange={(e) => {
                if (e.target.checked) {
                  updateField({ staticValue: f.type === 'image' ? '' : 'Static Text' });
                } else {
                  const updated = { ...f };
                  delete updated.staticValue;
                  const newFields = [...fields];
                  newFields[index] = updated;
                  setFields(newFields);
                }
              }}
              style={{ cursor: 'pointer' }}
            />
            <label htmlFor={`static-toggle-${side}-${index}`} style={{ fontSize: '0.7rem', color: '#e2e8f0', fontWeight: 500, cursor: 'pointer' }}>
              Static / Non-Editable Content
            </label>
          </div>

          {f.staticValue !== undefined && f.staticValue !== null && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {f.type === 'image' ? (
                <>
                  <label style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Static Image Source</label>
                  <input 
                    type="text" 
                    value={f.staticValue} 
                    onChange={(e) => updateField({ staticValue: e.target.value })}
                    placeholder="Paste image URL..."
                    style={{ 
                      background: '#1e293b', 
                      border: '1px solid rgba(255,255,255,0.1)', 
                      borderRadius: '4px', 
                      color: '#ffffff', 
                      padding: '4px 6px', 
                      fontSize: '0.75rem' 
                    }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                    <span style={{ fontSize: '0.65rem', color: '#64748b' }}>Or upload:</span>
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={handleStaticImageUpload}
                      style={{ fontSize: '0.65rem', color: '#94a3b8', width: '150px' }}
                    />
                  </div>
                </>
              ) : (
                <>
                  <label style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Static Text Value</label>
                  <input 
                    type="text" 
                    value={f.staticValue} 
                    onChange={(e) => updateField({ staticValue: e.target.value })}
                    placeholder="Enter static text..."
                    style={{ 
                      background: '#1e293b', 
                      border: '1px solid rgba(255,255,255,0.1)', 
                      borderRadius: '4px', 
                      color: '#ffffff', 
                      padding: '4px 6px', 
                      fontSize: '0.75rem' 
                    }}
                  />
                </>
              )}
            </div>
          )}
        </div>

        {/* Typography Styles (Only for Text / ID) */}
        {isTextLike && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '8px' }}>
            {/* Font Family */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Font Family</label>
              <select
                value={f.fontFamily || 'sans-serif'}
                onChange={(e) => updateField({ fontFamily: e.target.value })}
                style={{ 
                  background: '#1e293b', 
                  border: '1px solid rgba(255,255,255,0.1)', 
                  borderRadius: '4px', 
                  color: '#ffffff', 
                  padding: '4px 6px', 
                  fontSize: '0.75rem',
                  width: '100%'
                }}
              >
                <optgroup label="System Fonts" style={{ background: '#1e293b', color: '#ffffff' }}>
                  <option style={{ background: '#1e293b', color: '#ffffff' }} value="sans-serif">Sans-Serif</option>
                  <option style={{ background: '#1e293b', color: '#ffffff' }} value="serif">Serif</option>
                  <option style={{ background: '#1e293b', color: '#ffffff' }} value="monospace">Monospace</option>
                  <option style={{ background: '#1e293b', color: '#ffffff' }} value="Arial">Arial</option>
                  <option style={{ background: '#1e293b', color: '#ffffff' }} value="Times New Roman">Times New Roman</option>
                  <option style={{ background: '#1e293b', color: '#ffffff' }} value="Courier New">Courier New</option>
                </optgroup>
                {pressFonts && pressFonts.length > 0 && (
                  <optgroup label="Custom Fonts" style={{ background: '#1e293b', color: '#ffffff' }}>
                    {pressFonts.map((pf) => (
                      <option 
                        key={pf.id} 
                        style={{ background: '#1e293b', color: '#ffffff' }} 
                        value={pf.fontFamily}
                      >
                        {pf.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            {/* Font Size & Weight */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Font Size (pt)</label>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => updateField({ fontSize: Math.max(6, (f.fontSize || 18) - 1) })}
                    style={{
                      background: '#334155',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '4px 0 0 4px',
                      color: '#ffffff',
                      width: '24px',
                      height: '24px',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={f.fontSize || 18}
                    onChange={(e) => updateField({ fontSize: Number(e.target.value) })}
                    style={{
                      background: '#1e293b',
                      borderTop: '1px solid rgba(255,255,255,0.1)',
                      borderBottom: '1px solid rgba(255,255,255,0.1)',
                      borderLeft: 'none',
                      borderRight: 'none',
                      color: '#ffffff',
                      width: '36px',
                      height: '24px',
                      textAlign: 'center',
                      fontSize: '0.75rem',
                      MozAppearance: 'textfield'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => updateField({ fontSize: (f.fontSize || 18) + 1 })}
                    style={{
                      background: '#334155',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '0 4px 4px 0',
                      color: '#ffffff',
                      width: '24px',
                      height: '24px',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    +
                  </button>
                </div>
              </div>

              <div style={{ width: '110px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Weight</label>
                <select
                  value={f.fontWeight || 'normal'}
                  onChange={(e) => updateField({ fontWeight: e.target.value as any })}
                  style={{ 
                    background: '#1e293b', 
                    border: '1px solid rgba(255,255,255,0.1)', 
                    borderRadius: '4px', 
                    color: '#ffffff', 
                    padding: '4px 6px', 
                    fontSize: '0.75rem',
                    width: '100%'
                  }}
                >
                  <option style={{ background: '#1e293b', color: '#ffffff' }} value="normal">Normal</option>
                  <option style={{ background: '#1e293b', color: '#ffffff' }} value="bold">Bold</option>
                  <option style={{ background: '#1e293b', color: '#ffffff' }} value="300">Light</option>
                  <option style={{ background: '#1e293b', color: '#ffffff' }} value="500">Medium</option>
                  <option style={{ background: '#1e293b', color: '#ffffff' }} value="600">Semi-Bold</option>
                </select>
              </div>
            </div>

            {/* Alignment & Color */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Color</label>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <input
                    type="color"
                    value={f.color || '#000000'}
                    onChange={(e) => updateField({ color: e.target.value })}
                    style={{
                      width: '28px',
                      height: '24px',
                      border: 'none',
                      padding: 0,
                      background: 'transparent',
                      cursor: 'pointer'
                    }}
                  />
                  <input
                    type="text"
                    value={f.color || '#000000'}
                    onChange={(e) => updateField({ color: e.target.value })}
                    style={{
                      background: '#1e293b',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '4px',
                      color: '#ffffff',
                      padding: '3px 6px',
                      fontSize: '0.7rem',
                      width: '60px',
                      textTransform: 'uppercase'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.65rem', color: '#94a3b8' }}>H Align</label>
                <div style={{ display: 'flex', background: '#1e293b', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', padding: '2px' }}>
                  <button
                    type="button"
                    onClick={() => updateField({ align: 'left' })}
                    style={{
                      background: f.align === 'left' || !f.align ? '#3b82f6' : 'transparent',
                      border: 'none',
                      borderRadius: '2px',
                      color: '#ffffff',
                      padding: '2px 6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <AlignLeft size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField({ align: 'center' })}
                    style={{
                      background: f.align === 'center' ? '#3b82f6' : 'transparent',
                      border: 'none',
                      borderRadius: '2px',
                      color: '#ffffff',
                      padding: '2px 6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <AlignCenter size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField({ align: 'right' })}
                    style={{
                      background: f.align === 'right' ? '#3b82f6' : 'transparent',
                      border: 'none',
                      borderRadius: '2px',
                      color: '#ffffff',
                      padding: '2px 6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <AlignRight size={12} />
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.65rem', color: '#94a3b8' }}>V Align</label>
                <div style={{ display: 'flex', background: '#1e293b', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', padding: '2px' }}>
                  <button
                    type="button"
                    onClick={() => updateField({ verticalAlign: 'top' })}
                    style={{
                      background: f.verticalAlign === 'top' || !f.verticalAlign ? '#3b82f6' : 'transparent',
                      border: 'none',
                      borderRadius: '2px',
                      color: '#ffffff',
                      padding: '2px 6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    title="Align Top"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="3" y1="3" x2="21" y2="3" />
                      <rect x="6" y="8" width="12" height="13" rx="2" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField({ verticalAlign: 'center' })}
                    style={{
                      background: f.verticalAlign === 'center' ? '#3b82f6' : 'transparent',
                      border: 'none',
                      borderRadius: '2px',
                      color: '#ffffff',
                      padding: '2px 6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    title="Align Center"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="3" y1="12" x2="21" y2="12" />
                      <rect x="6" y="5" width="12" height="4" rx="1" />
                      <rect x="6" y="15" width="12" height="4" rx="1" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField({ verticalAlign: 'bottom' })}
                    style={{
                      background: f.verticalAlign === 'bottom' ? '#3b82f6' : 'transparent',
                      border: 'none',
                      borderRadius: '2px',
                      color: '#ffffff',
                      padding: '2px 6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    title="Align Bottom"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="3" y1="21" x2="21" y2="21" />
                      <rect x="6" y="3" width="12" height="13" rx="2" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Text Style Toggles */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div style={{ display: 'flex', background: '#1e293b', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', padding: '2px', width: '100%', justifyContent: 'space-around' }}>
                <button
                  type="button"
                  onClick={() => updateField({ fontStyle: f.fontStyle === 'italic' ? 'normal' : 'italic' })}
                  style={{
                    background: f.fontStyle === 'italic' ? '#3b82f6' : 'transparent',
                    border: 'none',
                    borderRadius: '4px',
                    color: '#ffffff',
                    padding: '4px 8px',
                    cursor: 'pointer',
                    fontSize: '0.7rem',
                    fontWeight: 'italic',
                    flex: 1,
                    textAlign: 'center'
                  }}
                >
                  Italic
                </button>
                <button
                  type="button"
                  onClick={() => updateField({ textDecoration: f.textDecoration === 'underline' ? 'none' : 'underline' })}
                  style={{
                    background: f.textDecoration === 'underline' ? '#3b82f6' : 'transparent',
                    border: 'none',
                    borderRadius: '4px',
                    color: '#ffffff',
                    padding: '4px 8px',
                    cursor: 'pointer',
                    fontSize: '0.7rem',
                    textDecoration: 'underline',
                    flex: 1,
                    textAlign: 'center'
                  }}
                >
                  Underline
                </button>
                <button
                  type="button"
                  onClick={() => updateField({ textTransform: f.textTransform === 'uppercase' ? 'none' : 'uppercase' })}
                  style={{
                    background: f.textTransform === 'uppercase' ? '#3b82f6' : 'transparent',
                    border: 'none',
                    borderRadius: '4px',
                    color: '#ffffff',
                    padding: '4px 8px',
                    cursor: 'pointer',
                    fontSize: '0.7rem',
                    flex: 1,
                    textAlign: 'center'
                  }}
                >
                  Uppercase
                </button>
              </div>
            </div>

            {/* Prefix/Suffix */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Prefix</label>
                <input 
                  type="text" 
                  value={f.prefix || ''} 
                  onChange={(e) => updateField({ prefix: e.target.value })}
                  placeholder="e.g. Roll No: "
                  style={{ 
                    background: '#1e293b', 
                    border: '1px solid rgba(255,255,255,0.1)', 
                    borderRadius: '4px', 
                    color: '#ffffff', 
                    padding: '4px 6px', 
                    fontSize: '0.75rem' 
                  }}
                />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Suffix</label>
                <input 
                  type="text" 
                  value={f.suffix || ''} 
                  onChange={(e) => updateField({ suffix: e.target.value })}
                  placeholder="e.g. /-"
                  style={{ 
                    background: '#1e293b', 
                    border: '1px solid rgba(255,255,255,0.1)', 
                    borderRadius: '4px', 
                    color: '#ffffff', 
                    padding: '4px 6px', 
                    fontSize: '0.75rem' 
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Image Corner Radius (Only for Image) */}
        {f.type === 'image' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '8px' }}>
            <label style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Corner Radius (px)</label>
            <input 
              type="number" 
              value={f.borderRadius || 0} 
              onChange={(e) => updateField({ borderRadius: Number(e.target.value) })}
              style={{ 
                background: '#1e293b', 
                border: '1px solid rgba(255,255,255,0.1)', 
                borderRadius: '4px', 
                color: '#ffffff', 
                padding: '4px 6px', 
                fontSize: '0.75rem' 
              }}
            />
          </div>
        )}
      </div>
    );
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
          frontOriginalUrl: frontOriginalUrl || null,
          backOriginalUrl: backOriginalUrl || null,
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
      setCardWidth(673);
      setCardHeight(1039);
      setFrontImageUrl('');
      setBackImageUrl('');
      setFrontOriginalUrl('');
      setBackOriginalUrl('');
      setFrontLocalPath('');
      setBackLocalPath('');
      setFrontWebUrl('');
      setBackWebUrl('');
      setFrontFields([]);
      setBackFields([]);
      setShowForm(false);
      setEditingTemplateId(null);
      setTestData({});
      setActiveTooltipIndex(null);
      setActiveTooltipSide(null);
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
    setFrontOriginalUrl(tmpl.frontOriginalUrl || '');
    setBackOriginalUrl(tmpl.backOriginalUrl || '');
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

  const currentTemplates = viewTab === 'my' ? templates : globalTemplates;

  // Pre-calculate designer Y offsets for front and back sides
  const getDesignerYOffsets = (fields: FieldCoordinate[]) => {
    if (typeof window === 'undefined') return new Map<number, number>();

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return new Map<number, number>();

    const getValueStr = (f: FieldCoordinate) => {
      if (f.staticValue !== undefined && f.staticValue !== null) {
        return `${f.prefix || ''}${f.staticValue}${f.suffix || ''}`;
      }
      if (showTestData) {
        const customVal = testData[f.field];
        const val = (customVal !== undefined && customVal !== '') ? customVal : getFieldDefaultValue(f.field, f.type);
        return `${f.prefix || ''}${val}${f.suffix || ''}`;
      }
      return f.field;
    };

    const measureFn = (f: FieldCoordinate, s: string) => {
      let fontName = 'sans-serif';
      if (f.fontFamily && f.fontFamily !== 'sans-serif') {
        const matchingFont = pressFonts.find(pf => pf.name.toLowerCase() === f.fontFamily?.toLowerCase());
        if (matchingFont) {
          fontName = matchingFont.name.replace(/\s+/g, '_');
        } else {
          fontName = f.fontFamily;
        }
      }
      const fontStyle = f.fontStyle && f.fontStyle !== 'normal' ? f.fontStyle : 'normal';
      const fontWeight = f.fontWeight && f.fontWeight !== 'normal' ? f.fontWeight : 'normal';
      ctx.font = `${fontStyle} ${fontWeight} ${f.fontSize || 20}px "${fontName}"`;

      const spacing = f.letterSpacing || 0;
      if (!spacing) return ctx.measureText(s).width;

      let totalWidth = 0;
      for (let ci = 0; ci < s.length; ci++) {
        totalWidth += ctx.measureText(s[ci]).width;
        if (ci < s.length - 1) totalWidth += spacing;
      }
      return totalWidth;
    };

    return computeYOffsets(fields as any, measureFn as any, getValueStr as any);
  };

  const frontYOffsets = getDesignerYOffsets(frontFields);
  const backYOffsets = getDesignerYOffsets(backFields);

  const getFieldSelfOverflow = (f: FieldCoordinate) => {
    if (typeof window === 'undefined') return 0;
    if (f.type !== 'text' && f.type !== 'id') return 0;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return 0;

    const getValueStr = (f: FieldCoordinate) => {
      if (f.staticValue !== undefined && f.staticValue !== null) {
        return `${f.prefix || ''}${f.staticValue}${f.suffix || ''}`;
      }
      if (showTestData) {
        const customVal = testData[f.field];
        const val = (customVal !== undefined && customVal !== '') ? customVal : getFieldDefaultValue(f.field, f.type);
        return `${f.prefix || ''}${val}${f.suffix || ''}`;
      }
      return f.field;
    };

    let fontName = 'sans-serif';
    if (f.fontFamily && f.fontFamily !== 'sans-serif') {
      const matchingFont = pressFonts.find(pf => pf.name.toLowerCase() === f.fontFamily?.toLowerCase());
      if (matchingFont) {
        fontName = matchingFont.name.replace(/\s+/g, '_');
      } else {
        fontName = f.fontFamily;
      }
    }
    const fontStyle = f.fontStyle && f.fontStyle !== 'normal' ? f.fontStyle : 'normal';
    const fontWeight = f.fontWeight && f.fontWeight !== 'normal' ? f.fontWeight : 'normal';
    ctx.font = `${fontStyle} ${fontWeight} ${f.fontSize || 20}px "${fontName}"`;

    const measureWidth = (s: string) => {
      const spacing = f.letterSpacing || 0;
      if (!spacing) return ctx.measureText(s).width;
      let totalWidth = 0;
      for (let ci = 0; ci < s.length; ci++) {
        totalWidth += ctx.measureText(s[ci]).width;
        if (ci < s.length - 1) totalWidth += spacing;
      }
      return totalWidth;
    };

    const valueStr = getValueStr(f);
    const lines = wrapWords(valueStr, f.width, measureWidth);
    const lineHeight = (f.fontSize || 20) * (f.lineHeight ?? 1.2);
    const renderedHeight = lines.length * lineHeight;
    return Math.max(0, renderedHeight - f.height);
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
              setCardWidth(673);
              setCardHeight(1039);
              setFrontImageUrl('');
              setBackImageUrl('');
              setFrontFields([]);
              setBackFields([]);
              setTestData({});
              setActiveTooltipIndex(null);
              setActiveTooltipSide(null);
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
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
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
                    <button
                      type="button"
                      onClick={() => {
                        const temp = cardWidth;
                        setCardWidth(cardHeight);
                        setCardHeight(temp);
                      }}
                      className="btn btn-secondary"
                      style={{
                        padding: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '42px',
                        borderRadius: '8px',
                        border: '1px solid var(--glass-border)',
                        background: 'rgba(255,255,255,0.05)',
                        cursor: 'pointer',
                        flexShrink: 0
                      }}
                      title="Swap orientation (Landscape / Portrait)"
                    >
                      <RefreshCw size={16} />
                    </button>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {/* Grid Toggle */}
                    <label style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px', 
                      fontSize: '0.8rem', 
                      cursor: 'pointer', 
                      background: showGrid ? 'rgba(20, 184, 166, 0.15)' : 'rgba(255,255,255,0.05)', 
                      padding: '6px 12px', 
                      borderRadius: '8px', 
                      border: showGrid ? '1px solid rgba(20,184,166,0.7)' : '1px solid var(--glass-border)',
                      transition: 'all 0.2s',
                      userSelect: 'none',
                      fontWeight: 500,
                    }}>
                      <input 
                        type="checkbox" 
                        checked={showGrid} 
                        onChange={e => setShowGrid(e.target.checked)} 
                        style={{ cursor: 'pointer', margin: 0 }}
                      />
                      <Grid3x3 size={13} />
                      <span>Grid</span>
                    </label>
                    {/* Grid Size Selector — only visible when grid is on */}
                    {showGrid && (
                      <select
                        value={gridSize}
                        onChange={e => setGridSize(Number(e.target.value))}
                        className="form-input"
                        style={{ padding: '5px 8px', fontSize: '0.75rem', width: 'auto', minWidth: '90px' }}
                        title="Grid cell size (pixels in canvas space)"
                      >
                        <option value={10}>10 px fine</option>
                        <option value={20}>20 px medium</option>
                        <option value={50}>50 px coarse</option>
                        <option value={100}>100 px macro</option>
                      </select>
                    )}

                    {/* Snap to Grid */}
                    <label style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px', 
                      fontSize: '0.8rem', 
                      cursor: 'pointer', 
                      background: snapToGrid ? 'rgba(20, 184, 166, 0.15)' : 'rgba(255,255,255,0.05)', 
                      padding: '6px 12px', 
                      borderRadius: '8px', 
                      border: snapToGrid ? '1px solid rgba(20,184,166,0.7)' : '1px solid var(--glass-border)',
                      transition: 'all 0.2s',
                      userSelect: 'none',
                      fontWeight: 500,
                    }} title="Snap fields to grid intersections when dragging or resizing">
                      <input 
                        type="checkbox" 
                        checked={snapToGrid} 
                        onChange={e => setSnapToGrid(e.target.checked)} 
                        style={{ cursor: 'pointer', margin: 0 }}
                      />
                      <span>Snap to Grid</span>
                    </label>

                    {/* Snap to Guides */}
                    <label style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px', 
                      fontSize: '0.8rem', 
                      cursor: 'pointer', 
                      background: snapToGuides ? 'rgba(20, 184, 166, 0.15)' : 'rgba(255,255,255,0.05)', 
                      padding: '6px 12px', 
                      borderRadius: '8px', 
                      border: snapToGuides ? '1px solid rgba(20,184,166,0.7)' : '1px solid var(--glass-border)',
                      transition: 'all 0.2s',
                      userSelect: 'none',
                      fontWeight: 500,
                    }} title="Snap fields to custom guidelines when dragging or resizing">
                      <input 
                        type="checkbox" 
                        checked={snapToGuides} 
                        onChange={e => setSnapToGuides(e.target.checked)} 
                        style={{ cursor: 'pointer', margin: 0 }}
                      />
                      <span>Snap to Guides</span>
                    </label>

                    <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: '6px' }}>
                      💡 Drag from rulers to place custom guides.
                    </span>

                    {/* Bleed & Safe Area Guide Toggle */}
                    <label style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px', 
                      fontSize: '0.8rem', 
                      cursor: 'pointer', 
                      background: showBleedGuides ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)', 
                      padding: '6px 12px', 
                      borderRadius: '8px', 
                      border: showBleedGuides ? '1px solid rgba(239,68,68,0.7)' : '1px solid var(--glass-border)',
                      transition: 'all 0.2s',
                      userSelect: 'none',
                      fontWeight: 500,
                    }} title="Show bleed (red) and safe area (yellow) guides for professional print. Keep critical content inside the yellow line.">
                      <input 
                        type="checkbox" 
                        checked={showBleedGuides} 
                        onChange={e => setShowBleedGuides(e.target.checked)} 
                        style={{ cursor: 'pointer', margin: 0 }}
                      />
                      <span>🖨 Bleed Guides</span>
                    </label>
                    {/* Test Data Toggle */}
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
                          <div style={{ position: 'relative', paddingLeft: '20px', paddingTop: '20px', background: '#1e293b', borderRadius: '10px', paddingRight: '6px', paddingBottom: '6px', border: '1px solid rgba(255,255,255,0.08)' }}>
                            {/* Rulers */}
                            {renderRuler('front', 'horizontal')}
                            {renderRuler('front', 'vertical')}
                            <div style={{ position: 'absolute', left: 0, top: 0, width: '20px', height: '20px', background: '#0f172a', borderRight: '1px solid #334155', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '6px', color: '#475569', fontWeight: 'bold' }}>px</div>

                            <div 
                              id="designer-canvas-front"
                              onMouseDown={(e) => handleEditorMouseDown(e, 'front')}
                              style={{
                                width: `${editorWidth}px`,
                                height: `${editorHeight}px`,
                                backgroundImage: `url(${getOptimizedImageUrl(frontImageUrl)})`,
                                backgroundSize: '100% 100%',
                                backgroundPosition: 'center',
                                position: 'relative',
                                overflow: 'visible',
                                cursor: 'crosshair',
                                boxShadow: '0 8px 30px rgba(0,0,0,0.5)'
                              }}
                            >
                              {/* Grid Overlay */}
                              {showGrid && (() => {
                                const scaledStep = gridSize * scale;
                                const cols = Math.floor(editorWidth / scaledStep);
                                const rows = Math.floor(editorHeight / scaledStep);
                                return (
                                  <svg
                                    style={{
                                      position: 'absolute',
                                      inset: 0,
                                      width: '100%',
                                      height: '100%',
                                      pointerEvents: 'none',
                                      zIndex: 150,
                                    }}
                                    xmlns="http://www.w3.org/2000/svg"
                                  >
                                    {/* Vertical lines */}
                                    {Array.from({ length: cols - 1 }, (_, ci) => {
                                      const isMajor = (ci + 1) % 5 === 0;
                                      return (
                                        <line
                                          key={`fv${ci}`}
                                          x1={(ci + 1) * scaledStep}
                                          y1={0}
                                          x2={(ci + 1) * scaledStep}
                                          y2={editorHeight}
                                          stroke={isMajor ? "rgba(20, 184, 166, 0.45)" : "rgba(20, 184, 166, 0.18)"}
                                          strokeWidth={isMajor ? "1" : "0.75"}
                                          strokeDasharray={isMajor ? "none" : "2,2"}
                                        />
                                      );
                                    })}
                                    {/* Horizontal lines */}
                                    {Array.from({ length: rows - 1 }, (_, ri) => {
                                      const isMajor = (ri + 1) % 5 === 0;
                                      return (
                                        <line
                                          key={`fh${ri}`}
                                          x1={0}
                                          y1={(ri + 1) * scaledStep}
                                          x2={editorWidth}
                                          y2={(ri + 1) * scaledStep}
                                          stroke={isMajor ? "rgba(20, 184, 166, 0.45)" : "rgba(20, 184, 166, 0.18)"}
                                          strokeWidth={isMajor ? "1" : "0.75"}
                                          strokeDasharray={isMajor ? "none" : "2,2"}
                                        />
                                      );
                                    })}
                                  </svg>
                                );
                              })()}

                              {/* Bleed & Safe Area Overlay */}
                              {showBleedGuides && (() => {
                                const bleedPx = BLEED_PX * scale;
                                const safePx = SAFE_PX * scale;
                                return (
                                  <svg
                                    style={{
                                      position: 'absolute',
                                      inset: 0,
                                      width: '100%',
                                      height: '100%',
                                      pointerEvents: 'none',
                                      zIndex: 155,
                                      overflow: 'visible',
                                    }}
                                    xmlns="http://www.w3.org/2000/svg"
                                  >
                                    {/* Bleed border — outermost red dashed line */}
                                    <rect
                                      x={bleedPx} y={bleedPx}
                                      width={editorWidth - bleedPx * 2} height={editorHeight - bleedPx * 2}
                                      fill="none"
                                      stroke="rgba(239,68,68,0.85)"
                                      strokeWidth="1.5"
                                      strokeDasharray="6,3"
                                    />
                                    {/* Safe area border — inner yellow dashed line */}
                                    <rect
                                      x={safePx} y={safePx}
                                      width={editorWidth - safePx * 2} height={editorHeight - safePx * 2}
                                      fill="none"
                                      stroke="rgba(234,179,8,0.85)"
                                      strokeWidth="1.5"
                                      strokeDasharray="6,3"
                                    />
                                    {/* Labels */}
                                    <text x={bleedPx + 3} y={bleedPx - 3} fill="rgba(239,68,68,0.9)" fontSize="9" fontWeight="600">Bleed (1.5mm)</text>
                                    <text x={safePx + 3} y={safePx + 11} fill="rgba(234,179,8,0.9)" fontSize="9" fontWeight="600">Safe Area (3mm)</text>
                                  </svg>
                                );
                              })()}

                              {/* Photoshop-style Draggable Guidelines */}
                              {frontGuides.map((g) => {
                                const isHoriz = g.type === 'horizontal';
                                const pos = g.value * scale;
                                return (
                                  <div
                                    key={g.id}
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setActiveGuideDrag({ id: g.id, side: 'front', type: g.type });
                                    }}
                                    style={{
                                      position: 'absolute',
                                      left: isHoriz ? '0' : `${pos}px`,
                                      top: isHoriz ? `${pos}px` : '0',
                                      width: isHoriz ? '100%' : '2px',
                                      height: isHoriz ? '2px' : '100%',
                                      cursor: isHoriz ? 'ns-resize' : 'ew-resize',
                                      borderTop: isHoriz ? '1.5px dashed #06b6d4' : 'none',
                                      borderLeft: !isHoriz ? '1.5px dashed #06b6d4' : 'none',
                                      zIndex: 350,
                                      padding: isHoriz ? '4px 0' : '0 4px',
                                      margin: isHoriz ? '-4px 0 0 0' : '0 0 0 -4px',
                                      background: 'transparent'
                                    }}
                                    title="Drag to move, drag off canvas/ruler to delete"
                                  />
                                );
                              })}
                            {frontFields.map((f, i) => {
                              const x = f.x * scale;
                              const yOffset = frontYOffsets.get(i) ?? 0;
                              const y = (f.y + yOffset) * scale;
                              const w = f.width * scale;
                              const selfOverflow = getFieldSelfOverflow(f);
                              const h = (f.height + selfOverflow) * scale;
                              const isSelected = selectedFieldIndex === i && selectedSide === 'front';
                              const style = getBoxStyle(f, isSelected, scale);

                              const isTextLike = f.type === 'text' || f.type === 'id';
                              const testDataStyle: React.CSSProperties = (showTestData && isTextLike) ? {
                                fontSize: `${(f.fontSize || 18) * scale}px`,
                                color: f.color || '#000000',
                                fontFamily: getFontFamily(f.fontFamily),
                                fontWeight: f.fontWeight || 'normal',
                                fontStyle: f.fontStyle || 'normal',
                                textAlign: f.align || 'left',
                                justifyContent: f.align === 'center' ? 'center' : (f.align === 'right' ? 'flex-end' : 'flex-start'),
                                 alignItems: f.verticalAlign === 'center' ? 'center' : (f.verticalAlign === 'bottom' ? 'flex-end' : 'flex-start'),
                                padding: '0 4px',
                                textShadow: 'none',
                                overflow: 'hidden',
                                whiteSpace: 'pre-wrap',
                                letterSpacing: f.letterSpacing ? `${f.letterSpacing * scale}px` : undefined,
                                lineHeight: f.lineHeight ? f.lineHeight : undefined,
                                textDecoration: f.textDecoration ? f.textDecoration : undefined,
                                textTransform: f.textTransform ? f.textTransform as any : undefined,
                                opacity: f.opacity != null ? f.opacity : undefined,
                              } : {};

                              return (
                                <React.Fragment key={i}>
                                  <div
                                    onMouseDown={(e) => handleMouseDown(e, 'front', i, 'move', scale)}
                                    style={{
                                      position: 'absolute',
                                      left: `${x}px`,
                                      top: `${y}px`,
                                      width: `${w}px`,
                                      height: `${h}px`,
                                      cursor: 'move',
                                      display: 'flex',
                                      alignItems: f.verticalAlign === 'center' ? 'center' : (f.verticalAlign === 'bottom' ? 'flex-end' : 'flex-start'),
                                      justifyContent: f.align === 'center' ? 'center' : (f.align === 'right' ? 'flex-end' : 'flex-start'),
                                      fontSize: '0.65rem',
                                      color: '#ffffff',
                                      textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                                      userSelect: 'none',
                                      textAlign: f.align || 'center',
                                      wordBreak: 'break-all',
                                      ...style,
                                      ...testDataStyle
                                    }}
                                  >
                                    {f.staticValue !== undefined && f.staticValue !== null ? (
                                      f.type === 'image' ? (
                                        <img 
                                          src={f.staticValue || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=200&fit=crop"} 
                                          alt="Static Image"
                                          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: f.borderRadius ? `${f.borderRadius * scale}px` : '0px' }}
                                          draggable={false}
                                        />
                                      ) : (
                                        `${f.prefix || ''}${f.staticValue}${f.suffix || ''}`
                                      )
                                    ) : showTestData ? (
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
                                  {/* Tooltip Toggle Button on Top Right (Outside) */}
                                  {(() => {
                                    const isTooltipActive = activeTooltipIndex === i && activeTooltipSide === 'front';
                                    return (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (isTooltipActive) {
                                            setActiveTooltipIndex(null);
                                            setActiveTooltipSide(null);
                                          } else {
                                            setActiveTooltipIndex(i);
                                            setActiveTooltipSide('front');
                                            setSelectedFieldIndex(i);
                                            setSelectedSide('front');
                                          }
                                        }}
                                        onMouseDown={(e) => e.stopPropagation()}
                                        style={{
                                          position: 'absolute',
                                          left: `${x + w}px`,
                                          top: `${y}px`,
                                          transform: 'translate(-50%, -50%)',
                                          width: '18px',
                                          height: '18px',
                                          borderRadius: '50%',
                                          background: isTooltipActive ? '#ef4444' : '#3b82f6',
                                          border: '1px solid rgba(255,255,255,0.3)',
                                          color: '#ffffff',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          cursor: 'pointer',
                                          padding: 0,
                                          boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
                                          zIndex: isTooltipActive ? 10001 : 500,
                                        }}
                                        title={isTooltipActive ? "Close Editor" : "Open Editor"}
                                      >
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                          {isTooltipActive ? (
                                            <>
                                              <line x1="18" y1="6" x2="6" y2="18"></line>
                                              <line x1="6" y1="6" x2="18" y2="18"></line>
                                            </>
                                          ) : (
                                            <>
                                              <path d="M12 20h9"></path>
                                              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                                            </>
                                          )}
                                        </svg>
                                      </button>
                                    );
                                  })()}
                                  {activeTooltipIndex === i && activeTooltipSide === 'front' && renderFieldTooltip('front', i, f, scale)}
                                </React.Fragment>
                              );
                            })}
                            </div>
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
                          <div style={{ position: 'relative', paddingLeft: '20px', paddingTop: '20px', background: '#1e293b', borderRadius: '10px', paddingRight: '6px', paddingBottom: '6px', border: '1px solid rgba(255,255,255,0.08)' }}>
                            {/* Rulers */}
                            {renderRuler('back', 'horizontal')}
                            {renderRuler('back', 'vertical')}
                            <div style={{ position: 'absolute', left: 0, top: 0, width: '20px', height: '20px', background: '#0f172a', borderRight: '1px solid #334155', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '6px', color: '#475569', fontWeight: 'bold' }}>px</div>

                            <div 
                              id="designer-canvas-back"
                              onMouseDown={(e) => handleEditorMouseDown(e, 'back')}
                              style={{
                                width: `${editorWidth}px`,
                                height: `${editorHeight}px`,
                                backgroundImage: `url(${getOptimizedImageUrl(backImageUrl)})`,
                                backgroundSize: '100% 100%',
                                backgroundPosition: 'center',
                                position: 'relative',
                                overflow: 'visible',
                                cursor: 'crosshair',
                                boxShadow: '0 8px 30px rgba(0,0,0,0.5)'
                              }}
                            >
                              {/* Grid Overlay */}
                              {showGrid && (() => {
                                const scaledStep = gridSize * scale;
                                const cols = Math.floor(editorWidth / scaledStep);
                                const rows = Math.floor(editorHeight / scaledStep);
                                return (
                                  <svg
                                    style={{
                                      position: 'absolute',
                                      inset: 0,
                                      width: '100%',
                                      height: '100%',
                                      pointerEvents: 'none',
                                      zIndex: 150,
                                    }}
                                    xmlns="http://www.w3.org/2000/svg"
                                  >
                                    {/* Vertical lines */}
                                    {Array.from({ length: cols - 1 }, (_, ci) => {
                                      const isMajor = (ci + 1) % 5 === 0;
                                      return (
                                        <line
                                          key={`bv${ci}`}
                                          x1={(ci + 1) * scaledStep}
                                          y1={0}
                                          x2={(ci + 1) * scaledStep}
                                          y2={editorHeight}
                                          stroke={isMajor ? "rgba(20, 184, 166, 0.45)" : "rgba(20, 184, 166, 0.18)"}
                                          strokeWidth={isMajor ? "1" : "0.75"}
                                          strokeDasharray={isMajor ? "none" : "2,2"}
                                        />
                                      );
                                    })}
                                    {/* Horizontal lines */}
                                    {Array.from({ length: rows - 1 }, (_, ri) => {
                                      const isMajor = (ri + 1) % 5 === 0;
                                      return (
                                        <line
                                          key={`bh${ri}`}
                                          x1={0}
                                          y1={(ri + 1) * scaledStep}
                                          x2={editorWidth}
                                          y2={(ri + 1) * scaledStep}
                                          stroke={isMajor ? "rgba(20, 184, 166, 0.45)" : "rgba(20, 184, 166, 0.18)"}
                                          strokeWidth={isMajor ? "1" : "0.75"}
                                          strokeDasharray={isMajor ? "none" : "2,2"}
                                        />
                                      );
                                    })}
                                  </svg>
                                );
                              })()}

                              {/* Bleed & Safe Area Overlay — Back Side */}
                              {showBleedGuides && (() => {
                                const bleedPx = BLEED_PX * scale;
                                const safePx = SAFE_PX * scale;
                                return (
                                  <svg
                                    style={{
                                      position: 'absolute',
                                      inset: 0,
                                      width: '100%',
                                      height: '100%',
                                      pointerEvents: 'none',
                                      zIndex: 155,
                                      overflow: 'visible',
                                    }}
                                    xmlns="http://www.w3.org/2000/svg"
                                  >
                                    <rect
                                      x={bleedPx} y={bleedPx}
                                      width={editorWidth - bleedPx * 2} height={editorHeight - bleedPx * 2}
                                      fill="none"
                                      stroke="rgba(239,68,68,0.85)"
                                      strokeWidth="1.5"
                                      strokeDasharray="6,3"
                                    />
                                    <rect
                                      x={safePx} y={safePx}
                                      width={editorWidth - safePx * 2} height={editorHeight - safePx * 2}
                                      fill="none"
                                      stroke="rgba(234,179,8,0.85)"
                                      strokeWidth="1.5"
                                      strokeDasharray="6,3"
                                    />
                                    <text x={bleedPx + 3} y={bleedPx - 3} fill="rgba(239,68,68,0.9)" fontSize="9" fontWeight="600">Bleed (1.5mm)</text>
                                    <text x={safePx + 3} y={safePx + 11} fill="rgba(234,179,8,0.9)" fontSize="9" fontWeight="600">Safe Area (3mm)</text>
                                  </svg>
                                );
                              })()}

                              {/* Photoshop-style Draggable Guidelines */}
                              {backGuides.map((g) => {
                                const isHoriz = g.type === 'horizontal';
                                const pos = g.value * scale;
                                return (
                                  <div
                                    key={g.id}
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setActiveGuideDrag({ id: g.id, side: 'back', type: g.type });
                                    }}
                                    style={{
                                      position: 'absolute',
                                      left: isHoriz ? '0' : `${pos}px`,
                                      top: isHoriz ? `${pos}px` : '0',
                                      width: isHoriz ? '100%' : '2px',
                                      height: isHoriz ? '2px' : '100%',
                                      cursor: isHoriz ? 'ns-resize' : 'ew-resize',
                                      borderTop: isHoriz ? '1.5px dashed #06b6d4' : 'none',
                                      borderLeft: !isHoriz ? '1.5px dashed #06b6d4' : 'none',
                                      zIndex: 350,
                                      padding: isHoriz ? '4px 0' : '0 4px',
                                      margin: isHoriz ? '-4px 0 0 0' : '0 0 0 -4px',
                                      background: 'transparent'
                                    }}
                                    title="Drag to move, drag off canvas/ruler to delete"
                                  />
                                );
                              })}
                            {backFields.map((f, i) => {
                              const x = f.x * scale;
                              const yOffset = backYOffsets.get(i) ?? 0;
                              const y = (f.y + yOffset) * scale;
                              const w = f.width * scale;
                              const selfOverflow = getFieldSelfOverflow(f);
                              const h = (f.height + selfOverflow) * scale;
                              const isSelected = selectedFieldIndex === i && selectedSide === 'back';
                              const style = getBoxStyle(f, isSelected, scale);

                              const isTextLike = f.type === 'text' || f.type === 'id';
                              const testDataStyle: React.CSSProperties = (showTestData && isTextLike) ? {
                                fontSize: `${(f.fontSize || 18) * scale}px`,
                                color: f.color || '#000000',
                                fontFamily: getFontFamily(f.fontFamily),
                                fontWeight: f.fontWeight || 'normal',
                                fontStyle: f.fontStyle || 'normal',
                                textAlign: f.align || 'left',
                                justifyContent: f.align === 'center' ? 'center' : (f.align === 'right' ? 'flex-end' : 'flex-start'),
                                 alignItems: f.verticalAlign === 'center' ? 'center' : (f.verticalAlign === 'bottom' ? 'flex-end' : 'flex-start'),
                                padding: '0 4px',
                                textShadow: 'none',
                                overflow: 'hidden',
                                whiteSpace: 'pre-wrap',
                                letterSpacing: f.letterSpacing ? `${f.letterSpacing * scale}px` : undefined,
                                lineHeight: f.lineHeight ? f.lineHeight : undefined,
                                textDecoration: f.textDecoration ? f.textDecoration : undefined,
                                textTransform: f.textTransform ? f.textTransform as any : undefined,
                                opacity: f.opacity != null ? f.opacity : undefined,
                              } : {};

                              return (
                                <React.Fragment key={i}>
                                  <div
                                    onMouseDown={(e) => handleMouseDown(e, 'back', i, 'move', scale)}
                                    style={{
                                      position: 'absolute',
                                      left: `${x}px`,
                                      top: `${y}px`,
                                      width: `${w}px`,
                                      height: `${h}px`,
                                      cursor: 'move',
                                      display: 'flex',
                                      alignItems: f.verticalAlign === 'center' ? 'center' : (f.verticalAlign === 'bottom' ? 'flex-end' : 'flex-start'),
                                      justifyContent: f.align === 'center' ? 'center' : (f.align === 'right' ? 'flex-end' : 'flex-start'),
                                      fontSize: '0.65rem',
                                      color: '#ffffff',
                                      textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                                      userSelect: 'none',
                                      textAlign: f.align || 'center',
                                      wordBreak: 'break-all',
                                      ...style,
                                      ...testDataStyle
                                    }}
                                  >
                                    {f.staticValue !== undefined && f.staticValue !== null ? (
                                      f.type === 'image' ? (
                                        <img 
                                          src={f.staticValue || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=200&fit=crop"} 
                                          alt="Static Image"
                                          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: f.borderRadius ? `${f.borderRadius * scale}px` : '0px' }}
                                          draggable={false}
                                        />
                                      ) : (
                                        `${f.prefix || ''}${f.staticValue}${f.suffix || ''}`
                                      )
                                    ) : showTestData ? (
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
                                  {/* Tooltip Toggle Button on Top Right (Outside) */}
                                  {(() => {
                                    const isTooltipActive = activeTooltipIndex === i && activeTooltipSide === 'back';
                                    return (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (isTooltipActive) {
                                            setActiveTooltipIndex(null);
                                            setActiveTooltipSide(null);
                                          } else {
                                            setActiveTooltipIndex(i);
                                            setActiveTooltipSide('back');
                                            setSelectedFieldIndex(i);
                                            setSelectedSide('back');
                                          }
                                        }}
                                        onMouseDown={(e) => e.stopPropagation()}
                                        style={{
                                          position: 'absolute',
                                          left: `${x + w}px`,
                                          top: `${y}px`,
                                          transform: 'translate(-50%, -50%)',
                                          width: '18px',
                                          height: '18px',
                                          borderRadius: '50%',
                                          background: isTooltipActive ? '#ef4444' : '#3b82f6',
                                          border: '1px solid rgba(255,255,255,0.3)',
                                          color: '#ffffff',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          cursor: 'pointer',
                                          padding: 0,
                                          boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
                                          zIndex: isTooltipActive ? 10001 : 500,
                                        }}
                                        title={isTooltipActive ? "Close Editor" : "Open Editor"}
                                      >
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                          {isTooltipActive ? (
                                            <>
                                              <line x1="18" y1="6" x2="6" y2="18"></line>
                                              <line x1="6" y1="6" x2="18" y2="18"></line>
                                            </>
                                          ) : (
                                            <>
                                              <path d="M12 20h9"></path>
                                              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                                            </>
                                          )}
                                        </svg>
                                      </button>
                                    );
                                  })()}
                                  {activeTooltipIndex === i && activeTooltipSide === 'back' && renderFieldTooltip('back', i, f, scale)}
                                </React.Fragment>
                              );
                            })}
                            </div>
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
                                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
                                      <input type="number" className="form-input" style={{ padding: '4px', fontSize: '0.75rem', width: '44px' }} placeholder="Sz" value={f.fontSize || 16} onChange={e => handleFieldChange('front', i, 'fontSize', Number(e.target.value))} />
                                      <input type="color" title="Text colour" style={{ padding: '2px', height: '28px', width: '36px', border: '1px solid var(--glass-border)', borderRadius: '4px', background: 'transparent', cursor: 'pointer' }} value={f.color || '#000000'} onChange={e => handleFieldChange('front', i, 'color', e.target.value)} />
                                      <select className="form-select" title="Horizontal Align" style={{ padding: '4px', fontSize: '0.75rem', width: '72px' }} value={f.align || 'left'} onChange={e => handleFieldChange('front', i, 'align', e.target.value)}>
                                        <option value="left">Left</option>
                                        <option value="center">Center</option>
                                        <option value="right">Right</option>
                                      </select>
                                      <select className="form-select" title="Vertical Align" style={{ padding: '4px', fontSize: '0.75rem', width: '80px' }} value={f.verticalAlign || 'top'} onChange={e => handleFieldChange('front', i, 'verticalAlign', e.target.value)}>
                                        <option value="top">Top</option>
                                        <option value="center">Center</option>
                                        <option value="bottom">Bottom</option>
                                      </select>
                                    </div>
                                    {/* Row 2: Font family & Basic Styles */}
                                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
                                      <select className="form-select" style={{ padding: '4px', fontSize: '0.75rem', flex: 1, minWidth: '110px', fontFamily: getFontFamily(f.fontFamily) }} value={f.fontFamily || 'sans-serif'} onChange={e => handleFieldChange('front', i, 'fontFamily', e.target.value)}>
                                        {pressFonts.length > 0 && (
                                          <optgroup label="── Custom Fonts">
                                            {pressFonts.map(pf => (
                                              <option key={pf.id} value={pf.name} style={{ fontFamily: pf.name.replace(/\s+/g, '_') }}>
                                                {pf.name}
                                              </option>
                                            ))}
                                          </optgroup>
                                        )}
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
                                <button type="button" className="btn btn-danger" style={{ padding: '6px 10px', fontSize: '0.75rem' }} onClick={() => { handleRemoveField('front', i); setSelectedFieldIndex(null); setActiveTooltipIndex(null); setActiveTooltipSide(null); }}>✕</button>
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
                                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
                                      <input type="number" className="form-input" style={{ padding: '4px', fontSize: '0.75rem', width: '44px' }} placeholder="Sz" value={f.fontSize || 16} onChange={e => handleFieldChange('back', i, 'fontSize', Number(e.target.value))} />
                                      <input type="color" title="Text colour" style={{ padding: '2px', height: '28px', width: '36px', border: '1px solid var(--glass-border)', borderRadius: '4px', background: 'transparent', cursor: 'pointer' }} value={f.color || '#000000'} onChange={e => handleFieldChange('back', i, 'color', e.target.value)} />
                                      <select className="form-select" title="Horizontal Align" style={{ padding: '4px', fontSize: '0.75rem', width: '72px' }} value={f.align || 'left'} onChange={e => handleFieldChange('back', i, 'align', e.target.value)}>
                                        <option value="left">Left</option>
                                        <option value="center">Center</option>
                                        <option value="right">Right</option>
                                      </select>
                                      <select className="form-select" title="Vertical Align" style={{ padding: '4px', fontSize: '0.75rem', width: '80px' }} value={f.verticalAlign || 'top'} onChange={e => handleFieldChange('back', i, 'verticalAlign', e.target.value)}>
                                        <option value="top">Top</option>
                                        <option value="center">Center</option>
                                        <option value="bottom">Bottom</option>
                                      </select>
                                    </div>
                                    {/* Row 2: Font family & Basic Styles */}
                                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
                                      <select className="form-select" style={{ padding: '4px', fontSize: '0.75rem', flex: 1, minWidth: '110px', fontFamily: getFontFamily(f.fontFamily) }} value={f.fontFamily || 'sans-serif'} onChange={e => handleFieldChange('back', i, 'fontFamily', e.target.value)}>
                                        {pressFonts.length > 0 && (
                                          <optgroup label="── Custom Fonts">
                                            {pressFonts.map(pf => (
                                              <option key={pf.id} value={pf.name} style={{ fontFamily: pf.name.replace(/\s+/g, '_') }}>
                                                {pf.name}
                                              </option>
                                            ))}
                                          </optgroup>
                                        )}
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
                                <button type="button" className="btn btn-danger" style={{ padding: '6px 10px', fontSize: '0.75rem' }} onClick={() => { handleRemoveField('back', i); setSelectedFieldIndex(null); setActiveTooltipIndex(null); setActiveTooltipSide(null); }}>✕</button>
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
                setCardWidth(673);
                setCardHeight(1039);
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

      {/* Tabs for Template view */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '24px',
        borderBottom: '1px solid var(--glass-border)'
      }}>
        <button 
          className={`btn ${viewTab === 'my' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ 
            padding: '10px 20px', 
            borderRadius: '8px 8px 0 0', 
            borderBottom: 'none',
            background: viewTab === 'my' ? undefined : 'transparent' 
          }}
          onClick={() => setViewTab('my')}
        >
          My Templates ({templates.length})
        </button>
        <button 
          className={`btn ${viewTab === 'starter' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ 
            padding: '10px 20px', 
            borderRadius: '8px 8px 0 0', 
            borderBottom: 'none',
            background: viewTab === 'starter' ? undefined : 'transparent' 
          }}
          onClick={() => setViewTab('starter')}
        >
          Starter Templates ({globalTemplates.length})
        </button>
      </div>

      {/* Templates List */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '50px 0' }}>
          <div className="spinner"></div>
        </div>
      ) : currentTemplates.length === 0 ? (
        <div className="glass-panel" style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--muted)' }}>
          <LayoutGrid size={40} style={{ marginBottom: '16px' }} />
          <h3>{viewTab === 'my' ? 'No Templates Created' : 'No Starter Templates Available'}</h3>
          <p style={{ marginTop: '8px' }}>
            {viewTab === 'my' 
              ? 'Create a template and map card details coordinates to begin layouts previews.'
              : 'Starter templates uploaded by the Super Admin will appear here.'}
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
          gap: '24px'
        }}>
          {currentTemplates.map((tmpl) => (
            <div key={tmpl.id} className="glass-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '1.1rem', margin: 0 }}>{tmpl.name}</h3>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span className="badge badge-primary">v{tmpl.version}</span>
                    {viewTab === 'my' && isElectron && (
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
                <button className="btn btn-secondary" style={{ padding: '8px 12px', fontSize: '0.8rem', width: viewTab === 'starter' ? '33%' : '50%' }} onClick={() => { setPreviewId(tmpl.id); setPreviewSide('front'); }}>
                  <Eye size={14} /> Preview Front
                </button>
                {tmpl.backImageUrl && (
                  <button className="btn btn-secondary" style={{ padding: '8px 12px', fontSize: '0.8rem', width: viewTab === 'starter' ? '33%' : '50%' }} onClick={() => { setPreviewId(tmpl.id); setPreviewSide('back'); }}>
                    <Eye size={14} /> Preview Back
                  </button>
                )}
                {viewTab === 'starter' && (
                  <button className="btn btn-primary" style={{ padding: '8px 12px', fontSize: '0.8rem', width: tmpl.backImageUrl ? '33%' : '66%' }} onClick={() => handleCloneTemplate(tmpl)}>
                    Use Template
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
              const tmpl = templates.find((t) => t.id === previewId) || globalTemplates.find((t) => t.id === previewId);
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
                    pressFonts={pressFonts}
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
