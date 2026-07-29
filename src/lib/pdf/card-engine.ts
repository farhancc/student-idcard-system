import { createCanvas, loadImage, registerFont } from 'canvas';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import fs from 'fs';
import path from 'path';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { getResolvedFieldValue, resolveCardholderPhotoUrl, isPrimaryPhotoField, isValidImageUrl, resolveFieldRawValue, isPlaceholderStaticValue } from './field-resolver';

// Helper to resolve SVG to high-resolution PNG URL
function resolveSvgToPng(url: string, width = 3000): string {
  if (!url) return '';
  if (url.toLowerCase().endsWith('.svg')) {
    if (url.includes('/image/upload/')) {
      // Cloudinary URL: request high clarity transformation
      return url.replace('/image/upload/', `/image/upload/w_${width}/`).replace('.svg', '.png');
    }
    return url.replace('.svg', '.png');
  }
  return url;
}



// Helper to convert hex to RGB for pdf-lib
function hexToRgb(hex?: string) {
  if (!hex) return rgb(0, 0, 0);
  const cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    const r = parseInt(cleanHex.substring(0, 1).repeat(2), 16) / 255;
    const g = parseInt(cleanHex.substring(1, 2).repeat(2), 16) / 255;
    const b = parseInt(cleanHex.substring(2, 3).repeat(2), 16) / 255;
    return rgb(isNaN(r) ? 0 : r, isNaN(g) ? 0 : g, isNaN(b) ? 0 : b);
  }
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
  return rgb(isNaN(r) ? 0 : r, isNaN(g) ? 0 : g, isNaN(b) ? 0 : b);
}

// Global caches for background templates and font files to prevent redundant downloads/reads during compilation
const globalBgBufferCache = new Map<string, Buffer>();
const globalFontBufferCache = new Map<string, Buffer>();

// Helper to load file (local or HTTP) as a Buffer
async function getFileBuffer(fileUrl: string): Promise<Buffer> {
  if (!fileUrl) throw new Error('File URL is empty');

  if (fileUrl.startsWith('data:')) {
    const commaIndex = fileUrl.indexOf(',');
    if (commaIndex !== -1) {
      const base64Data = fileUrl.substring(commaIndex + 1);
      return Buffer.from(base64Data, 'base64');
    }
  }

  const cleanUrl = fileUrl.split('?')[0];

  // local:// is the Electron custom protocol — on the server, strip the scheme
  // and read the file directly from disk using the absolute path embedded in the URL.
  if (cleanUrl.startsWith('local://')) {
    let localPath = cleanUrl.replace(/^local:\/\//i, '');
    if (process.platform === 'win32') {
      if (localPath.startsWith('/')) {
        localPath = localPath.slice(1);
      }
    } else {
      if (!localPath.startsWith('/')) {
        localPath = '/' + localPath;
      }
    }
    localPath = decodeURIComponent(localPath);
    if (fs.existsSync(localPath)) {
      return fs.readFileSync(localPath);
    }
    throw new Error(`[card-engine] local:// file not found on server: ${localPath}`);
  }

  // file:// protocol handling
  if (cleanUrl.startsWith('file://')) {
    let filePath = cleanUrl.replace(/^file:\/\//i, '');
    if (process.platform === 'win32' && filePath.startsWith('/')) {
      filePath = filePath.slice(1);
    }
    filePath = decodeURIComponent(filePath);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath);
    }
  }

  // Check if direct cleanUrl path exists on disk
  if (fs.existsSync(cleanUrl)) {
    return fs.readFileSync(cleanUrl);
  }

  // Extract relative /uploads/... path if present in URL (even HTTP URLs)
  let cleanRelPath = cleanUrl;
  if (cleanUrl.includes('/uploads/')) {
    cleanRelPath = cleanUrl.substring(cleanUrl.indexOf('/uploads/'));
  } else if (cleanUrl.includes('uploads/')) {
    cleanRelPath = '/' + cleanUrl.substring(cleanUrl.indexOf('uploads/'));
  } else if (cleanUrl.startsWith('/')) {
    cleanRelPath = cleanUrl;
  }

  if (cleanRelPath.startsWith('/')) {
    const publicPath = path.join(/*turbopackIgnore: true*/ process.cwd(), 'public', cleanRelPath);
    if (fs.existsSync(publicPath)) {
      return fs.readFileSync(publicPath);
    }

    // Remote fallback for relative uploads when running in desktop app or remote runner
    const portalUrl = (typeof process !== 'undefined' && process.env && process.env.PORTAL_URL) || 'https://idexocards.vercel.app';
    const remoteUrl = `${portalUrl}${cleanRelPath}`;
    try {
      const res = await fetch(remoteUrl, { cache: 'no-store' });
      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer();
        return Buffer.from(arrayBuffer);
      }
    } catch (e) {
      console.warn(`[card-engine] Could not fetch relative image from portal ${remoteUrl}:`, e);
    }
  }

  if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
    const res = await fetch(fileUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to download file: ${res.statusText}`);
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  const publicPath = path.join(/*turbopackIgnore: true*/ process.cwd(), 'public', cleanUrl);
  if (fs.existsSync(publicPath)) {
    return fs.readFileSync(publicPath);
  }

  throw new Error(`File not found: ${cleanUrl}`);
}

/**
 * Safe image loader that handles HTTP URLs and local files via getFileBuffer.
 */
async function safeLoadImage(urlOrPath: string): Promise<any> {
  try {
    const buffer = await getFileBuffer(urlOrPath);
    return await loadImage(buffer);
  } catch (err) {
    console.error(`[safeLoadImage] Failed to load image from buffer, falling back to direct loadImage for: ${urlOrPath}`, err);
    return await loadImage(urlOrPath);
  }
}



/**
 * Robust helper to dynamically embed an image buffer as either PNG or JPEG
 * by verifying the file format magic bytes.
 */
async function embedImageBuffer(pdfDoc: any, buffer: Buffer | ArrayBuffer | Uint8Array) {
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

// Coordinate layout field mapping format
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
  staticValue?: string; // For non-editable constant text or static image URLs/base64
}

// Map to keep track of registered font families to prevent double registration warnings
const registeredFonts = new Set<string>();

export { isPlaceholderStaticValue };

/**
 * Downloads a font from a URL or registers it from local path in node-canvas.
 */
export async function ensureFontRegistered(fontName: string, fontUrl: string): Promise<string> {
  const familyName = fontName.replace(/\s+/g, '_'); // sanitize family name
  if (registeredFonts.has(familyName)) {
    return familyName;
  }

  try {
    let filePath = fontUrl;
    
    if (fontUrl.startsWith('data:')) {
      const cacheDir = path.join('/tmp', 'idexo', 'fonts');
      fs.mkdirSync(cacheDir, { recursive: true });
      
      const mime = fontUrl.split(';')[0]?.split(':')[1] || '';
      const ext = mime.includes('otf') ? 'otf' : mime.includes('woff2') ? 'woff2' : mime.includes('woff') ? 'woff' : 'ttf';
      filePath = path.join(cacheDir, `${familyName}.${ext}`);

      if (!fs.existsSync(filePath)) {
        const commaIndex = fontUrl.indexOf(',');
        if (commaIndex !== -1) {
          const base64Data = fontUrl.substring(commaIndex + 1);
          fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
        }
      }
    } else if (fontUrl.startsWith('/')) {
      filePath = path.join(/*turbopackIgnore: true*/ process.cwd(), 'public', fontUrl);
    } else if (fontUrl.startsWith('http')) {
      // In production (e.g. Vercel), download font to writeable /tmp cache directory to prevent EROFS
      const cacheDir = path.join('/tmp', 'idexo', 'fonts');
      fs.mkdirSync(cacheDir, { recursive: true });
      filePath = path.join(cacheDir, `${familyName}.ttf`);

      if (!fs.existsSync(filePath)) {
        const res = await fetch(fontUrl);
        if (!res.ok) throw new Error(`Failed to download font: ${res.statusText}`);
        const buffer = await res.arrayBuffer();
        fs.writeFileSync(filePath, Buffer.from(buffer));
      }
    }

    if (fs.existsSync(filePath)) {
      registerFont(filePath, { family: familyName });
      registeredFonts.add(familyName);
      console.log(`Registered font family: ${familyName} from ${filePath}`);
      return familyName;
    }
  } catch (error) {
    console.error(`Error registering font ${fontName}:`, error);
  }

  // Fallback to sans-serif if registration fails
  return 'sans-serif';
}

/**
 * Generates a QR Code as a Data URL buffer.
 */
async function generateQrCode(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    margin: 1,
    width: 256,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  });
}

/**
 * Generates a Barcode on a node-canvas and returns its image loadable canvas instance.
 */
function generateBarcodeCanvas(text: string, width: number, height: number) {
  const canvas = createCanvas(width, height);
  try {
    JsBarcode(canvas, text, {
      format: 'CODE128',
      displayValue: false,
      margin: 2,
    });
  } catch (err) {
    console.error('Barcode generation error:', err);
    // Draw cross outline on error
    const ctx = canvas.getContext('2d');
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
  return canvas;
}

/**
 * Measure how many lines a string wraps to given a max pixel width and a
 * measureFn that returns the pixel width of a string.
 */
function wrapWords(text: string, maxWidth: number, measureFn: (s: string) => number): string[] {
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
 * For every text field that wraps beyond its declared height, accumulate extra
 * pixels that must be added to the Y coordinate of every field whose top edge
 * sits at or below the bottom of the overflowing field.
 *
 * Returns a Map<fieldIndex, extraYOffset> — the cumulative offset already
 * applied to that field (callers add it directly to f.y before drawing).
 *
 * measureFn(fieldIndex, text) → pixel width of `text` for that field's font.
 */
function computeYOffsets(
  fields: FieldCoordinate[],
  measureFn: (f: FieldCoordinate, text: string) => number,
  getValueStr: (f: FieldCoordinate) => string
): Map<number, number> {
  // Build cumulative offset per field index
  const offsets = new Map<number, number>();
  for (let i = 0; i < fields.length; i++) offsets.set(i, 0);

  // Process fields in top-to-bottom order of their *original* Y
  const sorted = fields
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => f.type === 'text' || f.type === 'id')
    .sort((a, b) => a.f.y - b.f.y);

  // Track overflow added by each field so we can shift later fields
  // We work with *effective* Y (original + accumulated offset from earlier fields)
  const effectiveY = fields.map((f) => f.y); // copy

  for (const { f, i } of sorted) {
    const lineHeight = (f.fontSize || 20) * (f.lineHeight ?? 1.2);
    const valueStr = getValueStr(f);
    const lines = wrapWords(valueStr, f.width, (s) => measureFn(f, s));
    const renderedHeight = lines.length * lineHeight;
    const declaredHeight = f.height;
    const overflow = Math.max(0, renderedHeight - declaredHeight);

    if (overflow <= 0) continue;

    // The bottom of this field after reflow (track for correctness)
    const fieldBottom = effectiveY[i] + renderedHeight;
    void fieldBottom;

    // Shift every field whose effective top is at or below this field's original bottom
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
 * Render a single card side (front/back) using Canvas
 */
export async function renderCardSide(
  template: {
    cardWidth: number;
    cardHeight: number;
    frontImageUrl: string;
    backImageUrl: string | null;
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
): Promise<Buffer> {
  const width = template.cardWidth;
  const height = template.cardHeight;

  const fieldsJson = side === 'front' ? template.frontFields : template.backFields;
  const fields: FieldCoordinate[] = JSON.parse(fieldsJson || '[]');
  const bgUrl = side === 'front' ? template.frontImageUrl : template.backImageUrl;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // 1. Draw solid white background to flatten transparency (ensuring no transparency for PDF/X compliance)
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // 2. Draw Background
  if (bgUrl) {
    try {
      let absoluteBgPath = bgUrl;
      const lowerBg = bgUrl.toLowerCase();
      if (lowerBg.includes('.pdf')) {
        if (bgUrl.includes('/templates/originals/')) {
          absoluteBgPath = bgUrl.replace('/templates/originals/', '/templates/previews/').replace(/\.pdf(\?|$)/i, '.png$1');
        } else {
          absoluteBgPath = bgUrl.replace(/\.pdf(\?|$)/i, '.png$1');
        }
      } else if (lowerBg.includes('.svg')) {
        absoluteBgPath = resolveSvgToPng(bgUrl, 2000);
      }
      // Resolve local path if relative
      if (absoluteBgPath.startsWith('/')) {
        absoluteBgPath = path.join(/*turbopackIgnore: true*/ process.cwd(), 'public', absoluteBgPath);
      }
      const bg = await safeLoadImage(absoluteBgPath);
      ctx.drawImage(bg, 0, 0, width, height);
    } catch (err) {
      console.error(`Error loading background image ${bgUrl}:`, err);
      // Fallback: draw grey placeholder background
      ctx.fillStyle = side === 'front' ? '#EBF0F5' : '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#888888';
      ctx.font = '24px sans-serif';
      ctx.fillText(`Error Loading Background (${side})`, 40, height / 2);
    }
  } else {
    // Back is blank white if template has no back image
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
  }

  // 2. Parse Custom Fields JSON
  const customData = cardholder.customFields ? JSON.parse(cardholder.customFields) : {};
  const chUniqueKey = cardholder.uniqueKey || customData.uniqueKey || customData.id || customData.unique_key || '';

  // Formatted date string for validTill
  let formattedValidTill = '';
  if (validTillDate) {
    const date = new Date(validTillDate);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    formattedValidTill = `${months[date.getMonth()]} ${date.getFullYear()}`;
  }

  // Combine core properties and custom properties
  const data: Record<string, any> = {
    name: cardholder.name || '',
    designation: cardholder.designation || '',
    photo: cardholder.photoUrl || '',
    cardSerial: cardholder.cardSerial || '',
    uniqueKey: chUniqueKey,
    id: chUniqueKey,
    validTill: formattedValidTill,
    ...customData,
  };

  // 3. Pre-compute Y offsets to reflow fields that wrap beyond their declared height
  // Pre-register fonts first to ensure accurate text width measurements
  for (const f of fields) {
    if (f.type !== 'text' && f.type !== 'id') continue;
    if (f.fontFamily && f.fontFamily !== 'sans-serif') {
      const matchingFont = pressFonts.find(pf => pf.name.toLowerCase() === f.fontFamily?.toLowerCase());
      if (matchingFont) {
        try {
          await ensureFontRegistered(matchingFont.name, matchingFont.fileUrl);
        } catch (err) {
          console.error(`Error pre-registering font ${matchingFont.name}:`, err);
        }
      }
    }
  }

  // We need a temporary canvas ctx to measure text widths per field
  const tempCtx = createCanvas(1, 1).getContext('2d');

  const getCanvasValueStr = (f: FieldCoordinate) => {
    const rv = resolveFieldRawValue(f, data, cardholder);
    if (rv === undefined || rv === null) return '';
    return `${f.prefix || ''}${rv}${f.suffix || ''}`;
  };
  const canvasMeasure = (f: FieldCoordinate, s: string) => {
    let fontName = 'sans-serif';
    if (f.fontFamily && f.fontFamily !== 'sans-serif') {
      const matchingFont = pressFonts.find(pf => pf.name.toLowerCase() === f.fontFamily?.toLowerCase());
      if (matchingFont) {
        fontName = matchingFont.name;
      } else {
        fontName = f.fontFamily;
      }
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
  const yOffsets = computeYOffsets(fields, canvasMeasure, getCanvasValueStr);

  // 4. Draw mapped fields
  for (let fi = 0; fi < fields.length; fi++) {
    const f = fields[fi];
    const yOffset = yOffsets.get(fi) ?? 0;
    const rawValue = resolveFieldRawValue(f, data, cardholder);
    if (rawValue === undefined || rawValue === null) continue;

    // Apply prefix/suffix
    const valueStr = `${f.prefix || ''}${rawValue}${f.suffix || ''}`;
    const effectiveY = f.y + yOffset;

    switch (f.type) {
      case 'id':
      case 'text': {
        ctx.save();

        // Apply text transform
        let processedValue = valueStr;
        if (f.textTransform === 'uppercase') {
          processedValue = valueStr.toUpperCase();
        } else if (f.textTransform === 'lowercase') {
          processedValue = valueStr.toLowerCase();
        } else if (f.textTransform === 'capitalize') {
          processedValue = valueStr.replace(/\b\w/g, c => c.toUpperCase());
        }

        // Apply opacity
        if (f.opacity != null) {
          ctx.globalAlpha = f.opacity;
        }

        // Register custom font if it is mapped
        let fontName = 'sans-serif';
        if (f.fontFamily && f.fontFamily !== 'sans-serif') {
          const matchingFont = pressFonts.find(pf => pf.name.toLowerCase() === f.fontFamily?.toLowerCase());
          if (matchingFont) {
            fontName = await ensureFontRegistered(matchingFont.name, matchingFont.fileUrl);
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

        // Helper to measure text width taking letterSpacing into account
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

        // Clip to the bounding box of the text field
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

          // Render text with letter spacing
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

          // Render text decoration (underline / line-through)
          if (f.textDecoration && f.textDecoration !== 'none') {
            ctx.save();
            ctx.beginPath();
            ctx.strokeStyle = f.color || '#000000';
            ctx.lineWidth = Math.max(1, (f.fontSize || 20) * 0.08); // proportional thickness
            
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
          let absoluteImgPath = rawValue;
          if (rawValue.startsWith('/')) {
            absoluteImgPath = path.join(/*turbopackIgnore: true*/ process.cwd(), 'public', rawValue);
          }
          const img = await safeLoadImage(absoluteImgPath);

          ctx.save();
          // Draw image inside bounding box with optional border radius
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
            // Image is wider than box -> crop sides
            drawWidth = f.height * imgRatio;
            drawX = f.x - (drawWidth - f.width) / 2;
          } else {
            // Image is taller than box -> crop top/bottom
            drawHeight = f.width / imgRatio;
            drawY = effectiveY - (drawHeight - f.height) / 2;
          }

          ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
          ctx.restore();
        } catch (err) {
          console.error(`Error loading image field ${f.field} from ${rawValue}:`, err);
          // Draw red cross placeholder on error
          ctx.strokeStyle = '#ff0000';
          ctx.lineWidth = 1;
          ctx.strokeRect(f.x, effectiveY, f.width, f.height);
        }
        break;
      }

      case 'qr': {
        if (!rawValue) continue;
        try {
          const qrDataUrl = await generateQrCode(String(rawValue));
          const qrImg = await safeLoadImage(qrDataUrl);
          ctx.drawImage(qrImg, f.x, effectiveY, f.width, f.height);
        } catch (err) {
          console.error('QR code render error:', err);
        }
        break;
      }

      case 'barcode': {
        if (!rawValue) continue;
        try {
          const barcodeCanvas = generateBarcodeCanvas(String(rawValue), f.width, f.height);
          ctx.drawImage(barcodeCanvas, f.x, effectiveY, f.width, f.height);
        } catch (err) {
          console.error('Barcode render error:', err);
        }
        break;
      }
    }
  }

  return canvas.toBuffer('image/png');
}

/**
 * Render a single card side (front/back) using pdf-lib (vector layout)
 */
export async function renderCardSideToPdfBytes(
  template: {
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
): Promise<Buffer> {
  const widthPx = template.cardWidth;
  const heightPx = template.cardHeight;
  
  // Convert pixels at 300 DPI to points (1 px = 72/300 pt = 0.24 pt)
  const widthPt = widthPx * 0.24;
  const heightPt = heightPx * 0.24;

  const fieldsJson = side === 'front' ? template.frontFields : template.backFields;
  const fields: FieldCoordinate[] = JSON.parse(fieldsJson || '[]');

  // Prefer the original high-res vector/PDF asset over the display preview image
  const originalUrl = side === 'front' ? (template.frontOriginalUrl ?? null) : (template.backOriginalUrl ?? null);
  const previewUrl = side === 'front' ? template.frontImageUrl : template.backImageUrl;

  // Use original if it is a PDF (true vector), otherwise fall back to preview
  // Use originalUrl if available to preserve vector quality
  const bgUrl = originalUrl || previewUrl;

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([widthPt, heightPt]);

  // 1. Draw solid white background
  page.drawRectangle({
    x: 0,
    y: 0,
    width: widthPt,
    height: heightPt,
    color: rgb(1, 1, 1),
  });

  // 2. Draw Background — embed as vector PDF page when possible, else raster image
  if (bgUrl) {
    try {
      let bgBuffer: Buffer | null = null;
      let bgBufferSource = '';
      const cacheKey = template.version ? `${bgUrl}?v=${template.version}` : bgUrl;

      if (globalBgBufferCache.has(cacheKey)) {
        bgBuffer = globalBgBufferCache.get(cacheKey)!;
        bgBufferSource = bgUrl;
      } else {
        if (originalUrl) {
          try {
            // Append cache busting parameters to HTTP fetches
            const originalUrlBusted = (template.version && (originalUrl.startsWith('http://') || originalUrl.startsWith('https://')))
              ? `${originalUrl}${originalUrl.includes('?') ? '&' : '?'}v=${template.version}`
              : originalUrl;
            bgBuffer = await getFileBuffer(originalUrlBusted);
            bgBufferSource = originalUrl;
            globalBgBufferCache.set(cacheKey, bgBuffer);
          } catch (err) {
            console.warn(`[PDF server] Failed to load original background (${originalUrl}), falling back to preview:`, err);
          }
        }

        if (!bgBuffer && previewUrl) {
          try {
            // Append cache busting parameters to HTTP fetches
            const previewUrlBusted = (template.version && (previewUrl.startsWith('http://') || previewUrl.startsWith('https://')))
              ? `${previewUrl}${previewUrl.includes('?') ? '&' : '?'}v=${template.version}`
              : previewUrl;
            bgBuffer = await getFileBuffer(previewUrlBusted);
            bgBufferSource = previewUrl;
            globalBgBufferCache.set(cacheKey, bgBuffer);
          } catch (err) {
            console.error(`[PDF server] Failed to load preview background (${previewUrl}):`, err);
          }
        }
      }

      if (bgBuffer) {
        // Sniff bytes to determine if the loaded background is a PDF
        const isPdf = bgBuffer[0] === 0x25 && bgBuffer[1] === 0x50 && bgBuffer[2] === 0x44 && bgBuffer[3] === 0x46 && bgBuffer[4] === 0x2d; // %PDF-

        if (isPdf) {
          // ── Vector path: embed the PDF page directly (preserves all vector paths) ──
          const bgPdf = await PDFDocument.load(bgBuffer);
          const [embeddedPage] = await pdfDoc.embedPdf(bgPdf, [0]);
          page.drawPage(embeddedPage, {
            x: 0,
            y: 0,
            width: widthPt,
            height: heightPt,
          });
        } else {
          // ── Raster fallback: embed PNG / JPEG preview ──
          const lowerSource = bgBufferSource.toLowerCase();
          const targetBgUrl = lowerSource.includes('.svg') ? resolveSvgToPng(bgBufferSource, 3000) : bgBufferSource;
          
          let finalBuffer = bgBuffer;
          if (targetBgUrl !== bgBufferSource) {
            const targetCacheKey = template.version ? `${targetBgUrl}?v=${template.version}` : targetBgUrl;
            if (globalBgBufferCache.has(targetCacheKey)) {
              finalBuffer = globalBgBufferCache.get(targetCacheKey)!;
            } else {
              // Append cache busting parameters to HTTP fetches
              const targetBgUrlBusted = (template.version && (targetBgUrl.startsWith('http://') || targetBgUrl.startsWith('https://')))
                ? `${targetBgUrl}${targetBgUrl.includes('?') ? '&' : '?'}v=${template.version}`
                : targetBgUrl;
              finalBuffer = await getFileBuffer(targetBgUrlBusted);
              globalBgBufferCache.set(targetCacheKey, finalBuffer);
            }
          }
          
          const bgImg = await embedImageBuffer(pdfDoc, finalBuffer);
          page.drawImage(bgImg, {
            x: 0,
            y: 0,
            width: widthPt,
            height: heightPt,
          });
        }
      }
    } catch (err) {
      console.error(`Error rendering PDF background from ${bgUrl}:`, err);
    }
  }

  // 3. Prepare data
  const customData = cardholder.customFields
    ? typeof cardholder.customFields === 'string'
      ? JSON.parse(cardholder.customFields)
      : cardholder.customFields
    : {};

  const chUniqueKey = cardholder.uniqueKey || customData.uniqueKey || customData.id || customData.unique_key || '';

  const effectivePhotoUrl = resolveCardholderPhotoUrl(cardholder, customData);

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
    uniqueKey: chUniqueKey,
    id: chUniqueKey,
    validTill: formattedValidTill,
    ...customData,
  };

  if (effectivePhotoUrl) {
    data.photo = effectivePhotoUrl;
    data.photoUrl = effectivePhotoUrl;
  }

  // 4. Pre-embed fonts to allow accurate text measurement in computeYOffsets
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
    const isBoldStd = weightNum >= 700; // standard fonts only have Regular and Bold
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
    if (f.fontFamily && f.fontFamily !== 'sans-serif') {
      const weightNum = resolveWeightNumber(f.fontWeight);
      const isItalic = f.fontStyle === 'italic';
      const baseName = f.fontFamily.toLowerCase();

      // Build candidate variant names to search in pressFonts (most specific first)
      // e.g. "Inter Light", "Inter 300", "Inter SemiBold", "Inter 600 Italic" etc.
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
            let fontBuffer = globalFontBufferCache.get(cacheKey);
            if (!fontBuffer) {
              fontBuffer = await getFileBuffer(match.fileUrl);
              globalFontBufferCache.set(cacheKey, fontBuffer);
            }
            fontCache.set(cacheKey, await pdfDoc.embedFont(fontBuffer));
          } catch (err) {
            console.error(`[PDF server] Font load failed for ${match.name}:`, err);
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

    // Final fallback: Helvetica with bold collapsed at ≥700
    const weightNum = resolveWeightNumber(f.fontWeight);
    const isItalic = f.fontStyle === 'italic';
    const isBoldFallback = weightNum >= 700;
    const stdFont =
      isBoldFallback && isItalic ? StandardFonts.HelveticaBoldOblique
      : isBoldFallback           ? StandardFonts.HelveticaBold
      : isItalic                 ? StandardFonts.HelveticaOblique
      :                            StandardFonts.Helvetica;
    if (!fontCache.has(stdFont)) fontCache.set(stdFont, await pdfDoc.embedFont(stdFont));
    return fontCache.get(stdFont);
  };


  // Pre-load all unique fonts used by text/id fields beforehand
  for (const f of fields) {
    if (f.type !== 'text' && f.type !== 'id') continue;
    await getEmbeddedFont(f);
  }

  const getPdfValueStr = (f: FieldCoordinate) => {
    const rv = resolveFieldRawValue(f, data, cardholder);
    if (rv === undefined || rv === null) return '';
    return `${f.prefix || ''}${rv}${f.suffix || ''}`;
  };

  const tempCanvas = createCanvas(1, 1);
  const tempCtx = tempCanvas.getContext('2d');

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
    const fontSizePt = (f.fontSize || 20) * 0.24;

    const localCanvasMeasure = (f: FieldCoordinate, textVal: string) => {
      if (!tempCtx) return textVal.length * fontSizePt * 0.55 / 0.24;
      let fontName = 'sans-serif';
      if (f.fontFamily && f.fontFamily !== 'sans-serif') {
        const matchingFont = pressFonts.find(pf => pf.name.toLowerCase() === f.fontFamily?.toLowerCase());
        if (matchingFont) {
          fontName = matchingFont.name;
        } else {
          fontName = f.fontFamily;
        }
      }
      const fontStyle = f.fontStyle && f.fontStyle !== 'normal' ? f.fontStyle : 'normal';
      const fontWeight = f.fontWeight && f.fontWeight !== 'normal' ? f.fontWeight : 'normal';
      tempCtx.font = `${fontStyle} ${fontWeight} ${f.fontSize || 20}px "${fontName}"`;

      const spacing = f.letterSpacing || 0;
      if (!spacing) return tempCtx.measureText(textVal).width;

      let totalWidth = 0;
      for (let charIndex = 0; charIndex < textVal.length; charIndex++) {
        totalWidth += tempCtx.measureText(textVal[charIndex]).width;
        if (charIndex < textVal.length - 1) {
          totalWidth += spacing;
        }
      }
      return totalWidth;
    };

    if (!embeddedFont) return localCanvasMeasure(f, s);

    const letterSpacingPt = (f.letterSpacing || 0) * 0.24;
    let wPt = 0;
    try {
      if (!letterSpacingPt) {
        wPt = embeddedFont.widthOfTextAtSize(s, fontSizePt);
      } else {
        for (let ci = 0; ci < s.length; ci++) {
          wPt += embeddedFont.widthOfTextAtSize(s[ci], fontSizePt);
          if (ci < s.length - 1) wPt += letterSpacingPt;
        }
      }
      return wPt / 0.24;
    } catch (e) {
      return localCanvasMeasure(f, s);
    }
  };

  const pdfYOffsets = computeYOffsets(fields, pdfMeasureProxy, getPdfValueStr);

  // 5. Draw fields
  for (let fi = 0; fi < fields.length; fi++) {
    const f = fields[fi];
    const yOffsetPx = pdfYOffsets.get(fi) ?? 0;
    const rawValue = resolveFieldRawValue(f, data, cardholder);
    if (rawValue === undefined || rawValue === null) continue;

    // Apply prefix/suffix
    const valueStr = `${f.prefix || ''}${rawValue}${f.suffix || ''}`;

    const xPt = f.x * 0.24;
    // Shift Y down by the pixel offset (converted to points), keeping PDF coordinate flip
    const yPt = (heightPx - f.y - f.height) * 0.24 - yOffsetPx * 0.24;
    const wPt = f.width * 0.24;
    const hPt = f.height * 0.24;

    switch (f.type) {
      case 'id':
      case 'text': {
        try {
          const embeddedFont = await getEmbeddedFont(f);

          const fontSizePt = (f.fontSize || 20) * 0.24;
          const letterSpacingPt = (f.letterSpacing || 0) * 0.24;

          // Apply text transform
          let processedValue = valueStr;
          if (f.textTransform === 'uppercase') {
            processedValue = valueStr.toUpperCase();
          } else if (f.textTransform === 'lowercase') {
            processedValue = valueStr.toLowerCase();
          } else if (f.textTransform === 'capitalize') {
            processedValue = valueStr.replace(/\b\w/g, c => c.toUpperCase());
          }

          // Test if the font can encode the text
          let canEncode = true;
          try {
            embeddedFont.encodeText(processedValue);
          } catch (e) {
            canEncode = false;
          }

          if (!canEncode) {
            // Render text onto a canvas at high resolution, then embed as PNG
            const scaleFactor = 4;
            const textCanvas = createCanvas(f.width * scaleFactor, f.height * scaleFactor);
            const textCtx = textCanvas.getContext('2d');
            if (textCtx) {
              textCtx.scale(scaleFactor, scaleFactor);
              
              let fontName = 'sans-serif';
              if (f.fontFamily && f.fontFamily !== 'sans-serif') {
                const matchingFont = pressFonts.find(pf => pf.name.toLowerCase() === f.fontFamily?.toLowerCase());
                if (matchingFont) {
                  fontName = matchingFont.name;
                } else {
                  fontName = f.fontFamily;
                }
              }
              const fontStyle = f.fontStyle && f.fontStyle !== 'normal' ? f.fontStyle : 'normal';
              const fontWeight = f.fontWeight && f.fontWeight !== 'normal' ? f.fontWeight : 'normal';
              
              textCtx.font = `${fontStyle} ${fontWeight} ${f.fontSize || 20}px "${fontName}"`;
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
              
              const textPngBuffer = textCanvas.toBuffer('image/png');
              const pdfImg = await pdfDoc.embedPng(textPngBuffer);
              page.drawImage(pdfImg, { x: xPt, y: yPt, width: wPt, height: hPt });
            }
            break;
          }

          // Helper to measure text width taking letterSpacing into account in PDF space
          const measureTextSpacingPt = (s: string) => {
            if (!letterSpacingPt) return embeddedFont.widthOfTextAtSize(s, fontSizePt);
            let totalWidth = 0;
            for (let charIndex = 0; charIndex < s.length; charIndex++) {
              totalWidth += embeddedFont.widthOfTextAtSize(s[charIndex], fontSizePt);
              if (charIndex < s.length - 1) {
                totalWidth += letterSpacingPt;
              }
            }
            return totalWidth;
          };

          const words = processedValue.split(' ');
          let currentLine = '';
          const lines: string[] = [];
          for (let i = 0; i < words.length; i++) {
            const testLine = currentLine ? currentLine + ' ' + words[i] : words[i];
            const testWidth = measureTextSpacingPt(testLine);
            if (testWidth > wPt && i > 0) {
              lines.push(currentLine);
              currentLine = words[i];
            } else {
              currentLine = testLine;
            }
          }
          if (currentLine) {
            lines.push(currentLine);
          }

           const lineHeightPt = fontSizePt * (f.lineHeight ?? 1.2);
          const renderedHeightPt = lines.length * lineHeightPt;
          const halfLeadingPt = (lineHeightPt - fontSizePt) / 2;

          const ascenderOffsetPt = fontSizePt * 0.85;
          let startYPt = yPt + hPt - halfLeadingPt - ascenderOffsetPt;
          if (f.verticalAlign === 'center') {
            startYPt -= (hPt - renderedHeightPt) / 2;
          } else if (f.verticalAlign === 'bottom') {
            startYPt -= (hPt - renderedHeightPt);
          }

          let currentYPt = startYPt;
          const opacity = f.opacity != null ? f.opacity : 1.0;

          lines.forEach(lineText => {
            if (currentYPt >= yPt - lineHeightPt * 1.5 || lines.length === 1) {
              const textWidth = measureTextSpacingPt(lineText);
              let lineDrawX = xPt;
              if (f.align === 'center') {
                lineDrawX = xPt + (wPt - textWidth) / 2;
              } else if (f.align === 'right') {
                lineDrawX = xPt + wPt - textWidth;
              }

              if (letterSpacingPt) {
                let charX = lineDrawX;
                for (let charIndex = 0; charIndex < lineText.length; charIndex++) {
                  const char = lineText[charIndex];
                  page.drawText(char, {
                    x: charX,
                    y: currentYPt,
                    size: fontSizePt,
                    font: embeddedFont,
                    color: hexToRgb(f.color),
                    opacity: opacity,
                  });
                  charX += embeddedFont.widthOfTextAtSize(char, fontSizePt) + letterSpacingPt;
                }
              } else {
                page.drawText(lineText, {
                  x: lineDrawX,
                  y: currentYPt,
                  size: fontSizePt,
                  font: embeddedFont,
                  color: hexToRgb(f.color),
                  opacity: opacity,
                });
              }

              // Draw Underline or Strikethrough in PDF
              if (f.textDecoration && f.textDecoration !== 'none') {
                let lineOffsetPt = 0;
                if (f.textDecoration === 'underline') {
                  lineOffsetPt = fontSizePt * 0.05; // slightly below baseline
                } else if (f.textDecoration === 'line-through') {
                  lineOffsetPt = fontSizePt * 0.45; // middle of text
                }
                page.drawLine({
                  start: { x: lineDrawX, y: currentYPt + lineOffsetPt },
                  end: { x: lineDrawX + textWidth, y: currentYPt + lineOffsetPt },
                  thickness: Math.max(0.5, fontSizePt * 0.08),
                  color: hexToRgb(f.color),
                  opacity: opacity,
                });
              }

              currentYPt -= lineHeightPt;
            }
          });
        } catch (err) {
          console.error(`Error rendering text field ${f.field} in PDF:`, err);
        }
        break;
      }

      case 'image': {
        if (!rawValue) continue;
        try {
          let absoluteImgPath = String(rawValue).trim();
          if (absoluteImgPath.startsWith('/')) {
            absoluteImgPath = path.join(/*turbopackIgnore: true*/ process.cwd(), 'public', absoluteImgPath);
          } else if (
            !absoluteImgPath.startsWith('http') &&
            !absoluteImgPath.startsWith('data:image') &&
            !absoluteImgPath.startsWith('local://') &&
            !absoluteImgPath.startsWith('file://')
          ) {
            const publicPath = path.join(/*turbopackIgnore: true*/ process.cwd(), 'public', absoluteImgPath);
            if (fs.existsSync(publicPath)) {
              absoluteImgPath = publicPath;
            }
          }
          const img = await safeLoadImage(absoluteImgPath);

          const scaleFactor = 3;
          const boxWidth = f.width * scaleFactor;
          const boxHeight = f.height * scaleFactor;
          
          const tempCanvas = createCanvas(boxWidth, boxHeight);
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

            const pngBuffer = tempCanvas.toBuffer('image/png');
            const pdfImg = await pdfDoc.embedPng(pngBuffer);
            page.drawImage(pdfImg, { x: xPt, y: yPt, width: wPt, height: hPt });
          }
        } catch (err) {
          console.error(`Error rendering image field ${f.field} in PDF:`, err);
        }
        break;
      }

      case 'qr': {
        if (!rawValue) continue;
        try {
          const qrDataUrl = await generateQrCode(String(rawValue));
          const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');
          const qrImg = await pdfDoc.embedPng(qrBuffer);
          page.drawImage(qrImg, {
            x: xPt,
            y: yPt,
            width: wPt,
            height: hPt,
          });
        } catch (err) {
          console.error('QR code PDF render error:', err);
        }
        break;
      }

      case 'barcode': {
        if (!rawValue) continue;
        try {
          const barcodeCanvas = generateBarcodeCanvas(String(rawValue), f.width, f.height);
          const barcodeBuffer = barcodeCanvas.toBuffer('image/png');
          const barcodeImg = await pdfDoc.embedPng(barcodeBuffer);
          page.drawImage(barcodeImg, {
            x: xPt,
            y: yPt,
            width: wPt,
            height: hPt,
          });
        } catch (err) {
          console.error('Barcode PDF render error:', err);
        }
        break;
      }
    }
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

