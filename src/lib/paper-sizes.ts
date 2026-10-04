/**
 * The sheets a compile can be laid out on, and their size in PDF points.
 *
 * These dimensions used to be written out as literals in five places — the
 * wizard's slot preview, the compile hook's layout check, the job body it
 * posts, the desktop daemon's renderer and the individual-card renderer — so
 * every new sheet size meant five edits and five chances to disagree. They
 * live here once instead.
 *
 * Each sheet is declared in the unit it is actually specified in: ISO sizes in
 * millimetres, the US large format in inches. Deriving 13x19 from its rounded
 * millimetre label (330 x 483) would lose a point in each direction against
 * the exact 936 x 1368 the press expects.
 */
import { convertLength } from '@/lib/units';

export type PaperSizeId = 'A4' | 'A3' | 'SRA3' | '13x19' | 'CUSTOM';

/** What the backend generators understand. Everything else is sent as CUSTOM. */
export type GeneratorPaperSize = 'A4' | 'A3' | 'CUSTOM';

export type SheetOrientation = 'PORTRAIT' | 'LANDSCAPE';

interface NamedSheet {
  id: Exclude<PaperSizeId, 'CUSTOM'>;
  label: string;
  /** Portrait dimensions, in `unit`. */
  width: number;
  height: number;
  unit: 'MM' | 'IN';
}

const NAMED_SHEETS: readonly NamedSheet[] = [
  { id: 'A4', label: 'A4', width: 210, height: 297, unit: 'MM' },
  { id: 'A3', label: 'A3', width: 297, height: 420, unit: 'MM' },
  { id: 'SRA3', label: 'SRA3', width: 320, height: 450, unit: 'MM' },
  { id: '13x19', label: '13" x 19"', width: 13, height: 19, unit: 'IN' },
];

/** Bounds on a hand-entered sheet, matching the Serial Printer's own inputs. */
export const MIN_CUSTOM_MM = 10;
export const MAX_CUSTOM_MM = 2000;

export interface SheetSize {
  width: number;
  height: number;
}

export interface SheetSizeRequest {
  id: PaperSizeId;
  orientation?: SheetOrientation;
  /** Required when `id` is CUSTOM; ignored otherwise. */
  customWidthMm?: number;
  customHeightMm?: number;
}

const namedSheet = (id: PaperSizeId) => NAMED_SHEETS.find(s => s.id === id);

/** A sheet's portrait size in PDF points. */
function portraitPt(sheet: NamedSheet): SheetSize {
  return {
    width: convertLength(sheet.width, sheet.unit, 'PT'),
    height: convertLength(sheet.height, sheet.unit, 'PT'),
  };
}

export const clampCustomMm = (mm: number): number =>
  Math.min(MAX_CUSTOM_MM, Math.max(MIN_CUSTOM_MM, Number.isFinite(mm) ? mm : MIN_CUSTOM_MM));

/**
 * The page size to render, in PDF points.
 *
 * Orientation rotates a named sheet. A custom sheet is taken exactly as
 * entered — width is width — because the operator has already said which way
 * round their stock is by typing it, and the server-side generators treat
 * CUSTOM the same way. Callers that offer an orientation control should
 * disable it for CUSTOM rather than silently ignoring it.
 */
export function sheetSizePt({
  id,
  orientation = 'PORTRAIT',
  customWidthMm,
  customHeightMm,
}: SheetSizeRequest): SheetSize {
  if (id === 'CUSTOM') {
    return {
      width: convertLength(clampCustomMm(customWidthMm ?? MIN_CUSTOM_MM), 'MM', 'PT'),
      height: convertLength(clampCustomMm(customHeightMm ?? MIN_CUSTOM_MM), 'MM', 'PT'),
    };
  }

  // An unrecognised id falls back to A3, which is what every call site these
  // dimensions were lifted from used as its default.
  const sheet = namedSheet(id) ?? namedSheet('A3')!;
  const { width, height } = portraitPt(sheet);
  return orientation === 'LANDSCAPE' ? { width: height, height: width } : { width, height };
}

/** "A4 - 210 x 297 mm", for a picker. */
function optionLabel(sheet: NamedSheet): string {
  const w = convertLength(sheet.width, sheet.unit, 'MM');
  const h = convertLength(sheet.height, sheet.unit, 'MM');
  return `${sheet.label} — ${Math.round(w)} × ${Math.round(h)} mm`;
}

export const PAPER_SIZE_OPTIONS: readonly { id: PaperSizeId; label: string }[] = [
  ...NAMED_SHEETS.map(s => ({ id: s.id as PaperSizeId, label: optionLabel(s) })),
  { id: 'CUSTOM', label: 'Custom size (mm)' },
];

export function isPaperSizeId(value: string): value is PaperSizeId {
  return value === 'CUSTOM' || NAMED_SHEETS.some(s => s.id === value);
}

export interface JobSheetFields {
  paperSize: GeneratorPaperSize;
  customWidth?: number;
  customHeight?: number;
}

/**
 * How a chosen sheet is expressed to the job API.
 *
 * The generators only know A4, A3 and CUSTOM, so every other sheet travels as
 * CUSTOM carrying its already-rotated size in points. SRA3 and 13x19 were
 * being translated this way inline at the one call site that offered them;
 * a hand-entered size is simply the same translation with the operator
 * supplying the numbers.
 */
export function jobSheetFields(req: SheetSizeRequest): JobSheetFields {
  if (req.id === 'A4' || req.id === 'A3') {
    // Sent by name so the daemon applies its own orientation swap, exactly as
    // it did before this helper existed.
    return { paperSize: req.id };
  }
  const { width, height } = sheetSizePt(req);
  return { paperSize: 'CUSTOM', customWidth: width, customHeight: height };
}
