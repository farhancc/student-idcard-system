/**
 * Length units offered by the print-setup UI.
 *
 * Points are canonical: PDF geometry is expressed in points, so sheet layout
 * values are stored in points and the unit toggle is purely a display concern.
 * Bleed is the exception — the compile API takes it in millimetres — which is
 * why conversion here is always explicit about both ends.
 */
export type LengthUnit = 'MM' | 'PT' | 'IN';

const PT_PER_UNIT: Record<LengthUnit, number> = {
  PT: 1,
  MM: 72 / 25.4,
  IN: 72,
};

export interface UnitSpec {
  id: LengthUnit;
  /** Suffix shown beside a value, e.g. "12.5 mm". */
  symbol: string;
  /** Full name, for the unit toggle. */
  label: string;
  /** Increment for a number input shown in this unit. */
  step: number;
  /**
   * Decimal places a value is rounded to in this unit. Enough that typing a
   * value, switching units and switching back returns the value you typed.
   */
  decimals: number;
}

export const LENGTH_UNITS: readonly UnitSpec[] = [
  { id: 'MM', symbol: 'mm', label: 'mm (Millimeters)', step: 0.1, decimals: 1 },
  { id: 'PT', symbol: 'pt', label: 'pt (Points)', step: 1, decimals: 2 },
  { id: 'IN', symbol: 'in', label: 'in (Inches)', step: 0.01, decimals: 3 },
];

export function unitSpec(unit: LengthUnit): UnitSpec {
  // Non-null: LENGTH_UNITS covers every member of the LengthUnit union.
  return LENGTH_UNITS.find(u => u.id === unit)!;
}

/**
 * Convert a length between units, rounded to the target unit's precision.
 *
 * Rounding here rather than at the call sites is what keeps a value stable
 * across unit switches: without it, float drift accumulates every time the
 * value makes a round trip through the input.
 */
export function convertLength(value: number, from: LengthUnit, to: LengthUnit): number {
  if (!Number.isFinite(value)) return 0;
  // No early return when from === to: the result is still rounded to the
  // unit's precision, so callers always get a value fit to display. Skipping
  // it leaked raw floats like 3.3766666666666665 into number inputs.
  const factor = 10 ** unitSpec(to).decimals;
  return Math.round(exactConvert(value, from, to) * factor) / factor;
}

/** Unrounded, for callers that round at a different precision (e.g. pixels). */
function exactConvert(value: number, from: LengthUnit, to: LengthUnit): number {
  return (value * PT_PER_UNIT[from]) / PT_PER_UNIT[to];
}

/** A converted value with its symbol, e.g. "0.157 in". */
export function formatLength(value: number, from: LengthUnit, to: LengthUnit): string {
  return `${convertLength(value, from, to)} ${unitSpec(to).symbol}`;
}

/**
 * The units other than the selected one, for the secondary readout under an
 * input — so a press operator working in inches can still see the millimetres
 * their cutter is set to.
 */
export function otherUnits(unit: LengthUnit): LengthUnit[] {
  return LENGTH_UNITS.filter(u => u.id !== unit).map(u => u.id);
}

/** Secondary readout for a value, e.g. "40 pt · 0.556 in" when working in mm. */
export function secondaryReadout(value: number, from: LengthUnit, selected: LengthUnit): string {
  return otherUnits(selected)
    .map(to => formatLength(value, from, to))
    .join(' · ');
}

/** Upper bounds for sheet layout inputs, in points (the storage unit). */
export const MAX_MARGIN_PT = 288; // 4 in / 101.6 mm
export const MAX_GAP_PT = 144; // 2 in / 50.8 mm

/**
 * Card artwork is authored at 300 DPI, so a card pixel is exactly 1/300 inch.
 * Template geometry — card size, field positions, guides — is stored in these
 * pixels; every physical unit shown in the designer is derived from them.
 */
export const CARD_DPI = 300;

export function pxToLength(px: number, to: LengthUnit): number {
  if (!Number.isFinite(px)) return 0;
  return convertLength(px / CARD_DPI, 'IN', to);
}

export function lengthToPx(value: number, from: LengthUnit): number {
  if (!Number.isFinite(value)) return 0;
  // Converted exactly before rounding: rounding to the unit's display
  // precision first would cost up to a fifth of a pixel.
  return Math.round(exactConvert(value, from, 'IN') * CARD_DPI);
}
