import { describe, it, expect } from 'vitest';
import {
  PAPER_SIZE_OPTIONS,
  MIN_CUSTOM_MM,
  MAX_CUSTOM_MM,
  clampCustomMm,
  isPaperSizeId,
  jobSheetFields,
  sheetSizePt,
} from '@/lib/paper-sizes';

// The literals the five call sites used before they shared this module. A
// change here is a change to where ink lands, so they are pinned.
const A4_PORTRAIT = { width: 595.28, height: 841.89 };
const A3_PORTRAIT = { width: 841.89, height: 1190.55 };
const SRA3_PORTRAIT = { width: 907.09, height: 1275.59 };

const near = (actual: number, expected: number) => expect(actual).toBeCloseTo(expected, 1);

describe('sheet sizes', () => {
  it('matches the dimensions the generators used before consolidation', () => {
    const a4 = sheetSizePt({ id: 'A4' });
    near(a4.width, A4_PORTRAIT.width);
    near(a4.height, A4_PORTRAIT.height);

    const a3 = sheetSizePt({ id: 'A3' });
    near(a3.width, A3_PORTRAIT.width);
    near(a3.height, A3_PORTRAIT.height);

    const sra3 = sheetSizePt({ id: 'SRA3' });
    near(sra3.width, SRA3_PORTRAIT.width);
    near(sra3.height, SRA3_PORTRAIT.height);
  });

  it('derives 13x19 from inches, not from its rounded mm label', () => {
    // 330 x 483 mm would give 935.4 x 1369.1 — a point out in both directions.
    const sheet = sheetSizePt({ id: '13x19' });
    expect(sheet.width).toBeCloseTo(936, 6);
    expect(sheet.height).toBeCloseTo(1368, 6);
  });

  it('swaps a named sheet for landscape', () => {
    const portrait = sheetSizePt({ id: 'A4', orientation: 'PORTRAIT' });
    const landscape = sheetSizePt({ id: 'A4', orientation: 'LANDSCAPE' });
    expect(landscape.width).toBeCloseTo(portrait.height, 6);
    expect(landscape.height).toBeCloseTo(portrait.width, 6);
  });

  it('takes a custom sheet exactly as entered, whatever the orientation', () => {
    const req = { id: 'CUSTOM' as const, customWidthMm: 400, customHeightMm: 200 };
    const portrait = sheetSizePt({ ...req, orientation: 'PORTRAIT' });
    const landscape = sheetSizePt({ ...req, orientation: 'LANDSCAPE' });

    near(portrait.width, 1133.86); // 400 mm
    near(portrait.height, 566.93); // 200 mm
    expect(landscape).toEqual(portrait);
  });

  it('falls back to A3 for an unrecognised sheet', () => {
    const unknown = sheetSizePt({ id: 'B2' as never });
    near(unknown.width, A3_PORTRAIT.width);
    near(unknown.height, A3_PORTRAIT.height);
  });

  it('clamps a custom sheet to the bounds the inputs advertise', () => {
    expect(clampCustomMm(0)).toBe(MIN_CUSTOM_MM);
    expect(clampCustomMm(-50)).toBe(MIN_CUSTOM_MM);
    expect(clampCustomMm(99999)).toBe(MAX_CUSTOM_MM);
    expect(clampCustomMm(Number.NaN)).toBe(MIN_CUSTOM_MM);
    expect(clampCustomMm(210)).toBe(210);
  });

  it('clamps rather than emitting a zero-area page', () => {
    const sheet = sheetSizePt({ id: 'CUSTOM', customWidthMm: 0, customHeightMm: 0 });
    expect(sheet.width).toBeGreaterThan(0);
    expect(sheet.height).toBeGreaterThan(0);
  });
});

describe('job sheet fields', () => {
  it('sends A4 and A3 by name, leaving the orientation swap to the daemon', () => {
    expect(jobSheetFields({ id: 'A4', orientation: 'LANDSCAPE' })).toEqual({ paperSize: 'A4' });
    expect(jobSheetFields({ id: 'A3', orientation: 'PORTRAIT' })).toEqual({ paperSize: 'A3' });
  });

  it('sends every other sheet as CUSTOM with resolved points', () => {
    const sra3 = jobSheetFields({ id: 'SRA3', orientation: 'LANDSCAPE' });
    expect(sra3.paperSize).toBe('CUSTOM');
    near(sra3.customWidth!, SRA3_PORTRAIT.height);
    near(sra3.customHeight!, SRA3_PORTRAIT.width);

    const wide = jobSheetFields({ id: '13x19' });
    expect(wide.paperSize).toBe('CUSTOM');
    expect(wide.customWidth).toBeCloseTo(936, 6);

    const custom = jobSheetFields({ id: 'CUSTOM', customWidthMm: 500, customHeightMm: 700 });
    expect(custom.paperSize).toBe('CUSTOM');
    near(custom.customWidth!, 1417.32);
    near(custom.customHeight!, 1984.25);
  });
});

describe('paper size options', () => {
  it('offers every sheet plus a custom entry, each a valid id', () => {
    const ids = PAPER_SIZE_OPTIONS.map(o => o.id);
    expect(ids).toEqual(['A4', 'A3', 'SRA3', '13x19', 'CUSTOM']);
    for (const id of ids) expect(isPaperSizeId(id)).toBe(true);
  });

  it('labels named sheets with their millimetre size', () => {
    const byId = (id: string) => PAPER_SIZE_OPTIONS.find(o => o.id === id)!.label;
    expect(byId('A4')).toContain('210 × 297 mm');
    expect(byId('13x19')).toContain('330 × 483 mm');
  });

  it('rejects an unknown id', () => {
    expect(isPaperSizeId('B2')).toBe(false);
  });
});
