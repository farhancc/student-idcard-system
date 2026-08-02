import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export interface FieldCoordinate {
  field: string; // name | designation | photo | cardSerial | validTill | custom_field_key...
  type: 'text' | 'image' | 'qr' | 'barcode' | 'id' | 'date' | 'number';
  min?: number;
  max?: number;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number;
  fontWeight?: string; // normal | bold
  fontStyle?: string;  // normal | italic
  fontFamily?: string; // Arial | Georgia | Verdana | custom press font name
  color?: string;           // hex text color e.g. #000000
  backgroundColor?: string; // hex background fill e.g. #ffffff (empty = transparent)
  align?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'center' | 'bottom';
  borderRadius?: number; // px — for image fields
  prefix?: string; // e.g. "Roll No: "
  suffix?: string; // e.g. " (A+)"
  letterSpacing?: number;
  lineHeight?: number;
  textDecoration?: string;
  textTransform?: string;
  opacity?: number;
  staticValue?: string;
  dateFormat?: string;
}

// Map to keep track of loaded font families in the browser
const loadedFonts = new Set<string>();



// Global caches for background templates and font files to prevent redundant HTTP downloads during compilation
const globalBgBytesCache = new Map<string, Uint8Array>();
const globalFontBytesCache = new Map<string, ArrayBuffer>();

/**
 * Helper to add cache-busting version query parameters to HTTP/HTTPS URLs.
 */
export const addCacheBust = (url: string | null | undefined, version?: number) => {
  if (!url) return url;
  if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('/api/') && !url.startsWith('/uploads/')) {
    return url;
  }
  try {
    const parsed = new URL(url, typeof window !== 'undefined' ? window.location.origin : undefined);
    parsed.searchParams.set('v', String(version || Date.now()));
    return parsed.toString();
  } catch (e) {
    return `${url}${url.includes('?') ? '&' : '?'}v=${version || Date.now()}`;
  }
};

/**
 * Clears all background-byte cache entries.
 * Call this before rendering a job to ensure template edits are reflected immediately.
 */
export function clearTemplateBgCache(...urls: (string | null | undefined)[]) {
  globalBgBytesCache.clear();
}

/**
 * Clears the in-memory font bytes cache.
 * Call this before rendering a new job to ensure any updated press font files
 * are re-fetched rather than served from the stale in-memory cache.
 */
export function clearFontBytesCache() {
  globalFontBytesCache.clear();
}

import { getResolvedFieldValue, resolveCardholderPhotoUrl, isPrimaryPhotoField, isValidImageUrl, resolveFieldRawValue, isPlaceholderStaticValue, formatFieldLabel, isImageField } from './field-resolver';
export { getResolvedFieldValue, resolveCardholderPhotoUrl, isPrimaryPhotoField, isValidImageUrl, resolveFieldRawValue, isPlaceholderStaticValue, formatFieldLabel };

/**
 * Loads a custom font using the browser's FontFace API.
 */
export async function ensureFontLoadedClient(fontName: string, fontUrl: string): Promise<string> {
  if (typeof window === 'undefined') return 'sans-serif';
  const familyName = fontName.replace(/\s+/g, '_');
  if (loadedFonts.has(familyName)) {
    return familyName;
  }

  let finalFontUrl = fontUrl.trim();
  if (finalFontUrl.startsWith('local://')) {
    const urlParts = finalFontUrl.split('?');
    let pathPart = urlParts[0].substring(8);
    const queryPart = urlParts.length > 1 ? '?' + urlParts.slice(1).join('?') : '';

    if (pathPart.startsWith('/')) {
      pathPart = pathPart.substring(1);
    }
    const encodedSegments = pathPart.split('/').map(segment => encodeURIComponent(segment));
    finalFontUrl = `local:///${encodedSegments.join('/')}${queryPart}`;
  }

  try {
    const font = new FontFace(familyName, `url(${finalFontUrl})`);
    const loaded = await font.load();
    document.fonts.add(loaded);
    loadedFonts.add(familyName);
    console.log(`Loaded browser font family: ${familyName}`);
    return familyName;
  } catch (error) {
    console.error(`Error loading browser font ${fontName}:`, error);
    return 'sans-serif';
  }
}

/**
 * Loads an image in the browser with robust CORS fallback and relative URL resolution.
 */
function loadImageClient(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (!url) {
      reject(new Error('Image URL is empty'));
      return;
    }
    let srcUrl = url.trim();
    if (srcUrl.startsWith('local://')) {
      const urlParts = srcUrl.split('?');
      let pathPart = urlParts[0].substring(8);
      const queryPart = urlParts.length > 1 ? '?' + urlParts.slice(1).join('?') : '';

      if (pathPart.startsWith('/')) {
        pathPart = pathPart.substring(1);
      }
      const encodedSegments = pathPart.split('/').map(segment => encodeURIComponent(segment));
      srcUrl = `local:///${encodedSegments.join('/')}${queryPart}`;
    }
    if (typeof window !== 'undefined') {
      if (srcUrl.startsWith('/')) {
        srcUrl = `${window.location.origin}${srcUrl}`;
      } else if (
        !srcUrl.startsWith('http://') &&
        !srcUrl.startsWith('https://') &&
        !srcUrl.startsWith('data:image/') &&
        !srcUrl.startsWith('local://') &&
        !srcUrl.startsWith('file://') &&
        !srcUrl.startsWith('blob:')
      ) {
        srcUrl = `${window.location.origin}/${srcUrl}`;
      }
    }
    const img = new Image();
    if (srcUrl.startsWith('http://') || srcUrl.startsWith('https://')) {
      img.crossOrigin = 'anonymous'; // Try anonymous first for canvas export
    }
    img.onload = () => resolve(img);
    img.onerror = () => {
      let relPath = url.trim();
      if (relPath.includes('/uploads/')) {
        relPath = relPath.substring(relPath.indexOf('/uploads/'));
      } else if (relPath.includes('uploads/')) {
        relPath = '/' + relPath.substring(relPath.indexOf('uploads/'));
      } else if (relPath.startsWith('/')) {
        relPath = relPath;
      }

      if (relPath.startsWith('/') && !srcUrl.includes('idexocards.vercel.app')) {
        const portalUrl = 'https://idexocards.vercel.app';
        const remoteUrl = `${portalUrl}${relPath}`;
        const portalImg = new Image();
        portalImg.crossOrigin = 'anonymous';
        portalImg.onload = () => resolve(portalImg);
        portalImg.onerror = () => {
          const imgFallback = new Image();
          imgFallback.onload = () => resolve(imgFallback);
          imgFallback.onerror = () => reject(new Error(`Failed to load image: ${srcUrl}`));
          imgFallback.src = remoteUrl;
        };
        portalImg.src = remoteUrl;
        return;
      }

      // Fallback: If CORS anonymous failed, try loading without crossOrigin
      const imgFallback = new Image();
      imgFallback.onload = () => resolve(imgFallback);
      imgFallback.onerror = () => reject(new Error(`Failed to load image: ${srcUrl}`));
      imgFallback.src = srcUrl;
    };
    img.src = srcUrl;
  });
}

/**
 * Generates a QR Code as a Data URL in the browser.
 */
async function generateQrCode(text: string, width: number = 256): Promise<string> {
  return QRCode.toDataURL(text, {
    margin: 1,
    width: width,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  });
}

/**
 * Generates a Barcode on an offscreen canvas.
 */
function generateBarcodeCanvas(text: string, width: number, height: number, scale: number = 1): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  if (ctx && scale > 1) {
    ctx.scale(scale, scale);
  }
  try {
    JsBarcode(canvas, text, {
      format: 'CODE128',
      displayValue: false,
      margin: 2,
    });
  } catch (err) {
    console.error('Barcode generation error:', err);
    if (ctx) {
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, width, height);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(width, height);
      ctx.moveTo(width, 0);
      ctx.lineTo(0, height);
      ctx.stroke();
    }
  }
  return canvas;
}

/**
 * Robust helper to dynamically embed an image buffer as either PNG or JPEG
 * by verifying the file format magic bytes or converting via canvas.
 */
export async function embedImageBuffer(pdfDoc: any, buffer: ArrayBuffer | Uint8Array) {
  const bytes = new Uint8Array(buffer);
  
  // PNG Magic Bytes: 0x89 0x50 0x4E 0x47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return pdfDoc.embedPng(buffer);
  }
  
  // JPEG Magic Bytes: 0xFF 0xD8
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    return pdfDoc.embedJpg(buffer);
  }

  // Fallback for WebP / GIF / BMP / non-standard images via browser Canvas:
  if (typeof window !== 'undefined') {
    try {
      const blob = new Blob([bytes]);
      const blobUrl = URL.createObjectURL(blob);
      const img = await loadImageClient(blobUrl);
      URL.revokeObjectURL(blobUrl);

      const canvas = document.createElement('canvas');
      canvas.width = img.width || 800;
      canvas.height = img.height || 800;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL('image/png');
        const base64 = dataUrl.split(',')[1];
        const pngBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
        return pdfDoc.embedPng(pngBytes);
      }
    } catch (convErr) {
      console.warn('Failed to convert non-PNG/JPEG image to PNG via canvas:', convErr);
    }
  }

  // Attempt to parse text prefix to see if this is an HTML or JSON error response
  const prefixText = Array.from(bytes.slice(0, 100))
    .map(b => String.fromCharCode(b))
    .join('');
  
  if (prefixText.trim().startsWith('<') || prefixText.trim().startsWith('{')) {
    throw new Error(`Server returned HTML/JSON response instead of image: "${prefixText.trim().substring(0, 60)}..."`);
  }

  // Fallback default
  return pdfDoc.embedJpg(buffer);
}

/**
 * Helper to wrap text.
 */
export function wrapWords(text: string, maxWidth: number, measureFn: (s: string) => number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (let i = 0; i < words.length; i++) {
    const test = current ? current + ' ' + words[i] : words[i];
    if (measureFn(test) > maxWidth && i > 0) {
      lines.push(current);
      current = words[i];
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function computeYOffsets(
  fields: FieldCoordinate[],
  measureFn: (f: FieldCoordinate, text: string) => number,
  getValueStr: (f: FieldCoordinate) => string
): Map<number, number> {
  const offsets = new Map<number, number>();
  for (let i = 0; i < fields.length; i++) offsets.set(i, 0);

  const sorted = fields
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => f.type === 'text' || f.type === 'id' || f.type === 'date' || f.type === 'number')
    .sort((a, b) => a.f.y - b.f.y);

  const effectiveY = fields.map((f) => f.y);

  for (const { f, i } of sorted) {
    const lineHeight = (f.fontSize || 20) * (f.lineHeight ?? 1.2);
    const valueStr = getValueStr(f);
    const lines = wrapWords(valueStr, f.width, (s) => measureFn(f, s));
    const renderedHeight = lines.length * lineHeight;
    const declaredHeight = f.height;
    const overflow = Math.max(0, renderedHeight - declaredHeight);

    if (overflow <= 0) continue;

    const originalBottom = effectiveY[i] + declaredHeight;
    for (let j = 0; j < fields.length; j++) {
      if (j === i) continue;
      if (effectiveY[j] >= originalBottom - 1) {
        effectiveY[j] += overflow;
        offsets.set(j, (offsets.get(j) ?? 0) + overflow);
      }
    }
  }

  return offsets;
}

/**
 * Renders a card side onto a browser HTML5 Canvas.
 */
export async function renderCardSideClient(
  canvas: HTMLCanvasElement,
  template: {
    id?: number;
    cardWidth: number;
    cardHeight: number;
    frontImageUrl: string;
    backImageUrl: string | null;
    frontOriginalUrl?: string | null;
    backOriginalUrl?: string | null;
    frontFields: string;
    backFields: string;
  },
  cardholder: {
    id?: number;
    name?: string | null;
    designation?: string | null;
    photoUrl?: string | null;
    cardSerial?: string | null;
    uniqueKey?: string | null;
    customFields?: string | null;
  },
  side: 'front' | 'back',
  validTillDate: Date | null,
  pressFonts: Array<{ name: string; fileUrl: string }> = [],
  scale: number = 1
): Promise<void> {

  const width = template.cardWidth;
  const height = template.cardHeight;

  canvas.width = width * scale;
  canvas.height = height * scale;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  if (scale > 1) {
    ctx.scale(scale, scale);
  }

  // 1. Draw solid white background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  const fieldsJson = side === 'front' ? template.frontFields : template.backFields;
  let fields: FieldCoordinate[] = [];
  try {
    if (typeof fieldsJson === 'string') {
      fields = JSON.parse(fieldsJson || '[]');
    } else if (Array.isArray(fieldsJson)) {
      fields = fieldsJson;
    }
  } catch (e) {
    console.warn(`[renderCardSideClient] Failed to parse ${side} template fields:`, e);
    fields = [];
  }
  
  const primaryUrl = side === 'front' ? template.frontImageUrl : template.backImageUrl;
  const originalUrl = side === 'front' ? template.frontOriginalUrl : template.backOriginalUrl;
  let bgUrl = primaryUrl || originalUrl;

  // Try to resolve a local cached file first (Electron)
  if (typeof window !== 'undefined' && (window as any).electronAPI?.getLocalTemplatePath && template.id) {
    try {
      const localPath = await (window as any).electronAPI.getLocalTemplatePath({
        templateId: template.id,
        side,
      });
      if (localPath) {
        const formattedPath = localPath.replace(/\\/g, '/');
        // Windows paths like C:/... need triple-slash: local:///C:/...
        const needsLeadingSlash = /^[a-zA-Z]:/.test(formattedPath);
        const localPathSegment = needsLeadingSlash ? `/${formattedPath}` : formattedPath.startsWith('/') ? formattedPath : `/${formattedPath}`;
        bgUrl = `local://${localPathSegment}`;
      } else if (originalUrl) {
        // No local cache → fall back to Cloudinary original (high-res)
        bgUrl = originalUrl;
      }
    } catch (err) {
      console.error('Failed to get local template path:', err);
      if (originalUrl) bgUrl = originalUrl;
    }
  }

  // 2. Draw Background
  if (bgUrl) {
    try {
      let absoluteBgUrl = bgUrl;
      const lowerBg = bgUrl.toLowerCase();
      if (lowerBg.includes('.pdf')) {
        if (bgUrl.includes('/templates/originals/')) {
          absoluteBgUrl = bgUrl.replace('/templates/originals/', '/templates/previews/').replace(/\.pdf(\?|$)/i, '.png$1');
        } else {
          absoluteBgUrl = bgUrl.replace(/\.pdf(\?|$)/i, '.png$1');
        }
      } else if (lowerBg.includes('.svg')) {
        if (bgUrl.includes('/image/upload/')) {
          absoluteBgUrl = bgUrl.replace('/image/upload/', '/image/upload/w_2000/').replace(/\.svg(\?|$)/i, '.png$1');
        } else {
          absoluteBgUrl = bgUrl.replace(/\.svg(\?|$)/i, '.png$1');
        }
      }
      const bg = await loadImageClient(absoluteBgUrl);
      ctx.drawImage(bg, 0, 0, width, height);
    } catch (err) {
      console.error(`Error loading background image ${bgUrl}:`, err);
      ctx.fillStyle = side === 'front' ? '#EBF0F5' : '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#888888';
      ctx.font = '24px sans-serif';
      ctx.fillText(`Error Loading Background (${side})`, 40, height / 2);
    }
  } else {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
  }

  // 3. Parse Custom Fields JSON
  const customData = cardholder.customFields
    ? typeof cardholder.customFields === 'string'
      ? JSON.parse(cardholder.customFields)
      : cardholder.customFields
    : {};

  const effectivePhotoUrl = resolveCardholderPhotoUrl(cardholder, customData);

  // Formatted date string for validTill
  let formattedValidTill = '';
  if (validTillDate) {
    const date = new Date(validTillDate);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    formattedValidTill = `${months[date.getMonth()]} ${date.getFullYear()}`;
  }

  const data: Record<string, any> = {
    name: cardholder.name || '',
    designation: cardholder.designation || '',
    photo: effectivePhotoUrl || cardholder.photoUrl || '',
    photoUrl: effectivePhotoUrl || cardholder.photoUrl || '',
    cardSerial: cardholder.cardSerial || '',
    uniqueKey: cardholder.uniqueKey || customData.uniqueKey || customData.id || customData.unique_key || '',
    id: cardholder.uniqueKey || customData.uniqueKey || customData.id || customData.unique_key || '',
    validTill: formattedValidTill,
    ...customData,
  };

  // Ensure effectivePhotoUrl overwrites any empty photo key from customData
  if (effectivePhotoUrl) {
    data.photo = effectivePhotoUrl;
    data.photoUrl = effectivePhotoUrl;
  }

  // 4. Pre-compute Y offsets
  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d');

  const getClientValueStr = (f: FieldCoordinate) => {
    const rv = resolveFieldRawValue(f, data, cardholder);
    if (rv === undefined || rv === null) return '';
    return `${f.prefix || ''}${rv}${f.suffix || ''}`;
  };

  const clientMeasure = (f: FieldCoordinate, s: string) => {
    if (!tempCtx) return 0;
    let fontName = 'sans-serif';
    if (f.fontFamily && f.fontFamily !== 'sans-serif') {
      const familyName = f.fontFamily.replace(/\s+/g, '_');
      fontName = familyName;
    }
    const fontStyle = f.fontStyle && f.fontStyle !== 'normal' ? f.fontStyle : 'normal';
    const fontWeight = f.fontWeight && f.fontWeight !== 'normal' ? f.fontWeight : 'normal';
    tempCtx.font = `${fontStyle} ${fontWeight} ${f.fontSize || 20}px "${fontName}"`;

    const spacing = f.letterSpacing || 0;
    if (!spacing) return tempCtx.measureText(s).width;

    let totalWidth = 0;
    for (let charIndex = 0; charIndex < s.length; charIndex++) {
      totalWidth += tempCtx.measureText(s[charIndex]).width;
      if (charIndex < s.length - 1) {
        totalWidth += spacing;
      }
    }
    return totalWidth;
  };

  const yOffsets = computeYOffsets(fields, clientMeasure, getClientValueStr);

  // 5. Draw fields
  for (let fi = 0; fi < fields.length; fi++) {
    const f = fields[fi];
    const yOffset = yOffsets.get(fi) ?? 0;
    const isImgField = isImageField(f) || f.type === 'image';
    let rawValue = resolveFieldRawValue(f, data, cardholder);
    if ((rawValue === undefined || rawValue === null || rawValue === '') && isImgField) {
      // Try all possible static image sources on the field definition
      rawValue = f.imageUrl || f.sampleValue || f.value || f.src || f.url || f.defaultUrl || f.defaultValue || null;
    }
    // For non-image fields: skip if no value. For image fields: always proceed (may draw placeholder)
    if (!isImgField && (rawValue === undefined || rawValue === null)) continue;

    const valueStr = `${f.prefix || ''}${rawValue || ''}${f.suffix || ''}`;
    const effectiveY = f.y + yOffset;

    switch (f.type) {
      case 'id':
      case 'text':
      case 'date':
      case 'number':
      case 'static_text':
      case 'static':
      case 'label': {
        ctx.save();

        let processedValue = valueStr;
        if (f.textTransform === 'uppercase') {
          processedValue = valueStr.toUpperCase();
        } else if (f.textTransform === 'lowercase') {
          processedValue = valueStr.toLowerCase();
        } else if (f.textTransform === 'capitalize') {
          processedValue = valueStr.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
        }

        if (f.opacity != null) {
          ctx.globalAlpha = f.opacity;
        }

        let fontName = 'sans-serif';
        if (f.fontFamily && f.fontFamily !== 'sans-serif') {
          const matchingFont = pressFonts.find(pf => pf.name.toLowerCase() === f.fontFamily?.toLowerCase());
          if (matchingFont) {
            fontName = await ensureFontLoadedClient(matchingFont.name, matchingFont.fileUrl);
          } else {
            fontName = f.fontFamily;
          }
        }

        const fontStyle = f.fontStyle && f.fontStyle !== 'normal' ? f.fontStyle : 'normal';
        const fontWeight = f.fontWeight && f.fontWeight !== 'normal' ? f.fontWeight : 'normal';
        ctx.font = `${fontStyle} ${fontWeight} ${f.fontSize || 20}px "${fontName}"`;
        ctx.fillStyle = f.color || '#000000';
        ctx.textAlign = f.align || 'left';
        ctx.textBaseline = 'top';

        const measureTextSpacing = (s: string) => {
          const spacing = f.letterSpacing || 0;
          if (!spacing) return ctx.measureText(s).width;
          let totalWidth = 0;
          for (let charIndex = 0; charIndex < s.length; charIndex++) {
            totalWidth += ctx.measureText(s[charIndex]).width;
            if (charIndex < s.length - 1) {
              totalWidth += spacing;
            }
          }
          return totalWidth;
        };

        const lines = wrapWords(processedValue, f.width, measureTextSpacing);
        const lineHeight = (f.fontSize || 20) * (f.lineHeight ?? 1.2);
        const renderedHeight = lines.length * lineHeight;

        // Calculate starting Y based on vertical alignment
        const halfLeading = (lineHeight - (f.fontSize || 20)) / 2;
        let startY = effectiveY + halfLeading;
        if (f.verticalAlign === 'center') {
          startY = effectiveY + (f.height - renderedHeight) / 2 + halfLeading;
        } else if (f.verticalAlign === 'bottom') {
          startY = effectiveY + f.height - renderedHeight + halfLeading;
        }

        // Draw background fill if set
        if (f.backgroundColor && f.backgroundColor !== 'transparent') {
          ctx.save();
          ctx.fillStyle = f.backgroundColor;
          if (f.borderRadius && f.borderRadius > 0) {
            const r = Math.min(f.borderRadius, f.width / 2, f.height / 2);
            ctx.beginPath();
            ctx.moveTo(f.x + r, effectiveY);
            ctx.lineTo(f.x + f.width - r, effectiveY);
            ctx.quadraticCurveTo(f.x + f.width, effectiveY, f.x + f.width, effectiveY + r);
            ctx.lineTo(f.x + f.width, effectiveY + f.height - r);
            ctx.quadraticCurveTo(f.x + f.width, effectiveY + f.height, f.x + f.width - r, effectiveY + f.height);
            ctx.lineTo(f.x + r, effectiveY + f.height);
            ctx.quadraticCurveTo(f.x, effectiveY + f.height, f.x, effectiveY + f.height - r);
            ctx.lineTo(f.x, effectiveY + r);
            ctx.quadraticCurveTo(f.x, effectiveY, f.x + r, effectiveY);
            ctx.closePath();
            ctx.fill();
          } else {
            ctx.fillRect(f.x, effectiveY, f.width, f.height);
          }
          ctx.restore();
        }

        ctx.beginPath();
        ctx.rect(f.x, effectiveY, f.width, f.height);
        ctx.clip();

        let currentY = startY;
        lines.forEach(lineText => {
          let lineDrawX = f.x;
          const lineWidth = measureTextSpacing(lineText);
          if (f.align === 'center') {
            lineDrawX = f.x + (f.width - lineWidth) / 2;
          } else if (f.align === 'right') {
            lineDrawX = f.x + f.width - lineWidth;
          }

          const spacing = f.letterSpacing || 0;
          if (spacing) {
            let charX = lineDrawX;
            ctx.save();
            ctx.textAlign = 'left';
            for (let charIndex = 0; charIndex < lineText.length; charIndex++) {
              const char = lineText[charIndex];
              ctx.fillText(char, charX, currentY);
              charX += ctx.measureText(char).width + spacing;
            }
            ctx.restore();
          } else {
            ctx.fillText(lineText, f.align === 'center' ? f.x + f.width / 2 : f.align === 'right' ? f.x + f.width : f.x, currentY);
          }

          if (f.textDecoration && f.textDecoration !== 'none') {
            ctx.save();
            ctx.beginPath();
            ctx.strokeStyle = f.color || '#000000';
            ctx.lineWidth = Math.max(1, (f.fontSize || 20) * 0.08);
            
            let lineY = currentY;
            if (f.textDecoration === 'underline') {
              lineY = currentY + (f.fontSize || 20) * 0.95;
            } else if (f.textDecoration === 'line-through') {
              lineY = currentY + (f.fontSize || 20) * 0.55;
            }
            
            ctx.moveTo(lineDrawX, lineY);
            ctx.lineTo(lineDrawX + lineWidth, lineY);
            ctx.stroke();
            ctx.restore();
          }

          currentY += lineHeight;
        });
        ctx.restore();
        break;
      }

      case 'image':
      case 'photo':
      case 'signature':
      case 'sig':
      case 'logo':
      case 'stamp':
      case 'img':
      case 'picture':
      case 'static_image':
      case 'static_img': {
        const imageSrc = rawValue ? String(rawValue) : ((f as any).imageUrl || (f as any).sampleValue || (f as any).value || (f as any).src || (f as any).url || (f as any).defaultUrl || (f as any).defaultValue);
        
        if (imageSrc && isValidImageUrl(imageSrc)) {
          try {
            const img = await loadImageClient(String(imageSrc));
            ctx.save();
            const radius = Math.min(f.borderRadius || 0, f.width / 2, f.height / 2);
            ctx.beginPath();
            if (radius > 0) {
              const x = f.x, y = effectiveY, w = f.width, h = f.height, r = radius;
              ctx.moveTo(x + r, y);
              ctx.lineTo(x + w - r, y);
              ctx.quadraticCurveTo(x + w, y, x + w, y + r);
              ctx.lineTo(x + w, y + h - r);
              ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
              ctx.lineTo(x + r, y + h);
              ctx.quadraticCurveTo(x, y + h, x, y + h - r);
              ctx.lineTo(x, y + r);
              ctx.quadraticCurveTo(x, y, x + r, y);
              ctx.closePath();
            } else {
              ctx.rect(f.x, effectiveY, f.width, f.height);
            }
            ctx.clip();

            const imgRatio = img.width / img.height;
            const boxRatio = f.width / f.height;

            let drawWidth = f.width;
            let drawHeight = f.height;
            let drawX = f.x;
            let drawY = effectiveY;

            if (imgRatio > boxRatio) {
              drawWidth = f.height * imgRatio;
              drawX = f.x - (drawWidth - f.width) / 2;
            } else {
              drawHeight = f.width / imgRatio;
              drawY = effectiveY - (drawHeight - f.height) / 2;
            }

            ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
            ctx.restore();
            break;
          } catch (err) {
            console.error(`Error loading browser image field ${f.field}:`, err);
          }
        }

        // Clean placeholder fallback box when dynamic image file or URL is absent/placeholder
        ctx.save();
        const radius = Math.min(f.borderRadius || 0, f.width / 2, f.height / 2);
        ctx.beginPath();
        if (radius > 0) {
          const x = f.x, y = effectiveY, w = f.width, h = f.height, r = radius;
          ctx.moveTo(x + r, y);
          ctx.lineTo(x + w - r, y);
          ctx.quadraticCurveTo(x + w, y, x + w, y + r);
          ctx.lineTo(x + w, y + h - r);
          ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
          ctx.lineTo(x + r, y + h);
          ctx.quadraticCurveTo(x, y + h, x, y + h - r);
          ctx.lineTo(x, y + r);
          ctx.quadraticCurveTo(x, y, x + r, y);
          ctx.closePath();
        } else {
          ctx.rect(f.x, effectiveY, f.width, f.height);
        }
        ctx.fillStyle = 'rgba(241, 245, 249, 0.85)';
        ctx.fill();
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = '#475569';
        ctx.font = `600 ${Math.max(10, Math.min(14, f.height * 0.25))}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const labelText = f.label || f.name || f.field || 'Image Field';
        ctx.fillText(labelText, f.x + f.width / 2, effectiveY + f.height / 2);
        ctx.restore();
        break;
      }

      case 'qr': {
        if (!rawValue) continue;
        try {
          const qrSize = Math.max(256, Math.round(f.width * scale));
          const qrDataUrl = await generateQrCode(String(rawValue), qrSize);
          const qrImg = await loadImageClient(qrDataUrl);
          ctx.drawImage(qrImg, f.x, effectiveY, f.width, f.height);
        } catch (err) {
          console.error('QR code browser render error:', err);
        }
        break;
      }

      case 'barcode': {
        if (!rawValue) continue;
        try {
          const barcodeCanvas = generateBarcodeCanvas(String(rawValue), f.width, f.height, scale);
          ctx.drawImage(barcodeCanvas, f.x, effectiveY, f.width, f.height);
        } catch (err) {
          console.error('Barcode browser render error:', err);
        }
        break;
      }
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Vector-native client-side PDF renderer
// Produces a single-card PDF buffer directly from the template assets and
// cardholder data, keeping the background vector and text as native PDF objects.
// Only the photograph (image field) is embedded as a raster image.
// ──────────────────────────────────────────────────────────────────────────────

/** Helper: fetch a URL and return its raw ArrayBuffer. */
async function fetchArrayBuffer(url: string): Promise<ArrayBuffer> {
  if (!url) throw new Error('Empty URL passed to fetchArrayBuffer');
  let targetUrl = url.trim();

  // Data URI handling
  if (targetUrl.startsWith('data:')) {
    const commaIdx = targetUrl.indexOf(',');
    if (commaIdx !== -1) {
      const base64Data = targetUrl.substring(commaIdx + 1);
      const binaryStr = atob(base64Data);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      return bytes.buffer;
    }
  }

  // Check local:// on Windows: ensure triple-slash local:///C:/... and URL-encode path
  if (targetUrl.startsWith('local://')) {
    const urlParts = targetUrl.split('?');
    let pathPart = urlParts[0].substring(8);
    const queryPart = urlParts.length > 1 ? '?' + urlParts.slice(1).join('?') : '';

    if (pathPart.startsWith('/')) {
      pathPart = pathPart.substring(1);
    }
    const encodedSegments = pathPart.split('/').map(segment => encodeURIComponent(segment));
    targetUrl = `local:///${encodedSegments.join('/')}${queryPart}`;
  }

  // Relative path resolution
  if (typeof window !== 'undefined') {
    if (targetUrl.startsWith('/')) {
      targetUrl = `${window.location.origin}${targetUrl}`;
    } else if (
      !targetUrl.startsWith('http://') &&
      !targetUrl.startsWith('https://') &&
      !targetUrl.startsWith('local://') &&
      !targetUrl.startsWith('file://') &&
      !targetUrl.startsWith('blob:')
    ) {
      targetUrl = `${window.location.origin}/${targetUrl}`;
    }
  }

  try {
    const res = await fetch(targetUrl);
    if (res.ok) return await res.arrayBuffer();
  } catch (err) {
    // Attempt relative portal fallback below
  }

  // Fallback: If relative URL or local protocol failed, fetch from production portal URL
  let relPath = url.trim();
  if (relPath.includes('/uploads/')) {
    relPath = relPath.substring(relPath.indexOf('/uploads/'));
  } else if (relPath.includes('uploads/')) {
    relPath = '/' + relPath.substring(relPath.indexOf('uploads/'));
  } else if (relPath.startsWith('/')) {
    relPath = relPath;
  }

  if (relPath.startsWith('/')) {
    const portalUrl = (typeof process !== 'undefined' && process.env && process.env.PORTAL_URL) || 'https://idexocards.vercel.app';
    const remoteUrl = `${portalUrl}${relPath}`;
    const remoteRes = await fetch(remoteUrl);
    if (remoteRes.ok) return await remoteRes.arrayBuffer();
  }

  throw new Error(`Fetch failed for ${url}`);
}

/** Convert a hex color string to pdf-lib rgb(). */
function hexToRgbClient(hex?: string) {
  if (!hex) return rgb(0, 0, 0);
  const clean = hex.replace('#', '');
  const parse = (s: string) => parseInt(s, 16) / 255;
  if (clean.length === 3) {
    return rgb(parse(clean[0].repeat(2)), parse(clean[1].repeat(2)), parse(clean[2].repeat(2)));
  }
  return rgb(parse(clean.slice(0, 2)), parse(clean.slice(2, 4)), parse(clean.slice(4, 6)));
}

/** Wrap text into lines that fit within maxWidth, measured with measureFn. */
function wrapWordsPdf(text: string, maxWidth: number, measureFn: (s: string) => number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (let i = 0; i < words.length; i++) {
    const test = current ? current + ' ' + words[i] : words[i];
    if (measureFn(test) > maxWidth && i > 0) {
      lines.push(current);
      current = words[i];
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Renders a card side as a single-page PDF buffer using pdf-lib directly.
 * The background template PDF page is embedded as a vector Form XObject,
 * text fields are drawn as native PDF text operators,
 * and only photograph images are embedded as raster PNG/JPEG.
 *
 * @param template    Card template metadata (original URLs preferred for vector)
 * @param cardholder  Cardholder data object
 * @param side        'front' | 'back'
 * @param validTillDate Optional expiry date
 * @param pressFonts  List of custom press fonts
 * @returns           Uint8Array PDF bytes for this single card page
 */
export async function renderCardSideToPdfBytesClient(
  template: {
    id?: number;
    cardWidth: number;
    cardHeight: number;
    frontImageUrl: string;
    backImageUrl: string | null;
    frontOriginalUrl?: string | null;
    backOriginalUrl?: string | null;
    frontFields: string;
    backFields: string;
    version?: number;
  },
  cardholder: {
    id?: number;
    name?: string | null;
    designation?: string | null;
    photoUrl?: string | null;
    cardSerial?: string | null;
    uniqueKey?: string | null;
    customFields?: string | null;
  },
  side: 'front' | 'back',
  validTillDate: Date | null,
  pressFonts: Array<{ name: string; fileUrl: string }> = []
): Promise<Uint8Array> {

  const widthPx = template.cardWidth;
  const heightPx = template.cardHeight;
  const PX_TO_PT = 0.24; // 300 DPI: 1 px = 72/300 pt
  const widthPt = widthPx * PX_TO_PT;
  const heightPt = heightPx * PX_TO_PT;

  const fieldsJson = side === 'front' ? template.frontFields : template.backFields;
  const fields: FieldCoordinate[] = JSON.parse(fieldsJson || '[]');

  const originalUrl = side === 'front' ? (template.frontOriginalUrl ?? null) : (template.backOriginalUrl ?? null);
  const previewUrl  = side === 'front' ? template.frontImageUrl : template.backImageUrl;

  // Append cache busting version parameter
  const bustedOriginalUrl = originalUrl ? addCacheBust(originalUrl, template.version) : null;
  const bustedPreviewUrl = previewUrl ? addCacheBust(previewUrl, template.version) : null;

  // Resolve local paths or download cache if running in Electron
  let finalBgUrl = bustedOriginalUrl || bustedPreviewUrl;
  let resolvedLocally = false;

  if (finalBgUrl && typeof window !== 'undefined' && (window as any).electronAPI?.getLocalTemplatePath && template.id) {
    try {
      let localPath = await (window as any).electronAPI.getLocalTemplatePath({
        templateId: template.id,
        side,
      });

      // Auto-download and cache template locally if missing and online
      if (!localPath && bustedOriginalUrl) {
        try {
          console.log(`[PDF client] Template ${template.id} ${side} not cached locally. Downloading original...`);
          const arrayBuffer = await fetchArrayBuffer(bustedOriginalUrl);
          
          // Verify downloaded data is a PDF or other valid template asset
          const bytes = new Uint8Array(arrayBuffer);
          const isPdf = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d; // %PDF-
          
          // Base64 encode for IPC bridge
          const base64Data = Buffer.from(arrayBuffer).toString('base64');
          
          if ((window as any).electronAPI.saveTemplateOriginal) {
            const saveRes = await (window as any).electronAPI.saveTemplateOriginal({
              templateId: template.id,
              side,
              base64Data,
              fileName: originalUrl, // Use originalUrl (no cache-bust) to maintain correct extension sniffing
            });
            if (saveRes?.success && saveRes.path) {
              console.log(`[PDF client] Saved template original locally: ${saveRes.path} (isPdf=${isPdf})`);
              localPath = saveRes.path;
            }
          }
        } catch (downloadErr) {
          console.warn(`[PDF client] Failed to download and cache original template locally:`, downloadErr);
        }
      }

      if (localPath) {
        // Normalise back-slashes (Windows) to forward-slashes
        const formattedPath = localPath.replace(/\\/g, '/');
        // Windows absolute paths (e.g. C:/...) need an extra leading slash so
        // the URL is local:///C:/... rather than local://C:/... — the latter
        // makes URL parsers treat 'C' as the hostname, causing a silent fetch
        // failure that falls through to the raster preview fallback.
        const needsLeadingSlash = /^[a-zA-Z]:/.test(formattedPath);
        const localPathSegment = needsLeadingSlash ? `/${formattedPath}` : formattedPath.startsWith('/') ? formattedPath : `/${formattedPath}`;
        finalBgUrl = `local://${localPathSegment}`;
        if (template.version) {
          finalBgUrl = `${finalBgUrl}?v=${template.version}`;
        }
        resolvedLocally = true;
      }
    } catch (err) {
      console.error('[PDF client] Failed to resolve local template path:', err);
    }
  }

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([widthPt, heightPt]);

  // ── 1. White background ──────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: 0, width: widthPt, height: heightPt, color: rgb(1, 1, 1) });

  // ── 2. Background template ───────────────────────────────────────────────
  if (finalBgUrl) {
    try {
      let bgBytes: Uint8Array | null = null;
      let bgBufferSource = '';

      if (globalBgBytesCache.has(finalBgUrl)) {
        bgBytes = globalBgBytesCache.get(finalBgUrl)!;
        bgBufferSource = finalBgUrl;
      } else {
        try {
          bgBytes = new Uint8Array(await fetchArrayBuffer(finalBgUrl));
          bgBufferSource = finalBgUrl;
          globalBgBytesCache.set(finalBgUrl, bgBytes);
        } catch (err) {
          console.warn(`[PDF client] Failed to load background from ${finalBgUrl}:`, err);
        }

        // Fallback to preview url if local resolution or fetch of originalUrl failed
        if (!bgBytes && resolvedLocally && bustedPreviewUrl) {
          try {
            console.log(`[PDF client] Local original template load failed, trying preview URL: ${bustedPreviewUrl}`);
            bgBytes = new Uint8Array(await fetchArrayBuffer(bustedPreviewUrl));
            bgBufferSource = bustedPreviewUrl;
            globalBgBytesCache.set(bustedPreviewUrl, bgBytes);
          } catch (prevErr) {
            console.error(`[PDF client] Failed to load preview background fallback:`, prevErr);
          }
        }
      }

      if (bgBytes) {
        // Sniff bytes to determine if the loaded background is a PDF
        const isPdf = bgBytes[0] === 0x25 && bgBytes[1] === 0x50 && bgBytes[2] === 0x44 && bgBytes[3] === 0x46 && bgBytes[4] === 0x2d; // %PDF-

        if (isPdf) {
          // Vector path: embed the PDF template page directly
          const bgPdf = await PDFDocument.load(bgBytes);
          const [embeddedPage] = await pdfDoc.embedPdf(bgPdf, [0]);
          page.drawPage(embeddedPage, { x: 0, y: 0, width: widthPt, height: heightPt });
        } else {
          // Raster fallback: resolve SVG → PNG via Cloudinary transform if needed
          const lowerSource = bgBufferSource.toLowerCase();
          let resolvedUrl = bgBufferSource;
          if (lowerSource.includes('.svg')) {
            if (bgBufferSource.includes('/image/upload/')) {
              resolvedUrl = bgBufferSource.replace('/image/upload/', '/image/upload/w_3000/').replace('.svg', '.png');
            } else {
              resolvedUrl = bgBufferSource.replace('.svg', '.png');
            }
          }
          
          let finalBytes = bgBytes;
          if (resolvedUrl !== bgBufferSource) {
            const targetCacheKey = template.version ? `${resolvedUrl}?v=${template.version}` : resolvedUrl;
            if (globalBgBytesCache.has(targetCacheKey)) {
              finalBytes = globalBgBytesCache.get(targetCacheKey)!;
            } else {
              const resolvedUrlBusted = template.version ? (addCacheBust(resolvedUrl, template.version) as string) : resolvedUrl;
              finalBytes = new Uint8Array(await fetchArrayBuffer(resolvedUrlBusted));
              globalBgBytesCache.set(targetCacheKey, finalBytes);
            }
          }
          
          const bgImg = await embedImageBuffer(pdfDoc, finalBytes);
          page.drawImage(bgImg, { x: 0, y: 0, width: widthPt, height: heightPt });
        }
      }
    } catch (err) {
      console.error(`[renderCardSideToPdfBytesClient] Background load error:`, err);
    }
  }

  // ── 3. Prepare data ──────────────────────────────────────────────────────
  const customData = cardholder.customFields
    ? typeof cardholder.customFields === 'string'
      ? (cardholder.customFields.trim().startsWith('{') || cardholder.customFields.trim().startsWith('[')
          ? JSON.parse(cardholder.customFields)
          : {})
      : cardholder.customFields
    : {};

  const effectivePhotoUrl = resolveCardholderPhotoUrl(cardholder, customData);

  let formattedValidTill = '';
  if (validTillDate) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    formattedValidTill = `${months[validTillDate.getMonth()]} ${validTillDate.getFullYear()}`;
  }

  const data: Record<string, any> = {
    name: cardholder.name || '',
    designation: cardholder.designation || '',
    photo: effectivePhotoUrl || cardholder.photoUrl || '',
    photoUrl: effectivePhotoUrl || cardholder.photoUrl || '',
    cardSerial: cardholder.cardSerial || '',
    uniqueKey: cardholder.uniqueKey || customData.uniqueKey || customData.id || customData.unique_key || '',
    id: cardholder.uniqueKey || customData.uniqueKey || customData.id || customData.unique_key || '',
    validTill: formattedValidTill,
    ...customData,
  };

  if (effectivePhotoUrl) {
    data.photo = effectivePhotoUrl;
    data.photoUrl = effectivePhotoUrl;
  }

  // \u2500\u2500 4. Pre-embed fonts \u2500\u2500
  const fontCache = new Map<string, any>();

  // Normalize any fontWeight value (CSS keyword or numeric string) to a number (100-900)
  const resolveWeightNumber = (fw: string | undefined): number => {
    if (!fw) return 400;
    const n = Number(fw);
    if (!isNaN(n) && n >= 100) return n;
    const kwMap: Record<string, number> = {
      thin: 100, hairline: 100,
      extralight: 200, ultralight: 200,
      light: 300,
      normal: 400, regular: 400, book: 400,
      medium: 500,
      semibold: 600, demibold: 600,
      bold: 700,
      extrabold: 800, ultrabold: 800,
      black: 900, heavy: 900, ultra: 900,
    };
    return kwMap[fw.toLowerCase().replace(/[\s-_]+/g, '')] ?? 400;
  };

  // Map common system/web font names to pdf-lib StandardFonts (bold = weight >= 600)
  const resolveStandardFont = (family: string, weightNum: number, isItalic: boolean): string | null => {
    const isBoldStd = weightNum >= 600;
    const n = family.toLowerCase().replace(/[\s-_]+/g, '');
    const timesAliases = ['timesnewroman', 'times', 'timesroman', 'georgia', 'garamond', 'palatino', 'bookantiqua', 'palatinolinotype', 'serif'];
    const courierAliases = ['couriernew', 'courier', 'lucidaconsole', 'consolas', 'monospace', 'mono'];
    const helveticaAliases = [
      'arial', 'helvetica', 'arialnarrow', 'calibri', 'tahoma', 'verdana', 'trebuchetms', 'gillsans', 'centuryschoolbook',
      'inter', 'roboto', 'outfit', 'poppins', 'montserrat', 'lato', 'opensans', 'open-sans', 'sans-serif', 'sansserif', 'system-ui', 'segoeui', 'segoe'
    ];
    if (timesAliases.some(a => n.includes(a))) {
      return isBoldStd && isItalic ? StandardFonts.TimesRomanBoldItalic
        : isBoldStd ? StandardFonts.TimesRomanBold
        : isItalic  ? StandardFonts.TimesRomanItalic
        :             StandardFonts.TimesRoman;
    }
    if (courierAliases.some(a => n.includes(a))) {
      return isBoldStd && isItalic ? StandardFonts.CourierBoldOblique
        : isBoldStd ? StandardFonts.CourierBold
        : isItalic  ? StandardFonts.CourierOblique
        :             StandardFonts.Courier;
    }
    if (helveticaAliases.some(a => n.includes(a))) {
      return isBoldStd && isItalic ? StandardFonts.HelveticaBoldOblique
        : isBoldStd ? StandardFonts.HelveticaBold
        : isItalic  ? StandardFonts.HelveticaOblique
        :             StandardFonts.Helvetica;
    }
    // Default fallback for any unspecified sans-serif/web font
    return isBoldStd && isItalic ? StandardFonts.HelveticaBoldOblique
      : isBoldStd ? StandardFonts.HelveticaBold
      : isItalic  ? StandardFonts.HelveticaOblique
      :             StandardFonts.Helvetica;
  };

  const getEmbeddedFont = async (f: FieldCoordinate): Promise<any> => {
    const weightNum = resolveWeightNumber(f.fontWeight);
    const isItalic = f.fontStyle === 'italic';

    if (f.fontFamily && f.fontFamily !== 'sans-serif') {
      const baseName = f.fontFamily.toLowerCase();
      const weightLabel = (
        weightNum <= 100 ? 'thin'
        : weightNum <= 200 ? 'extralight'
        : weightNum <= 300 ? 'light'
        : weightNum <= 400 ? 'regular'
        : weightNum <= 500 ? 'medium'
        : weightNum <= 600 ? 'semibold'
        : weightNum <= 700 ? 'bold'
        : weightNum <= 800 ? 'extrabold'
        :                    'black'
      );
      const italicSuffix = isItalic ? ' italic' : '';
      const candidates = [
        `${baseName} ${weightLabel}${italicSuffix}`,
        `${baseName} ${weightNum}${italicSuffix}`,
        isItalic ? `${baseName} ${weightLabel} italic` : null,
        isItalic ? `${baseName} italic` : null,
        baseName,
      ].filter(Boolean) as string[];

      let match: { name: string; fileUrl: string } | undefined;
      for (const candidate of candidates) {
        match = pressFonts.find(pf => pf.name.toLowerCase() === candidate);
        if (match) break;
      }

      if (match) {
        // Load custom font in browser document.fonts for tempCtx text measurements
        try {
          await ensureFontLoadedClient(match.name, match.fileUrl);
        } catch (e) {
          console.warn('[PDF client] ensureFontLoadedClient failed for:', match.name, e);
        }

        const cacheKey = match.fileUrl;
        if (!fontCache.has(cacheKey)) {
          try {
            let fontBytes = globalFontBytesCache.get(cacheKey);
            if (!fontBytes) {
              fontBytes = await fetchArrayBuffer(match.fileUrl);
              globalFontBytesCache.set(cacheKey, fontBytes);
            }
            fontCache.set(cacheKey, await pdfDoc.embedFont(fontBytes));
          } catch (err) {
            console.error(`[PDF client] Font load failed for ${match.name}:`, err);
          }
        }
        if (fontCache.has(cacheKey)) return fontCache.get(cacheKey);
      }

      // Try standard font name mapping (e.g. Times New Roman → TimesRoman)
      const mappedStd = resolveStandardFont(f.fontFamily, weightNum, isItalic);
      if (mappedStd) {
        if (!fontCache.has(mappedStd)) fontCache.set(mappedStd, await pdfDoc.embedFont(mappedStd));
        return fontCache.get(mappedStd);
      }
    }
    // Final fallback: Helvetica with bold collapsed at >=600
    const isBoldFallback = weightNum >= 600;
    const stdFont =
      isBoldFallback && isItalic ? StandardFonts.HelveticaBoldOblique
      : isBoldFallback           ? StandardFonts.HelveticaBold
      : isItalic                 ? StandardFonts.HelveticaOblique
      :                            StandardFonts.Helvetica;
    if (!fontCache.has(stdFont)) {
      fontCache.set(stdFont, await pdfDoc.embedFont(stdFont));
    }
    return fontCache.get(stdFont);
  };

  // Embed all unique fonts used by text/id/date/number fields beforehand so computeYOffsets is fast and synchronous
  for (const f of fields) {
    if (f.type !== 'text' && f.type !== 'id' && f.type !== 'date' && f.type !== 'number') continue;
    await getEmbeddedFont(f);
  }

  const getPdfValueStr = (f: FieldCoordinate) => {
    const rv = resolveFieldRawValue(f, data, cardholder);
    if (rv === undefined || rv === null) return '';
    return `${f.prefix || ''}${rv}${f.suffix || ''}`;
  };

  const tempCanvas = typeof window !== 'undefined' ? document.createElement('canvas') : null;
  const tempCtx = tempCanvas ? tempCanvas.getContext('2d') : null;

  const pdfMeasureProxy = (f: FieldCoordinate, s: string) => {
    if (!tempCtx) return s.length * ((f.fontSize || 20) * 0.5);
    let fontName = 'sans-serif';
    if (f.fontFamily && f.fontFamily !== 'sans-serif') {
      fontName = f.fontFamily.replace(/\s+/g, '_');
    }
    const fontStyle = f.fontStyle && f.fontStyle !== 'normal' ? f.fontStyle : 'normal';
    const fontWeight = f.fontWeight && f.fontWeight !== 'normal' ? f.fontWeight : 'normal';
    tempCtx.font = `${fontStyle} ${fontWeight} ${f.fontSize || 20}px "${fontName}"`;

    const spacing = f.letterSpacing || 0;
    if (!spacing) return tempCtx.measureText(s).width;

    let totalWidth = 0;
    for (let charIndex = 0; charIndex < s.length; charIndex++) {
      totalWidth += tempCtx.measureText(s[charIndex]).width;
      if (charIndex < s.length - 1) {
        totalWidth += spacing;
      }
    }
    return totalWidth;
  };

  const pdfYOffsets = computeYOffsets(fields, pdfMeasureProxy, getPdfValueStr);

  // ── 5. Draw fields ───────────────────────────────────────────────────────
  for (let fi = 0; fi < fields.length; fi++) {
    const f = fields[fi];
    const yOffsetPx = pdfYOffsets.get(fi) ?? 0;
    let rawValue = resolveFieldRawValue(f, data, cardholder);
    const isImgField = isImageField(f) || (f.type || '').toLowerCase() === 'image';
    if ((rawValue === undefined || rawValue === null || rawValue === '') && isImgField) {
      rawValue = (f as any).imageUrl || (f as any).sampleValue || (f as any).value || (f as any).src || (f as any).url || (f as any).defaultUrl || (f as any).defaultValue;
    }
    const safePrefix = (f.prefix && f.prefix !== 'undefined') ? f.prefix : '';
    const safeSuffix = (f.suffix && f.suffix !== 'undefined') ? f.suffix : '';
    const hasPrefixOrSuffix = Boolean((safePrefix && safePrefix.trim()) || (safeSuffix && safeSuffix.trim()));
    if ((rawValue === undefined || rawValue === null) && !hasPrefixOrSuffix && !isImgField) continue;
    if (rawValue === undefined || rawValue === null) rawValue = '';

    const valueStr = `${safePrefix}${rawValue}${safeSuffix}`;
    if (!valueStr.trim() && !isImgField) continue;
    const xPt = f.x * PX_TO_PT;
    const yPt = (heightPx - f.y - f.height) * PX_TO_PT - yOffsetPx * PX_TO_PT;
    const wPt = f.width  * PX_TO_PT;
    const hPt = f.height * PX_TO_PT;

    const fieldTypeLower = (f.type || 'text').toLowerCase();
    switch (fieldTypeLower) {
      case 'id':
      case 'text':
      case 'date':
      case 'number':
      case 'static_text':
      case 'static':
      case 'label': {
        try {
          const embeddedFont = await getEmbeddedFont(f);
          const fontSizePt = (f.fontSize || 20) * PX_TO_PT;
          const letterSpacingPt = (f.letterSpacing || 0) * PX_TO_PT;
          const opacity = f.opacity != null ? f.opacity : 1.0;

          let processedValue = valueStr;
          if (f.textTransform === 'uppercase') processedValue = valueStr.toUpperCase();
          else if (f.textTransform === 'lowercase') processedValue = valueStr.toLowerCase();
          else if (f.textTransform === 'capitalize') processedValue = valueStr.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

          // Test if the font can encode the text
          let canEncode = true;
          try {
            embeddedFont.encodeText(processedValue);
          } catch (e) {
            canEncode = false;
          }

          if (!canEncode) {
            // Render text onto a client-side canvas at high resolution, then embed as PNG
            const scaleFactor = 4;
            const textCanvas = document.createElement('canvas');
            textCanvas.width = f.width * scaleFactor;
            textCanvas.height = f.height * scaleFactor;
            const textCtx = textCanvas.getContext('2d');
            if (textCtx) {
              textCtx.scale(scaleFactor, scaleFactor);
              
              let fontName = 'sans-serif';
              if (f.fontFamily && f.fontFamily !== 'sans-serif') {
                const matchingFont = pressFonts.find(pf => pf.name.toLowerCase() === f.fontFamily?.toLowerCase());
                if (matchingFont) {
                  fontName = await ensureFontLoadedClient(matchingFont.name, matchingFont.fileUrl);
                } else {
                  fontName = f.fontFamily;
                }
              }
              const fontStyle = f.fontStyle && f.fontStyle !== 'normal' ? f.fontStyle : 'normal';
              const fontWeight = f.fontWeight && f.fontWeight !== 'normal' ? f.fontWeight : 'normal';
              
              textCtx.font = `${fontStyle} ${fontWeight} ${f.fontSize || 20}px "${fontName}"`;
              // Background fill (drawn before text so text renders on top)
              if (f.backgroundColor && f.backgroundColor !== 'transparent') {
                textCtx.save();
                textCtx.fillStyle = f.backgroundColor;
                textCtx.fillRect(0, 0, f.width, f.height);
                textCtx.restore();
              }
              textCtx.fillStyle = f.color || '#000000';
              textCtx.textAlign = f.align || 'left';
              textCtx.textBaseline = 'top';
              
              const measureTextSpacing = (s: string) => {
                const spacing = f.letterSpacing || 0;
                if (!spacing) return textCtx.measureText(s).width;
                let totalWidth = 0;
                for (let charIndex = 0; charIndex < s.length; charIndex++) {
                  totalWidth += textCtx.measureText(s[charIndex]).width;
                  if (charIndex < s.length - 1) {
                    totalWidth += spacing;
                  }
                }
                return totalWidth;
              };
              
              const lines = wrapWords(processedValue, f.width, measureTextSpacing);
              const lineHeight = (f.fontSize || 20) * (f.lineHeight ?? 1.2);
              const renderedHeight = lines.length * lineHeight;
              
              const halfLeading = (lineHeight - (f.fontSize || 20)) / 2;
              let startY = halfLeading;
              if (f.verticalAlign === 'center') {
                startY = (f.height - renderedHeight) / 2 + halfLeading;
              } else if (f.verticalAlign === 'bottom') {
                startY = f.height - renderedHeight + halfLeading;
              }
              
              let currentY = startY;
              lines.forEach(lineText => {
                let lineDrawX = 0;
                const lineWidth = measureTextSpacing(lineText);
                if (f.align === 'center') {
                  lineDrawX = (f.width - lineWidth) / 2;
                } else if (f.align === 'right') {
                  lineDrawX = f.width - lineWidth;
                }
                
                const spacing = f.letterSpacing || 0;
                if (spacing) {
                  let charX = lineDrawX;
                  textCtx.save();
                  textCtx.textAlign = 'left';
                  for (let charIndex = 0; charIndex < lineText.length; charIndex++) {
                    const char = lineText[charIndex];
                    textCtx.fillText(char, charX, currentY);
                    charX += textCtx.measureText(char).width + spacing;
                  }
                  textCtx.restore();
                } else {
                  textCtx.fillText(lineText, f.align === 'center' ? f.width / 2 : f.align === 'right' ? f.width : 0, currentY);
                }
                
                if (f.textDecoration && f.textDecoration !== 'none') {
                  textCtx.save();
                  textCtx.beginPath();
                  textCtx.strokeStyle = f.color || '#000000';
                  textCtx.lineWidth = Math.max(1, (f.fontSize || 20) * 0.08);
                  
                  let lineY = currentY;
                  if (f.textDecoration === 'underline') {
                    lineY = currentY + (f.fontSize || 20) * 0.95;
                  } else if (f.textDecoration === 'line-through') {
                    lineY = currentY + (f.fontSize || 20) * 0.55;
                  }
                  
                  textCtx.moveTo(lineDrawX, lineY);
                  textCtx.lineTo(lineDrawX + lineWidth, lineY);
                  textCtx.stroke();
                  textCtx.restore();
                }
                
                currentY += lineHeight;
              });
              
              const dataUrl = textCanvas.toDataURL('image/png');
              const base64 = dataUrl.split(',')[1];
              const pngBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
              const pdfImg = await pdfDoc.embedPng(pngBytes);
              page.drawImage(pdfImg, { x: xPt, y: yPt, width: wPt, height: hPt, opacity });
            }
            break;
          }

          const measureFn = (s: string) => {
            if (!letterSpacingPt) return embeddedFont.widthOfTextAtSize(s, fontSizePt);
            let w = 0;
            for (let ci = 0; ci < s.length; ci++) {
              w += embeddedFont.widthOfTextAtSize(s[ci], fontSizePt);
              if (ci < s.length - 1) w += letterSpacingPt;
            }
            return w;
          };

          const lines = wrapWordsPdf(processedValue, wPt, measureFn);
           const lineHeightPt = fontSizePt * (f.lineHeight ?? 1.2);
          const renderedHeightPt = lines.length * lineHeightPt;
          const halfLeadingPt = (lineHeightPt - fontSizePt) / 2;

          // Adjust starting Y based on vertical alignment.
          // PDF drawText y = baseline. Canvas textBaseline='top' draws from glyph top.
          // Standard ascender ratio ≈ 0.85 of fontSize.
          // So: baseline = (box_top_in_pdf) - halfLeading - fontSize*0.85
          // box_top_in_pdf = yPt + hPt (since yPt is bottom of box in PDF coords)
          const ascenderOffsetPt = fontSizePt * 0.85;
          let startYPt = yPt + hPt - halfLeadingPt - ascenderOffsetPt;
          if (f.verticalAlign === 'center') {
            startYPt -= (hPt - renderedHeightPt) / 2;
          } else if (f.verticalAlign === 'bottom') {
            startYPt -= (hPt - renderedHeightPt);
          }

          let currentYPt = startYPt;

          // Draw background fill rectangle behind text (drawn first so text appears on top)
          if (f.backgroundColor && f.backgroundColor !== 'transparent') {
            const bgRgb = hexToRgbClient(f.backgroundColor);
            page.drawRectangle({ x: xPt, y: yPt, width: wPt, height: hPt, color: bgRgb, opacity });
          }

          for (const lineText of lines) {
            if (currentYPt < yPt - lineHeightPt * 1.5 && lines.length > 1) break;
            const textWidth = measureFn(lineText);
            let lineDrawX = xPt;
            if (f.align === 'center') lineDrawX = xPt + (wPt - textWidth) / 2;
            else if (f.align === 'right') lineDrawX = xPt + wPt - textWidth;

            if (letterSpacingPt) {
              let charX = lineDrawX;
              for (let ci = 0; ci < lineText.length; ci++) {
                const ch = lineText[ci];
                page.drawText(ch, { x: charX, y: currentYPt, size: fontSizePt, font: embeddedFont, color: hexToRgbClient(f.color), opacity });
                charX += embeddedFont.widthOfTextAtSize(ch, fontSizePt) + letterSpacingPt;
              }
            } else {
              page.drawText(lineText, { x: lineDrawX, y: currentYPt, size: fontSizePt, font: embeddedFont, color: hexToRgbClient(f.color), opacity });
            }

            // Text decoration
            if (f.textDecoration && f.textDecoration !== 'none') {
              const offsetPt = f.textDecoration === 'underline' ? fontSizePt * 0.05 : fontSizePt * 0.45;
              page.drawLine({
                start: { x: lineDrawX, y: currentYPt + offsetPt },
                end:   { x: lineDrawX + textWidth, y: currentYPt + offsetPt },
                thickness: Math.max(0.5, fontSizePt * 0.08),
                color: hexToRgbClient(f.color),
                opacity,
              });
            }

            currentYPt -= lineHeightPt;
          }
        } catch (err) {
          console.error(`[PDF client] Text field error for ${f.field}:`, err);
        }
        break;
      }

      case 'image':
      case 'photo':
      case 'signature':
      case 'sig':
      case 'logo':
      case 'stamp':
      case 'img':
      case 'picture':
      case 'static_image':
      case 'static_img': {
        const imageSrc = rawValue || (f as any).imageUrl || (f as any).sampleValue || (f as any).value || (f as any).src || (f as any).url || (f as any).defaultUrl || (f as any).defaultValue;
        if (!imageSrc) continue;
        try {
          const rawUrl = String(imageSrc).trim();
          let imgArrayBuffer: ArrayBuffer | null = null;
          try {
            imgArrayBuffer = await fetchArrayBuffer(rawUrl);
          } catch (fetchErr) {
            console.warn(`[PDF client] Failed to fetchArrayBuffer for image field "${f.field}" (${rawUrl}):`, fetchErr);
          }

          if (imgArrayBuffer) {
            const bytes = new Uint8Array(imgArrayBuffer);
            const radius = f.borderRadius || 0;

            if (radius <= 0) {
              const pdfImg = await embedImageBuffer(pdfDoc, bytes);
              page.drawImage(pdfImg, { x: xPt, y: yPt, width: wPt, height: hPt });
            } else {
              const blob = new Blob([bytes]);
              const blobUrl = URL.createObjectURL(blob);
              try {
                const img = await loadImageClient(blobUrl);
                const tempCanvas = document.createElement('canvas');
                const scaleFactor = 3;
                const boxWidth = f.width * scaleFactor;
                const boxHeight = f.height * scaleFactor;
                tempCanvas.width = boxWidth;
                tempCanvas.height = boxHeight;
                const tempCtx = tempCanvas.getContext('2d');
                if (tempCtx) {
                  const radPx = Math.min(radius * scaleFactor, boxWidth / 2, boxHeight / 2);
                  tempCtx.beginPath();
                  const x = 0, y = 0, w = boxWidth, h = boxHeight, r = radPx;
                  tempCtx.moveTo(x + r, y);
                  tempCtx.lineTo(x + w - r, y);
                  tempCtx.quadraticCurveTo(x + w, y, x + w, y + r);
                  tempCtx.lineTo(x + w, y + h - r);
                  tempCtx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
                  tempCtx.lineTo(x + r, y + h);
                  tempCtx.quadraticCurveTo(x, y + h, x, y + h - r);
                  tempCtx.lineTo(x, y + r);
                  tempCtx.quadraticCurveTo(x, y, x + r, y);
                  tempCtx.closePath();
                  tempCtx.clip();

                  const imgRatio = (img.width || 1) / (img.height || 1);
                  const boxRatio = boxWidth / boxHeight;
                  let drawWidth = boxWidth;
                  let drawHeight = boxHeight;
                  let drawX = 0;
                  let drawY = 0;

                  if (imgRatio > boxRatio) {
                    drawWidth = boxHeight * imgRatio;
                    drawX = - (drawWidth - boxWidth) / 2;
                  } else {
                    drawHeight = boxWidth / imgRatio;
                    drawY = - (drawHeight - boxHeight) / 2;
                  }

                  tempCtx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
                  const dataUrl = tempCanvas.toDataURL('image/png');
                  const base64 = dataUrl.split(',')[1];
                  const pngBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
                  const pdfImg = await pdfDoc.embedPng(pngBytes);
                  page.drawImage(pdfImg, { x: xPt, y: yPt, width: wPt, height: hPt });
                }
              } finally {
                URL.revokeObjectURL(blobUrl);
              }
            }
          } else {
            // Direct load fallback
            const img = await loadImageClient(rawUrl);
            const tempCanvas = document.createElement('canvas');
            const scaleFactor = 3;
            const boxWidth = f.width * scaleFactor;
            const boxHeight = f.height * scaleFactor;
            tempCanvas.width = boxWidth;
            tempCanvas.height = boxHeight;
            const tempCtx = tempCanvas.getContext('2d');
            if (tempCtx) {
              tempCtx.drawImage(img, 0, 0, boxWidth, boxHeight);
              const dataUrl = tempCanvas.toDataURL('image/png');
              const base64 = dataUrl.split(',')[1];
              const pngBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
              const pdfImg = await pdfDoc.embedPng(pngBytes);
              page.drawImage(pdfImg, { x: xPt, y: yPt, width: wPt, height: hPt });
            }
          }
        } catch (err) {
          console.error(`[PDF client] Image field error for ${f.field}:`, err);
        }
        break;
      }

      case 'qr': {
        if (!rawValue) continue;
        try {
          const qrDataUrl = await generateQrCode(String(rawValue), 512);
          const qrBase64 = qrDataUrl.split(',')[1];
          const qrBytes = Uint8Array.from(atob(qrBase64), c => c.charCodeAt(0));
          const qrImg = await pdfDoc.embedPng(qrBytes);
          page.drawImage(qrImg, { x: xPt, y: yPt, width: wPt, height: hPt });
        } catch (err) {
          console.error('[PDF client] QR field error:', err);
        }
        break;
      }

      case 'barcode': {
        if (!rawValue) continue;
        try {
          // Render barcode onto an offscreen canvas then embed as PNG
          const barcodeCanvas = generateBarcodeCanvas(String(rawValue), f.width, f.height, 3);
          const blob: Blob = await new Promise(resolve => barcodeCanvas.toBlob(b => resolve(b!), 'image/png'));
          const barcodeBytes = await blob.arrayBuffer();
          const barcodeImg = await pdfDoc.embedPng(barcodeBytes);
          page.drawImage(barcodeImg, { x: xPt, y: yPt, width: wPt, height: hPt });
        } catch (err) {
          console.error('[PDF client] Barcode field error:', err);
        }
        break;
      }
    }
  }

  return pdfDoc.save();
}
