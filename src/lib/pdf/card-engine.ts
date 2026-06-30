import { createCanvas, loadImage, registerFont } from 'canvas';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import fs from 'fs';
import path from 'path';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

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

// Helper to load file (local or HTTP) as a Buffer
async function getFileBuffer(fileUrl: string): Promise<Buffer> {
  if (fileUrl.startsWith('data:')) {
    const commaIndex = fileUrl.indexOf(',');
    if (commaIndex !== -1) {
      const base64Data = fileUrl.substring(commaIndex + 1);
      return Buffer.from(base64Data, 'base64');
    }
  }
  if (fileUrl.startsWith('/')) {
    const filePath = path.join(/*turbopackIgnore: true*/ process.cwd(), 'public', fileUrl);
    return fs.readFileSync(filePath);
  } else if (fileUrl.startsWith('http')) {
    const res = await fetch(fileUrl);
    if (!res.ok) throw new Error(`Failed to download file: ${res.statusText}`);
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } else {
    if (fs.existsSync(fileUrl)) {
      return fs.readFileSync(fileUrl);
    }
    throw new Error(`File not found: ${fileUrl}`);
  }
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
    .filter(({ f }) => f.type === 'text')
    .sort((a, b) => a.f.y - b.f.y);

  // Track overflow added by each field so we can shift later fields
  // We work with *effective* Y (original + accumulated offset from earlier fields)
  const effectiveY = fields.map((f) => f.y); // copy

  for (const { f, i } of sorted) {
    const lineHeight = (f.fontSize || 20) * 1.2;
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
  },
  cardholder: {
    id?: number;
    name: string;
    designation: string | null;
    photoUrl: string | null;
    cardSerial: string | null;
    customFields: string | null;
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
      if (bgUrl.endsWith('.pdf')) {
        absoluteBgPath = bgUrl.replace('.pdf', '.png');
      } else if (bgUrl.toLowerCase().endsWith('.svg')) {
        absoluteBgPath = resolveSvgToPng(bgUrl, 2000);
      }
      // Resolve local path if relative
      if (absoluteBgPath.startsWith('/')) {
        absoluteBgPath = path.join(/*turbopackIgnore: true*/ process.cwd(), 'public', absoluteBgPath);
      }
      const bg = await loadImage(absoluteBgPath);
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

  // Formatted date string for validTill
  let formattedValidTill = '';
  if (validTillDate) {
    const date = new Date(validTillDate);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    formattedValidTill = `${months[date.getMonth()]} ${date.getFullYear()}`;
  }

  // Combine core properties and custom properties
  const data: Record<string, any> = {
    name: cardholder.name,
    designation: cardholder.designation || '',
    photo: cardholder.photoUrl || '',
    cardSerial: cardholder.cardSerial || '',
    validTill: formattedValidTill,
    ...customData,
  };

  // 3. Pre-compute Y offsets to reflow fields that wrap beyond their declared height
  // We need a temporary canvas ctx to measure text widths per field
  const tempCtx = createCanvas(1, 1).getContext('2d');
  const getCanvasValueStr = (f: FieldCoordinate) => {
    if (f.staticValue !== undefined && f.staticValue !== null) {
      return `${f.prefix || ''}${f.staticValue}${f.suffix || ''}`;
    }
    let rv = f.type === 'id' ? cardholder.id : data[f.field];
    if (f.type === 'image' && !rv) {
      const isProfileField = f.field === 'photo' || f.field === 'avatar' || f.field === 'image' || f.field === 'profile';
      const isOnlyImageField = fields.filter((x: any) => x.type === 'image').length === 1;
      if (isProfileField || isOnlyImageField) {
        rv = cardholder.photoUrl || '';
      }
    }
    if (rv === undefined || rv === null) return '';
    return `${f.prefix || ''}${rv}${f.suffix || ''}`;
  };
  const canvasMeasure = (f: FieldCoordinate, s: string) => {
    tempCtx.font = `${f.fontWeight || 'normal'} ${f.fontSize || 20}px sans-serif`;
    return tempCtx.measureText(s).width;
  };
  const yOffsets = computeYOffsets(fields, canvasMeasure, getCanvasValueStr);

  // 4. Draw mapped fields
  for (let fi = 0; fi < fields.length; fi++) {
    const f = fields[fi];
    const yOffset = yOffsets.get(fi) ?? 0;
    let rawValue = f.staticValue !== undefined ? f.staticValue : (f.type === 'id' ? cardholder.id : data[f.field]);
    if (f.type === 'image' && !rawValue) {
      const isProfileField = f.field === 'photo' || f.field === 'avatar' || f.field === 'image' || f.field === 'profile';
      const isOnlyImageField = fields.filter((x: any) => x.type === 'image').length === 1;
      if (isProfileField || isOnlyImageField) {
        rawValue = cardholder.photoUrl || '';
      }
    }
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
        let startY = effectiveY;
        if (f.verticalAlign === 'center') {
          startY = effectiveY + (f.height - renderedHeight) / 2;
        } else if (f.verticalAlign === 'bottom') {
          startY = effectiveY + f.height - renderedHeight;
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
          const img = await loadImage(absoluteImgPath);

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
            drawY = f.y - (drawHeight - f.height) / 2;
          }

          ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
          ctx.restore();
        } catch (err) {
          console.error(`Error loading image field ${f.field} from ${rawValue}:`, err);
          // Draw red cross placeholder on error
          ctx.strokeStyle = '#ff0000';
          ctx.lineWidth = 1;
          ctx.strokeRect(f.x, f.y, f.width, f.height);
        }
        break;
      }

      case 'qr': {
        if (!rawValue) continue;
        try {
          const qrDataUrl = await generateQrCode(String(rawValue));
          const qrImg = await loadImage(qrDataUrl);
          ctx.drawImage(qrImg, f.x, f.y, f.width, f.height);
        } catch (err) {
          console.error('QR code render error:', err);
        }
        break;
      }

      case 'barcode': {
        if (!rawValue) continue;
        try {
          const barcodeCanvas = generateBarcodeCanvas(String(rawValue), f.width, f.height);
          ctx.drawImage(barcodeCanvas, f.x, f.y, f.width, f.height);
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
  },
  cardholder: {
    id?: number;
    name: string;
    designation: string | null;
    photoUrl: string | null;
    cardSerial: string | null;
    customFields: string | null;
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
  const bgUrl = (originalUrl && originalUrl.toLowerCase().endsWith('.pdf'))
    ? originalUrl
    : previewUrl;

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
      const lowerBg = bgUrl.toLowerCase();
      if (lowerBg.endsWith('.pdf')) {
        // ── Vector path: embed the PDF page directly (preserves all vector paths) ──
        const bgBuffer = await getFileBuffer(bgUrl);
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
        const targetBgUrl = lowerBg.endsWith('.svg') ? resolveSvgToPng(bgUrl, 3000) : bgUrl;
        const bgBuffer = await getFileBuffer(targetBgUrl);
        let bgImg;
        if (targetBgUrl.toLowerCase().endsWith('.png')) {
          bgImg = await pdfDoc.embedPng(bgBuffer);
        } else {
          bgImg = await pdfDoc.embedJpg(bgBuffer);
        }
        page.drawImage(bgImg, {
          x: 0,
          y: 0,
          width: widthPt,
          height: heightPt,
        });
      }
    } catch (err) {
      console.error(`Error rendering PDF background from ${bgUrl}:`, err);
    }
  }

  // 3. Prepare data
  const customData = cardholder.customFields ? JSON.parse(cardholder.customFields) : {};

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

  // 4. Pre-compute Y offsets so wrapped text fields push down fields below them
  const getPdfValueStr = (f: FieldCoordinate) => {
    if (f.staticValue !== undefined && f.staticValue !== null) {
      return `${f.prefix || ''}${f.staticValue}${f.suffix || ''}`;
    }
    let rv = f.type === 'id' ? cardholder.id : data[f.field];
    if (f.type === 'image' && !rv) {
      const isProfileField = f.field === 'photo' || f.field === 'avatar' || f.field === 'image' || f.field === 'profile';
      const isOnlyImageField = fields.filter((x: any) => x.type === 'image').length === 1;
      if (isProfileField || isOnlyImageField) {
        rv = cardholder.photoUrl || '';
      }
    }
    if (rv === undefined || rv === null) return '';
    return `${f.prefix || ''}${rv}${f.suffix || ''}`;
  };
  // Use a simple pixel-space proxy for PDF width measurement (we'll refine per field below)
  const pdfMeasureProxy = (f: FieldCoordinate, s: string) => {
    // Approximate: average char width ≈ fontSize * 0.55 (conservative for Helvetica)
    return s.length * (f.fontSize || 20) * 0.55;
  };
  const pdfYOffsets = computeYOffsets(fields, pdfMeasureProxy, getPdfValueStr);

  // 5. Draw fields
  for (let fi = 0; fi < fields.length; fi++) {
    const f = fields[fi];
    const yOffsetPx = pdfYOffsets.get(fi) ?? 0;
    let rawValue = f.staticValue !== undefined ? f.staticValue : (f.type === 'id' ? cardholder.id : data[f.field]);
    if (f.type === 'image' && !rawValue) {
      const isProfileField = f.field === 'photo' || f.field === 'avatar' || f.field === 'image' || f.field === 'profile';
      const isOnlyImageField = fields.filter((x: any) => x.type === 'image').length === 1;
      if (isProfileField || isOnlyImageField) {
        rawValue = cardholder.photoUrl || '';
      }
    }
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
          let embeddedFont;
          if (f.fontFamily && f.fontFamily !== 'sans-serif') {
            const matchingFont = pressFonts.find(pf => pf.name.toLowerCase() === f.fontFamily?.toLowerCase());
            if (matchingFont) {
              const fontBuffer = await getFileBuffer(matchingFont.fileUrl);
              embeddedFont = await pdfDoc.embedFont(fontBuffer);
            }
          }
          if (!embeddedFont) {
            const isBold = f.fontWeight === 'bold' || (f.fontWeight && !isNaN(Number(f.fontWeight)) && Number(f.fontWeight) >= 600);
            const isItalic = f.fontStyle === 'italic';
            const stdFont =
              isBold && isItalic ? StandardFonts.HelveticaBoldOblique
              : isBold ? StandardFonts.HelveticaBold
              : isItalic ? StandardFonts.HelveticaOblique
              : StandardFonts.Helvetica;
            embeddedFont = await pdfDoc.embedFont(stdFont);
          }

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

          let currentYPt = yPt + hPt - fontSizePt;
          const lineHeightPt = fontSizePt * (f.lineHeight ?? 1.2);
          const opacity = f.opacity != null ? f.opacity : 1.0;

          lines.forEach(lineText => {
            if (currentYPt >= yPt) {
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
          const imgBuffer = await getFileBuffer(rawValue);
          let img;
          if (rawValue.toLowerCase().endsWith('.png')) {
            img = await pdfDoc.embedPng(imgBuffer);
          } else {
            img = await pdfDoc.embedJpg(imgBuffer);
          }

          page.drawImage(img, {
            x: xPt,
            y: yPt,
            width: wPt,
            height: hPt,
          });
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

