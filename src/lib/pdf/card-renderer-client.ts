import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';

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
  borderRadius?: number; // px — for image fields
  prefix?: string; // e.g. "Roll No: "
  suffix?: string; // e.g. " (A+)"
  letterSpacing?: number;
  lineHeight?: number;
  textDecoration?: string;
  textTransform?: string;
  opacity?: number;
}

// Map to keep track of loaded font families in the browser
const loadedFonts = new Set<string>();

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
 * Generates a Barcode on an offscreen canvas.
 */
function generateBarcodeCanvas(text: string, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  try {
    JsBarcode(canvas, text, {
      format: 'CODE128',
      displayValue: false,
      margin: 2,
    });
  } catch (err) {
    console.error('Barcode generation error:', err);
    const ctx = canvas.getContext('2d');
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
 * Helper to wrap text.
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

function computeYOffsets(
  fields: FieldCoordinate[],
  measureFn: (f: FieldCoordinate, text: string) => number,
  getValueStr: (f: FieldCoordinate) => string
): Map<number, number> {
  const offsets = new Map<number, number>();
  for (let i = 0; i < fields.length; i++) offsets.set(i, 0);

  const sorted = fields
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => f.type === 'text')
    .sort((a, b) => a.f.y - b.f.y);

  const effectiveY = fields.map((f) => f.y);

  for (const { f, i } of sorted) {
    const lineHeight = (f.fontSize || 20) * 1.2;
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
    frontFields: string;
    backFields: string;
  },
  cardholder: {
    id?: number;
    name: string;
    designation?: string | null;
    photoUrl?: string | null;
    cardSerial?: string | null;
    customFields?: string | null;
  },
  side: 'front' | 'back',
  validTillDate: Date | null,
  pressFonts: Array<{ name: string; fileUrl: string }> = []
): Promise<void> {
  const width = template.cardWidth;
  const height = template.cardHeight;

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // 1. Draw solid white background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  const fieldsJson = side === 'front' ? template.frontFields : template.backFields;
  const fields: FieldCoordinate[] = JSON.parse(fieldsJson || '[]');
  
  let bgUrl = side === 'front' ? template.frontImageUrl : template.backImageUrl;

  // Resolve local original path if running inside Electron
  if (bgUrl && typeof window !== 'undefined' && (window as any).electronAPI?.getLocalTemplatePath && template.id) {
    try {
      const localPath = await (window as any).electronAPI.getLocalTemplatePath({
        templateId: template.id,
        side
      });
      if (localPath) {
        bgUrl = `local://${localPath}`;
      }
    } catch (err) {
      console.error('Failed to get local template path:', err);
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

  const clientMeasure = (f: FieldCoordinate, s: string) => {
    if (!tempCtx) return 0;
    tempCtx.font = `${f.fontWeight || 'normal'} ${f.fontSize || 20}px sans-serif`;
    return tempCtx.measureText(s).width;
  };

  const yOffsets = computeYOffsets(fields, clientMeasure, getClientValueStr);

  // 5. Draw fields
  for (let fi = 0; fi < fields.length; fi++) {
    const f = fields[fi];
    const yOffset = yOffsets.get(fi) ?? 0;
    let rawValue = f.type === 'id' ? cardholder.id : data[f.field];
    if (f.type === 'image' && !rawValue) {
      const isProfileField = f.field === 'photo' || f.field === 'avatar' || f.field === 'image' || f.field === 'profile';
      const isOnlyImageField = fields.filter((x: any) => x.type === 'image').length === 1;
      if (isProfileField || isOnlyImageField) {
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

        ctx.beginPath();
        ctx.rect(f.x, effectiveY, f.width, renderedHeight);
        ctx.clip();

        let currentY = effectiveY;
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
            drawY = f.y - (drawHeight - f.height) / 2;
          }

          ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
          ctx.restore();
        } catch (err) {
          console.error(`Error loading browser image field ${f.field}:`, err);
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
          const qrImg = await loadImageClient(qrDataUrl);
          ctx.drawImage(qrImg, f.x, f.y, f.width, f.height);
        } catch (err) {
          console.error('QR code browser render error:', err);
        }
        break;
      }

      case 'barcode': {
        if (!rawValue) continue;
        try {
          const barcodeCanvas = generateBarcodeCanvas(String(rawValue), f.width, f.height);
          ctx.drawImage(barcodeCanvas, f.x, f.y, f.width, f.height);
        } catch (err) {
          console.error('Barcode browser render error:', err);
        }
        break;
      }
    }
  }
}
