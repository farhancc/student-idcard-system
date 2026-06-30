import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

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
  fontFamily?: string;
  color?: string;
  align?: 'left' | 'center' | 'right';
  borderRadius?: number;
  prefix?: string;
}

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

/** Fetch a PDF buffer from Cloudinary URL or local /public path */
async function getPdfBuffer(url: string): Promise<Buffer> {
  if (url.startsWith('/')) {
    const localPath = path.join(process.cwd(), 'public', url);
    if (fs.existsSync(localPath)) return fs.readFileSync(localPath);
    throw new Error(`Local file not found: ${localPath}`);
  }
  if (url.startsWith('http')) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch PDF: ${res.statusText}`);
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  }
  throw new Error(`Unsupported URL format: ${url}`);
}

/**
 * Convert a hex color (#rrggbb) from PDF operator to a CSS hex string.
 * Returns undefined if invalid.
 */
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.round(Math.max(0, Math.min(1, n)) * 255)
    .toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Map common label strings found in ID cards to standard field keys.
 * Case-insensitive prefix match.
 */
function labelToFieldKey(label: string): string {
  const t = label.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();

  if (/^(student\s*)?name$|^full\s*name$/.test(t)) return 'name';
  if (/^roll\s*(no|num|number)|^reg(istration)?\s*(no|num|number)|^enroll/.test(t)) return 'rollNo';
  if (/^date\s*of\s*birth|^d\.?o\.?b/.test(t)) return 'dob';
  if (/^designation|^position|^post$|^title$/.test(t)) return 'designation';
  if (/^class$|^grade$|^standard$|^section$/.test(t)) return 'class';
  if (/^department|^dept$|^branch$/.test(t)) return 'department';
  if (/^blood\s*group|^blood\s*type/.test(t)) return 'bloodGroup';
  if (/^valid\s*(till|upto|until)|^expiry|^exp\s*date|^validity/.test(t)) return 'validTill';
  if (/^phone|^mobile|^contact\s*(no|num|number)/.test(t)) return 'phone';
  if (/^email|^e-mail/.test(t)) return 'email';
  if (/^address|^addr$/.test(t)) return 'address';
  if (/^card\s*(no|num|serial)|^serial|^id\s*(no|num)|^card\s*id/.test(t)) return 'cardSerial';
  if (/^father|^parent/.test(t)) return 'fatherName';
  if (/^mother/.test(t)) return 'motherName';

  // Fall back to camelCase conversion of the original label
  return label
    .trim()
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^(.)/, (_, c) => c.toLowerCase()) || 'customField';
}

/**
 * Determine text alignment from the PDF text matrix (tm[4] = x, width of page used).
 * Simple heuristic: if x < 30% → left, x > 60% → right, else center.
 */
function guessAlignment(x: number, pageWidth: number): 'left' | 'center' | 'right' {
  const rel = x / pageWidth;
  if (rel > 0.55) return 'right';
  if (rel > 0.35) return 'center';
  return 'left';
}

// ────────────────────────────────────────────────────────────────
// POST /api/templates/analyze-pdf
// Body: { originalUrl: string, cardWidth: number, cardHeight: number }
// ────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { originalUrl, cardWidth, cardHeight } = body as {
      originalUrl: string;
      cardWidth: number;
      cardHeight: number;
    };

    if (!originalUrl || !cardWidth || !cardHeight) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // ── 1. Load PDF buffer ──────────────────────────────────────
    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await getPdfBuffer(originalUrl);
    } catch (err: any) {
      return NextResponse.json({ error: `Could not load PDF: ${err.message}` }, { status: 400 });
    }

    // ── 2. Parse with pdfjs-dist (legacy build, Node-compatible) ─
    // We use a dynamic import to avoid bundler issues with the WASM worker
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    // Disable worker in Node environment
    (pdfjsLib as any).GlobalWorkerOptions = (pdfjsLib as any).GlobalWorkerOptions || {};
    (pdfjsLib as any).GlobalWorkerOptions.workerSrc = '';

    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer) });
    const pdfDoc = await loadingTask.promise;
    const page = await pdfDoc.getPage(1);
    const viewport = page.getViewport({ scale: 1 });

    // PDF viewport gives dimensions in points (pt)
    // The canvas uses pixels at 300 DPI where 1pt = 300/72 px = ~4.167 px
    // But since the user set cardWidth/cardHeight in their template, we simply
    // map from PDF coordinate space (pt) to canvas space proportionally:
    //   canvas_x = (pdf_x_pt / viewport.width)  * cardWidth
    //   canvas_y = ((viewport.height - pdf_y_pt) / viewport.height) * cardHeight
    //              ↑ Y-flip because PDF origin is bottom-left, canvas is top-left

    const pdfW = viewport.width;   // pt
    const pdfH = viewport.height;  // pt

    const toCanvasX = (ptX: number) => Math.round((ptX / pdfW) * cardWidth);
    const toCanvasY = (ptY: number) => Math.round(((pdfH - ptY) / pdfH) * cardHeight);
    const toCanvasW = (ptW: number) => Math.round((ptW / pdfW) * cardWidth);
    const toCanvasH = (ptH: number) => Math.round((ptH / pdfH) * cardHeight);

    const fields: FieldCoordinate[] = [];

    // ── 3. Extract Text Items ───────────────────────────────────
    const textContent = await page.getTextContent({ includeMarkedContent: false } as any);

    // pdfjs returns text items with transform: [scaleX, skewY, skewX, scaleY, tx, ty]
    // tx, ty are in pt (bottom-origin). Font size ≈ abs(transform[3]) or item.height
    let imageFieldCount = 0;

    for (const rawItem of textContent.items) {
      const item = rawItem as any;
      if (!item.str || item.str.trim() === '') continue;

      const transform: number[] = item.transform; // [a, b, c, d, e, f]
      const ptX = transform[4];
      const ptY = transform[5];
      const ptFontSize = Math.abs(transform[3]) || item.height || 12;
      const ptWidth = item.width || ptFontSize * item.str.length * 0.6;
      const ptHeight = ptFontSize * 1.2;

      const cx = toCanvasX(ptX);
      const cy = toCanvasY(ptY) - toCanvasH(ptFontSize); // adjust top by font height
      const cw = toCanvasW(ptWidth);
      const ch = Math.max(toCanvasH(ptHeight), 20);
      const cFontSize = Math.round((ptFontSize / pdfH) * cardHeight);

      // Try to get text color from font style info if available
      let color: string | undefined;
      if (item.fontName) {
        // Color info is encoded in page operator stream; we'll default to black
        // A more advanced implementation would parse the content stream
        color = '#000000';
      }

      // Detect font weight from font name heuristic
      const fontNameLower = (item.fontName || '').toLowerCase();
      const fontWeight = fontNameLower.includes('bold') || fontNameLower.includes('heavy') || fontNameLower.includes('black')
        ? 'bold' : 'normal';
      const fontStyle = fontNameLower.includes('italic') || fontNameLower.includes('oblique')
        ? 'italic' : 'normal';

      // Strip trailing colons/punctuation to get the label
      const label = item.str.trim().replace(/:$/, '').trim();
      const fieldKey = labelToFieldKey(label);

      // Detect if this is a label (short string, likely a prefix) or
      // a value placeholder.  In CorelDraw designs that still have readable text,
      // each text object is typically a separate text frame, so we treat every
      // text item as a field directly.

      const prefix = label !== item.str.trim() ? `${label}: ` : '';

      fields.push({
        field: fieldKey,
        type: 'text',
        x: cx,
        y: Math.max(0, cy),
        width: Math.max(cw, 80),
        height: ch,
        fontSize: Math.max(cFontSize, 8),
        fontWeight,
        fontStyle: fontStyle as 'normal' | 'italic',
        color: color || '#000000',
        align: guessAlignment(ptX, pdfW),
        prefix,
      });
    }

    // ── 4. Extract Embedded Image XObjects (photo placeholders) ─
    // We access the page's resource dictionary to find XObjects of subtype Image
    try {
      const operatorList = await page.getOperatorList();
      const OPS = pdfjsLib.OPS as any;

      // Walk operator list and pick out paintImageXObject calls
      // Each has a name argument we can cross-reference with resources
      const resources = (page as any).commonObjs;
      void resources;

      for (let oi = 0; oi < operatorList.fnArray.length; oi++) {
        const fn = operatorList.fnArray[oi];
        // OPS.paintImageXObject = 85, OPS.paintInlineImageXObject = 86
        if (fn === OPS?.paintImageXObject || fn === OPS?.paintInlineImageXObject || fn === 85 || fn === 86) {
          // The current transformation matrix before this op gives position/size
          // We need to look backwards for the current CTM which is set by 'transform' ops
          // Simpler: look for preceding save/transform/restore sequence
          // For most CorelDraw PDFs, each image is placed with: q cm Do Q
          // cm sets the matrix [w, 0, 0, h, x, y]
          let cmIdx = oi - 1;
          while (cmIdx >= 0 && operatorList.fnArray[cmIdx] !== OPS?.transform && operatorList.fnArray[cmIdx] !== 12) {
            cmIdx--;
          }
          if (cmIdx >= 0) {
            const cm = operatorList.argsArray[cmIdx] as number[];
            if (cm && cm.length === 6) {
              // cm = [a, b, c, d, e, f] → width=a, height=d (for axis-aligned images), x=e, y=f
              const ptImgW = Math.abs(cm[0]);
              const ptImgH = Math.abs(cm[3]);
              const ptImgX = cm[4];
              const ptImgY = cm[5];

              // Only consider images with a meaningful size (not tiny icons or decorations)
              const minPtSize = pdfW * 0.05; // at least 5% of page width
              if (ptImgW >= minPtSize && ptImgH >= minPtSize) {
                imageFieldCount++;
                const label = imageFieldCount === 1 ? 'photo' : `photo_${imageFieldCount}`;

                fields.push({
                  field: label,
                  type: 'image',
                  x: toCanvasX(ptImgX),
                  y: toCanvasY(ptImgY + ptImgH), // PDF bottom-left → canvas top-left
                  width: toCanvasW(ptImgW),
                  height: toCanvasH(ptImgH),
                  borderRadius: 0,
                });
              }
            }
          }
        }
      }
    } catch (imgErr) {
      console.warn('Image XObject extraction failed (non-fatal):', imgErr);
    }

    // ── 5. Deduplicate overlapping fields ───────────────────────
    // If two text fields are very close (within 5px), keep the one with more text
    const deduped: FieldCoordinate[] = [];
    for (const f of fields) {
      const overlap = deduped.find(
        d => d.type === f.type &&
             Math.abs(d.x - f.x) < 10 &&
             Math.abs(d.y - f.y) < 10
      );
      if (!overlap) {
        deduped.push(f);
      }
    }

    // ── 6. Sort top-to-bottom, left-to-right ────────────────────
    deduped.sort((a, b) => a.y !== b.y ? a.y - b.y : a.x - b.x);

    return NextResponse.json({
      success: true,
      fields: deduped,
      count: deduped.length,
      textCount: deduped.filter(f => f.type === 'text').length,
      imageCount: deduped.filter(f => f.type === 'image').length,
    });
  } catch (error: any) {
    console.error('analyze-pdf error:', error);
    return NextResponse.json({ error: error.message || 'Failed to analyze PDF' }, { status: 500 });
  }
}
