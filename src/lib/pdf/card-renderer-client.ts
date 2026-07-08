import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export interface FieldCoordinate {
  field: string; // name | designation | photo | cardSerial | validTill | custom_field_key...
  type: 'text' | 'image' | 'qr' | 'barcode' | 'id';
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number;
  fontWeight?: string; // normal | bold
  fontStyle?: string;  // normal | italic
  fontFamily?: string; // Arial | Georgia | Verdana | custom press font name
  color?: string;      // hex color code e.g. #000000
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
}

// Map to keep track of loaded font families in the browser
const loadedFonts = new Set<string>();

// Global caches for background templates and font files to prevent redundant HTTP downloads during compilation
const globalBgBytesCache = new Map<string, Uint8Array>();
const globalFontBytesCache = new Map<string, ArrayBuffer>();

export function getResolvedFieldValue(
  fieldKey: string,
  data: Record<string, any>,
  cardholder: {
    id?: number;
    name: string;
    designation?: string | null;
    photoUrl?: string | null;
    cardSerial?: string | null;
    uniqueKey?: string | null;
    customFields?: string | null;
  }
): any {
  if (!fieldKey) return undefined;

  // 1. Try exact match in data
  if (data[fieldKey] !== undefined && data[fieldKey] !== null) {
    return data[fieldKey];
  }

  // 2. Try normalized search in data keys
  const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const targetClean = clean(fieldKey);
  
  for (const k of Object.keys(data)) {
    if (clean(k) === targetClean) {
      if (data[k] !== undefined && data[k] !== null) {
        return data[k];
      }
    }
  }

  // 3. Fallbacks for standard fields
  if (targetClean === 'designation' || targetClean === 'class' || targetClean === 'grade' || targetClean === 'role') {
    return cardholder.designation || '';
  }
  if (
    targetClean === 'id' ||
    targetClean === 'uniqueekey' ||
    targetClean === 'uniquekey' ||
    targetClean === 'admissionnumber' ||
    targetClean === 'rollnumber' ||
    targetClean === 'admissionno' ||
    targetClean === 'studentid'
  ) {
    return cardholder.uniqueKey || cardholder.id || '';
  }
  if (targetClean === 'serial' || targetClean === 'cardserial' || targetClean === 'serialno') {
    return cardholder.cardSerial || '';
  }

  return undefined;
}

/**
 * Loads a custom font using the browser's FontFace API.
 */
export async function ensureFontLoadedClient(fontName: string, fontUrl: string): Promise<string> {
  if (typeof window === 'undefined') return 'sans-serif';
  const familyName = fontName.replace(/\s+/g, '_');
  if (loadedFonts.has(familyName)) {
    return familyName;
  }

  try {
    const font = new FontFace(familyName, `url(${fontUrl})`);
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
 * Loads an image in the browser.
 */
function loadImageClient(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // Prevent tainted canvas issues
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
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
 * by verifying the file format magic bytes.
 */
async function embedImageBuffer(pdfDoc: any, buffer: ArrayBuffer | Uint8Array) {
  const bytes = new Uint8Array(buffer);
  
  // PNG Magic Bytes: 0x89 0x50 0x4E 0x47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return pdfDoc.embedPng(buffer);
  }
  
  // JPEG Magic Bytes: 0xFF 0xD8
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    return pdfDoc.embedJpg(buffer);
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
    .filter(({ f }) => f.type === 'text' || f.type === 'id')
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
    name: string;
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
  const fields: FieldCoordinate[] = JSON.parse(fieldsJson || '[]');
  
  let bgUrl = side === 'front' ? template.frontImageUrl : template.backImageUrl;
  // For Electron: prefer the locally-cached original file (highest quality)
  // Fallback 1: Cloudinary original URL (PDF/SVG uploaded at full resolution)
  // Fallback 2: Cloudinary display/preview URL (low-res WebP)
  const originalUrl = side === 'front' ? template.frontOriginalUrl : template.backOriginalUrl;

  // Try to resolve a local cached file first (Electron)
  if (bgUrl && typeof window !== 'undefined' && (window as any).electronAPI?.getLocalTemplatePath && template.id) {
    try {
      const localPath = await (window as any).electronAPI.getLocalTemplatePath({
        templateId: template.id,
        side,
      });
      if (localPath) {
        bgUrl = `local://${localPath}`;
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
      if (bgUrl.endsWith('.pdf')) {
        absoluteBgUrl = bgUrl.replace('.pdf', '.png');
      } else if (bgUrl.toLowerCase().endsWith('.svg')) {
        if (bgUrl.includes('/image/upload/')) {
          absoluteBgUrl = bgUrl.replace('/image/upload/', '/image/upload/w_2000/').replace('.svg', '.png');
        } else {
          absoluteBgUrl = bgUrl.replace('.svg', '.png');
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
  const customData = cardholder.customFields ? JSON.parse(cardholder.customFields) : {};

  // Formatted date string for validTill
  let formattedValidTill = '';
  if (validTillDate) {
    const date = new Date(validTillDate);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    formattedValidTill = `${months[date.getMonth()]} ${date.getFullYear()}`;
  }

  const data: Record<string, any> = {
    name: cardholder.name,
    designation: cardholder.designation || '',
    photo: cardholder.photoUrl || '',
    cardSerial: cardholder.cardSerial || '',
    validTill: formattedValidTill,
    ...customData,
  };

  // 4. Pre-compute Y offsets
  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d');
  
  const getClientValueStr = (f: FieldCoordinate) => {
    let rv = f.type === 'id' ? (cardholder.uniqueKey || cardholder.id) : getResolvedFieldValue(f.field, data, cardholder);
    if (f.type === 'image' && !rv) {
      const isProfileField = ['photo', 'avatar', 'image', 'profile', 'pic', 'picture'].some(kw => f.field.toLowerCase().includes(kw));
      if (isProfileField) {
        rv = cardholder.photoUrl || '';
      }
    }
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
    let rawValue = f.type === 'id' ? (cardholder.uniqueKey || cardholder.id) : getResolvedFieldValue(f.field, data, cardholder);
    if (f.type === 'image' && !rawValue) {
      const isProfileField = ['photo', 'avatar', 'image', 'profile', 'pic', 'picture'].some(kw => f.field.toLowerCase().includes(kw));
      if (isProfileField) {
        rawValue = cardholder.photoUrl || '';
      }
    }
    if (rawValue === undefined || rawValue === null) continue;

    const valueStr = `${f.prefix || ''}${rawValue}${f.suffix || ''}`;
    const effectiveY = f.y + yOffset;

    switch (f.type) {
      case 'id':
      case 'text': {
        ctx.save();

        let processedValue = valueStr;
        if (f.textTransform === 'uppercase') {
          processedValue = valueStr.toUpperCase();
        } else if (f.textTransform === 'lowercase') {
          processedValue = valueStr.toLowerCase();
        } else if (f.textTransform === 'capitalize') {
          processedValue = valueStr.replace(/\b\w/g, c => c.toUpperCase());
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

      case 'image': {
        if (!rawValue) continue;
        try {
          const img = await loadImageClient(String(rawValue));
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
        } catch (err) {
          console.error(`Error loading browser image field ${f.field}:`, err);
          ctx.strokeStyle = '#ff0000';
          ctx.lineWidth = 1;
          ctx.strokeRect(f.x, effectiveY, f.width, f.height);
        }
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
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed for ${url}: ${res.statusText}`);
  return res.arrayBuffer();
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
  },
  cardholder: {
    id?: number;
    name: string;
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

  // Resolve local paths or download cache if running in Electron
  let finalBgUrl = originalUrl || previewUrl;
  let resolvedLocally = false;

  if (finalBgUrl && typeof window !== 'undefined' && (window as any).electronAPI?.getLocalTemplatePath && template.id) {
    try {
      let localPath = await (window as any).electronAPI.getLocalTemplatePath({
        templateId: template.id,
        side,
      });

      // Auto-download and cache template locally if missing and online
      if (!localPath && originalUrl) {
        try {
          console.log(`[PDF client] Template ${template.id} ${side} not cached locally. Downloading original...`);
          const arrayBuffer = await fetchArrayBuffer(originalUrl);
          
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
              fileName: originalUrl,
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
        finalBgUrl = `local://${localPath}`;
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
        if (!bgBytes && resolvedLocally && previewUrl) {
          try {
            console.log(`[PDF client] Local original template load failed, trying preview URL: ${previewUrl}`);
            bgBytes = new Uint8Array(await fetchArrayBuffer(previewUrl));
            bgBufferSource = previewUrl;
            globalBgBytesCache.set(previewUrl, bgBytes);
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
            if (globalBgBytesCache.has(resolvedUrl)) {
              finalBytes = globalBgBytesCache.get(resolvedUrl)!;
            } else {
              finalBytes = new Uint8Array(await fetchArrayBuffer(resolvedUrl));
              globalBgBytesCache.set(resolvedUrl, finalBytes);
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
  const customData = cardholder.customFields ? JSON.parse(cardholder.customFields) : {};

  let formattedValidTill = '';
  if (validTillDate) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    formattedValidTill = `${months[validTillDate.getMonth()]} ${validTillDate.getFullYear()}`;
  }

  const data: Record<string, any> = {
    name: cardholder.name,
    designation: cardholder.designation || '',
    photo: cardholder.photoUrl || '',
    cardSerial: cardholder.cardSerial || '',
    validTill: formattedValidTill,
    ...customData,
  };

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

  // Map common system/web font names to pdf-lib StandardFonts (bold = weight >= 700)
  const resolveStandardFont = (family: string, weightNum: number, isItalic: boolean): string | null => {
    const isBoldStd = weightNum >= 700;
    const n = family.toLowerCase().replace(/[\s-_]+/g, '');
    const timesAliases = ['timesnewroman', 'times', 'timesroman', 'georgia', 'garamond', 'palatino', 'bookantiqua', 'palatinolinotype'];
    const courierAliases = ['couriernew', 'courier', 'lucidaconsole', 'consolascourier'];
    const helveticaAliases = ['arial', 'helvetica', 'arialnarrow', 'calibri', 'tahoma', 'verdana', 'trebuchetms', 'gillsans', 'centuryschoolbook'];
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
    return null;
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
    // Final fallback: Helvetica with bold collapsed at >=700
    const isBoldFallback = weightNum >= 700;
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

  // Embed all unique fonts used by text/id fields beforehand so computeYOffsets is fast and synchronous
  for (const f of fields) {
    if (f.type !== 'text' && f.type !== 'id') continue;
    await getEmbeddedFont(f);
  }

  const getPdfValueStr = (f: FieldCoordinate) => {
    if (f.staticValue !== undefined && f.staticValue !== null) {
      return `${f.prefix || ''}${f.staticValue}${f.suffix || ''}`;
    }
    let rv = f.type === 'id' ? (cardholder.uniqueKey || cardholder.id) : getResolvedFieldValue(f.field, data, cardholder);
    if (f.type === 'image' && !rv) {
      const isProfileField = ['photo', 'avatar', 'image', 'profile', 'pic', 'picture'].some(kw => f.field.toLowerCase().includes(kw));
      if (isProfileField) {
        rv = cardholder.photoUrl || '';
      }
    }
    if (rv === undefined || rv === null) return '';
    return `${f.prefix || ''}${rv}${f.suffix || ''}`;
  };

  const pdfMeasureProxy = (f: FieldCoordinate, s: string) => {
    // Get preloaded font from cache — mirrors the weight-aware logic in getEmbeddedFont
    let embeddedFont;
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

      for (const candidate of candidates) {
        const match = pressFonts.find(pf => pf.name.toLowerCase() === candidate);
        if (match) { embeddedFont = fontCache.get(match.fileUrl); break; }
      }

      if (!embeddedFont) {
        const mappedStd = resolveStandardFont(f.fontFamily, weightNum, isItalic);
        if (mappedStd) embeddedFont = fontCache.get(mappedStd);
      }
    }
    if (!embeddedFont) {
      const isBoldFallback = weightNum >= 700;
      const stdFont =
        isBoldFallback && isItalic ? StandardFonts.HelveticaBoldOblique
        : isBoldFallback           ? StandardFonts.HelveticaBold
        : isItalic                 ? StandardFonts.HelveticaOblique
        :                            StandardFonts.Helvetica;
      embeddedFont = fontCache.get(stdFont);
    }
    const fontSizePt = (f.fontSize || 20) * PX_TO_PT;
    if (!embeddedFont) return s.length * fontSizePt * 0.55 / PX_TO_PT;

    const letterSpacingPt = (f.letterSpacing || 0) * PX_TO_PT;
    let wPt = 0;
    if (!letterSpacingPt) {
      wPt = embeddedFont.widthOfTextAtSize(s, fontSizePt);
    } else {
      for (let ci = 0; ci < s.length; ci++) {
        wPt += embeddedFont.widthOfTextAtSize(s[ci], fontSizePt);
        if (ci < s.length - 1) wPt += letterSpacingPt;
      }
    }
    return wPt / PX_TO_PT;
  };

  const pdfYOffsets = computeYOffsets(fields, pdfMeasureProxy, getPdfValueStr);

  // ── 5. Draw fields ───────────────────────────────────────────────────────
  for (let fi = 0; fi < fields.length; fi++) {
    const f = fields[fi];
    const yOffsetPx = pdfYOffsets.get(fi) ?? 0;
    let rawValue = f.type === 'id' ? (cardholder.uniqueKey || cardholder.id) : getResolvedFieldValue(f.field, data, cardholder);

    // Photo field fallback
    if (f.type === 'image' && !rawValue) {
      const isProfile = ['photo', 'avatar', 'image', 'profile', 'pic', 'picture'].some(kw => f.field.toLowerCase().includes(kw));
      const isOnlyImg = fields.filter(x => x.type === 'image').length === 1;
      if (isProfile) rawValue = cardholder.photoUrl || '';
    }
    if (rawValue === undefined || rawValue === null) continue;

    const valueStr = `${f.prefix || ''}${rawValue}${f.suffix || ''}`;
    const xPt = f.x * PX_TO_PT;
    const yPt = (heightPx - f.y - f.height) * PX_TO_PT - yOffsetPx * PX_TO_PT;
    const wPt = f.width  * PX_TO_PT;
    const hPt = f.height * PX_TO_PT;

    switch (f.type) {
      case 'id':
      case 'text': {
        try {
          const embeddedFont = await getEmbeddedFont(f);
          const fontSizePt = (f.fontSize || 20) * PX_TO_PT;
          const letterSpacingPt = (f.letterSpacing || 0) * PX_TO_PT;
          const opacity = f.opacity != null ? f.opacity : 1.0;

          let processedValue = valueStr;
          if (f.textTransform === 'uppercase') processedValue = valueStr.toUpperCase();
          else if (f.textTransform === 'lowercase') processedValue = valueStr.toLowerCase();
          else if (f.textTransform === 'capitalize') processedValue = valueStr.replace(/\b\w/g, c => c.toUpperCase());

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

          // Adjust starting Y based on vertical alignment
          let startYPt = yPt + hPt - fontSizePt - halfLeadingPt;
          if (f.verticalAlign === 'center') {
            startYPt -= (hPt - renderedHeightPt) / 2;
          } else if (f.verticalAlign === 'bottom') {
            startYPt -= (hPt - renderedHeightPt);
          }

          let currentYPt = startYPt;

          for (const lineText of lines) {
            if (currentYPt < yPt) break;
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

      case 'image': {
        if (!rawValue) continue;
        try {
          const imgUrl = String(rawValue);
          const img = await loadImageClient(imgUrl);

          const tempCanvas = document.createElement('canvas');
          const scaleFactor = 3;
          const boxWidth = f.width * scaleFactor;
          const boxHeight = f.height * scaleFactor;
          tempCanvas.width = boxWidth;
          tempCanvas.height = boxHeight;
          const tempCtx = tempCanvas.getContext('2d');
          
          if (tempCtx) {
            const radius = Math.min((f.borderRadius || 0) * scaleFactor, boxWidth / 2, boxHeight / 2);
            tempCtx.beginPath();
            if (radius > 0) {
              const x = 0, y = 0, w = boxWidth, h = boxHeight, r = radius;
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
            } else {
              tempCtx.rect(0, 0, boxWidth, boxHeight);
            }
            tempCtx.clip();

            const imgRatio = img.width / img.height;
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
