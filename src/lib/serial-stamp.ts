// The serial numbers the Serial Printer stamps onto artwork, and the maths
// that places them. Kept out of the page component so the geometry can be
// tested directly: it is the part that decides where ink lands on a sheet.

/** The slivers of pdf-lib used here. pdf-lib is loaded via dynamic import. */
export type RgbFn = (r: number, g: number, b: number) => unknown;

export interface PdfFontLike {
  widthOfTextAtSize: (text: string, size: number) => number;
}

export interface PdfPageLike {
  drawText: (text: string, options: Record<string, unknown>) => void;
  drawRectangle: (options: Record<string, unknown>) => void;
}

/**
 * One serial number stamped onto the artwork: where it sits, how it looks and
 * how it counts. A run can carry several — a ticket and its tear-off stub, or
 * two genuinely different series — so all of this is per-serial rather than
 * per-run. Give two serials the same start and step to print the same number
 * in both places.
 */
export interface SerialSpec {
  id: string;
  /** Position as a percentage of the artwork, so it survives rescaling. */
  posX: number;
  posY: number;
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  fontStyle: 'normal' | 'italic';
  textColor: string;
  textAlign: 'left' | 'center' | 'right';
  useBadge: boolean;
  badgeBg: string;
  badgePadding: number;
  badgeRadius: number;
  prefix: string;
  suffix: string;
  startSeq: number;
  stepSeq: number;
  padLength: number;
}

let serialIdCounter = 0;

export const makeSerial = (overrides: Partial<SerialSpec> = {}): SerialSpec => ({
  ...{
    id: '',
    posX: 50,
    posY: 85,
    fontFamily: 'Inter, sans-serif',
    fontSize: 18,
    fontWeight: '700',
    fontStyle: 'normal' as const,
    textColor: '#ffffff',
    textAlign: 'center' as const,
    useBadge: true,
    badgeBg: 'rgba(0, 0, 0, 0.6)',
    badgePadding: 6,
    badgeRadius: 4,
    prefix: 'NO. ',
    suffix: '',
    startSeq: 1,
    stepSeq: 1,
    padLength: 4,
  },
  ...overrides,
  // Always a fresh id, so duplicating a serial cannot alias the original.
  id: `serial_${++serialIdCounter}`,
});

/** The serial text for the nth document of a run (n is 0-based). */
export function formatSerialFor(spec: SerialSpec, index: number): string {
  const value = spec.startSeq + index * spec.stepSeq;
  return `${spec.prefix}${String(value).padStart(spec.padLength, '0')}${spec.suffix}`;
}

/** Strips characters pdf-lib's standard WinAnsi fonts cannot encode. */
export function sanitizeWinAnsiText(text: string): string {
  return text
    .replace(/№/g, 'No.')
    .replace(/[—–]/g, '-')
    .replace(/[“”"]/g, '"')
    .replace(/[‘’']/g, "'")
    .replace(/[•·]/g, '.')
    .replace(/[^\x20-\x7E]/g, '');
}

/** Parses a hex / rgb() / rgba() colour into a pdf-lib colour and opacity. */
export function parseColorToRgbAndOpacity(colorStr: string, rgbFn: RgbFn) {
  let r = 0, g = 0, b = 0, opacity = 1.0;
  if (!colorStr) return { color: rgbFn(0, 0, 0), opacity: 1.0 };

  if (colorStr.startsWith('#')) {
    const hex = colorStr.replace('#', '');
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16) / 255;
      g = parseInt(hex[1] + hex[1], 16) / 255;
      b = parseInt(hex[2] + hex[2], 16) / 255;
    } else if (hex.length >= 6) {
      r = parseInt(hex.substring(0, 2), 16) / 255;
      g = parseInt(hex.substring(2, 4), 16) / 255;
      b = parseInt(hex.substring(4, 6), 16) / 255;
    }
  } else if (colorStr.startsWith('rgba')) {
    const parts = colorStr.match(/[\d.]+/g);
    if (parts && parts.length >= 3) {
      r = parseFloat(parts[0]) / 255;
      g = parseFloat(parts[1]) / 255;
      b = parseFloat(parts[2]) / 255;
      if (parts.length >= 4) opacity = parseFloat(parts[3]);
    }
  } else if (colorStr.startsWith('rgb')) {
    const parts = colorStr.match(/[\d.]+/g);
    if (parts && parts.length >= 3) {
      r = parseFloat(parts[0]) / 255;
      g = parseFloat(parts[1]) / 255;
      b = parseFloat(parts[2]) / 255;
    }
  }

  return { color: rgbFn(r, g, b), opacity };
}

export interface StampOptions {
  spec: SerialSpec;
  text: string;
  font: PdfFontLike;
  rgb: RgbFn;
  /** The artwork's box on the page, in PDF points. */
  boxX: number;
  boxY: number;
  boxW: number;
  boxH: number;
  /** How far the artwork was scaled to fit that box (1 = full size). */
  scaleRatio: number;
}

/**
 * Stamps one serial onto a page inside a box given in PDF points.
 *
 * The three call sites — a copied single page, a cell of a grid sheet, and a
 * page of a ZIP batch — differ only in that box and in how far the artwork
 * was scaled to fit it, so the alignment and badge maths live here once.
 */
export function drawSerialOnPage(page: PdfPageLike, opts: StampOptions): void {
  const { spec, text, font, rgb, boxX, boxY, boxW, boxH, scaleRatio } = opts;

  const textPt = spec.fontSize * scaleRatio;
  const textWidth = font.widthOfTextAtSize(text, textPt);

  const anchorX = boxX + (spec.posX / 100) * boxW;
  // posY is measured from the top of the artwork, PDF y from the bottom.
  const anchorY = boxY + boxH - (spec.posY / 100) * boxH;

  let x = anchorX - textWidth / 2;
  if (spec.textAlign === 'left') x = anchorX;
  if (spec.textAlign === 'right') x = anchorX - textWidth;

  // The baseline sits just below the anchor so the text is optically centred
  // on it, matching the canvas preview's textBaseline: 'middle'.
  const baselineY = anchorY - textPt * 0.3;

  if (spec.useBadge && spec.badgeBg) {
    const pad = spec.badgePadding * scaleRatio;
    const badge = parseColorToRgbAndOpacity(spec.badgeBg, rgb);
    page.drawRectangle({
      x: x - pad,
      y: baselineY - pad / 2,
      width: textWidth + pad * 2,
      height: textPt * 1.2 + pad,
      color: badge.color,
      opacity: badge.opacity,
    });
  }

  const fill = parseColorToRgbAndOpacity(spec.textColor, rgb);
  page.drawText(text, {
    x,
    y: baselineY,
    size: textPt,
    font,
    color: fill.color,
    opacity: fill.opacity,
  });
}
