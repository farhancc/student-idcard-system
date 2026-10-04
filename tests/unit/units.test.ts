import { describe, it, expect } from 'vitest';
import {
  LENGTH_UNITS,
  convertLength,
  formatLength,
  otherUnits,
  secondaryReadout,
  unitSpec,
  CARD_DPI,
  pxToLength,
  lengthToPx,
  type LengthUnit,
} from '@/lib/units';

const ALL: LengthUnit[] = ['MM', 'PT', 'IN'];

describe('length units', () => {
  it('offers millimetres, points and inches', () => {
    expect(LENGTH_UNITS.map(u => u.id)).toEqual(['MM', 'PT', 'IN']);
    expect(LENGTH_UNITS.map(u => u.symbol)).toEqual(['mm', 'pt', 'in']);
  });

  it('has a spec for every unit in the union', () => {
    for (const unit of ALL) {
      expect(unitSpec(unit).id).toBe(unit);
    }
  });

  describe('convertLength', () => {
    it('uses the printing definitions of an inch', () => {
      expect(convertLength(1, 'IN', 'PT')).toBe(72);
      expect(convertLength(1, 'IN', 'MM')).toBe(25.4);
      expect(convertLength(72, 'PT', 'IN')).toBe(1);
      expect(convertLength(25.4, 'MM', 'IN')).toBe(1);
    });

    it('still converts millimetres and points as before', () => {
      expect(convertLength(40, 'PT', 'MM')).toBe(14.1);
      expect(convertLength(10, 'MM', 'PT')).toBe(28.35);
    });

    it('rounds to the unit precision even between identical units', () => {
      // A same-unit conversion still has to produce a displayable number:
      // card pixels divided by 300 land on values like 3.3766666666666665.
      expect(convertLength(12.345, 'IN', 'IN')).toBe(12.345);
      expect(convertLength(3.3766666666666665, 'IN', 'IN')).toBe(3.377);
      expect(convertLength(85.7716, 'MM', 'MM')).toBe(85.8);
    });

    it('treats a blank or non-numeric input as zero', () => {
      expect(convertLength(Number(''), 'MM', 'PT')).toBe(0);
      expect(convertLength(Number.NaN, 'IN', 'PT')).toBe(0);
    });

    it('returns a typed value unchanged after storing it as points', () => {
      // The round trip the UI actually performs: the operator types a value in
      // the selected unit, it is stored in points, and it is displayed back in
      // that same unit. Drift here would make a margin creep every time the
      // field is touched.
      for (const unit of ALL) {
        for (const candidate of [0, 0.01, 0.5, 1, 12, 40, 101.6]) {
          // Only values the operator could actually type in this unit:
          // millimetres are shown to a tenth, so 0.01 mm is not one of them.
          const typed = Number(candidate.toFixed(unitSpec(unit).decimals));
          const stored = convertLength(typed, unit, 'PT');
          expect(convertLength(stored, 'PT', unit)).toBe(typed);
        }
      }
    });

    it('keeps a direct unit-to-unit conversion within display precision', () => {
      // Switching the toggle only reconverts from the stored points, but the
      // readout of the two unselected units is a direct conversion.
      for (const from of ALL) {
        for (const to of ALL) {
          // Each conversion rounds by at most one step of its target unit's
          // display precision. Measured in `from`, that is one step of `from`
          // plus one step of `to` expressed in `from` — an inch step is 0.072
          // pt, so the bound is not simply the sum of the two granularities.
          const tolerance =
            10 ** -unitSpec(from).decimals +
            convertLength(10 ** -unitSpec(to).decimals, to, from);
          for (const value of [0, 0.5, 12, 40]) {
            const back = convertLength(convertLength(value, from, to), to, from);
            expect(Math.abs(back - value)).toBeLessThanOrEqual(tolerance);
          }
        }
      }
    });
  });

  it('formats a value with its unit symbol', () => {
    expect(formatLength(40, 'PT', 'IN')).toBe('0.556 in');
    expect(formatLength(1, 'IN', 'MM')).toBe('25.4 mm');
  });

  it('lists the two units that are not selected', () => {
    expect(otherUnits('MM')).toEqual(['PT', 'IN']);
    expect(otherUnits('IN')).toEqual(['MM', 'PT']);
  });

  it('reads out both alternative units at once', () => {
    expect(secondaryReadout(40, 'PT', 'PT')).toBe('14.1 mm · 0.556 in');
  });

  describe('300 DPI card pixels', () => {
    it('treats a card pixel as one three-hundredth of an inch', () => {
      expect(CARD_DPI).toBe(300);
      expect(pxToLength(300, 'IN')).toBe(1);
      expect(pxToLength(300, 'MM')).toBe(25.4);
      expect(lengthToPx(1, 'IN')).toBe(300);
      expect(lengthToPx(25.4, 'MM')).toBe(300);
    });

    it('matches the CR80 card the ID_CARD preset sets', () => {
      // ISO/IEC 7810 ID-1 is 85.6 x 53.98 mm, which at 300 DPI is 1011 x 638
      // px. The preset is derived from those millimetres, so a round trip
      // through the stored pixels reproduces the label exactly.
      expect(lengthToPx(85.6, 'MM')).toBe(1011);
      expect(lengthToPx(53.98, 'MM')).toBe(638);
      expect(pxToLength(1011, 'MM')).toBe(85.6);
      expect(pxToLength(638, 'MM')).toBe(54);
      expect(pxToLength(1011, 'IN')).toBe(3.37);
    });

    it('keeps a typed dimension within the pixel grid after storing it', () => {
      // Template geometry is stored as whole pixels, so a dimension can only
      // ever land on a 1/300 in grid: half a pixel of rounding is inherent,
      // not drift. 2.125 in (the CR80 short edge) is exactly 637.5 px and so
      // genuinely cannot be represented — it becomes 638 px.
      for (const unit of ALL) {
        // One display step, plus the pixel the value had to be rounded onto.
        const tolerance = pxToLength(1, unit) + 10 ** -unitSpec(unit).decimals;
        for (const typed of [3.37, 85.6, 54, 2.125]) {
          const px = lengthToPx(typed, unit);
          expect(Math.abs(pxToLength(px, unit) - typed)).toBeLessThanOrEqual(tolerance);
        }
      }
    });

    it('rounds pixels to whole numbers, since geometry is stored in them', () => {
      expect(Number.isInteger(lengthToPx(85.6, 'MM'))).toBe(true);
      expect(Number.isInteger(lengthToPx(3.333, 'IN'))).toBe(true);
    });

    it('treats a blank dimension as zero rather than NaN', () => {
      expect(pxToLength(Number.NaN, 'MM')).toBe(0);
      expect(lengthToPx(Number(''), 'IN')).toBe(0);
    });
  });
});
