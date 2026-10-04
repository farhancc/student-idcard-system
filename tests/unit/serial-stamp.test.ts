import { describe, it, expect } from 'vitest';
import {
  drawSerialOnPage,
  formatSerialFor,
  makeSerial,
  parseColorToRgbAndOpacity,
  sanitizeWinAnsiText,
  type PdfFontLike,
  type PdfPageLike,
  type SerialSpec,
} from '@/lib/serial-stamp';

/** A page that records what would have been drawn, instead of drawing it. */
function recordingPage() {
  const texts: Record<string, unknown>[] = [];
  const rects: Record<string, unknown>[] = [];
  const page: PdfPageLike = {
    drawText: (text, options) => texts.push({ text, ...options }),
    drawRectangle: options => rects.push({ ...options }),
  };
  return { page, texts, rects };
}

/** Every glyph is exactly 10pt wide at 20pt, so text width is predictable. */
const font: PdfFontLike = {
  widthOfTextAtSize: (text, size) => text.length * size * 0.5,
};

const rgb = (r: number, g: number, b: number) => ({ r, g, b });

const spec = (over: Partial<SerialSpec> = {}) => makeSerial(over);

describe('serial numbering', () => {
  it('counts with its own start and step', () => {
    const s = spec({ prefix: 'NO. ', padLength: 4, startSeq: 10, stepSeq: 5 });
    expect(formatSerialFor(s, 0)).toBe('NO. 0010');
    expect(formatSerialFor(s, 1)).toBe('NO. 0015');
    expect(formatSerialFor(s, 3)).toBe('NO. 0025');
  });

  it('applies prefix, suffix and zero padding', () => {
    const s = spec({ prefix: 'A-', suffix: '/26', padLength: 3, startSeq: 7, stepSeq: 1 });
    expect(formatSerialFor(s, 0)).toBe('A-007/26');
  });

  it('can be told not to pad', () => {
    expect(formatSerialFor(spec({ prefix: '', padLength: 0, startSeq: 9 }), 0)).toBe('9');
  });

  it('lets two serials carry the same number in different places', () => {
    // The ticket-and-stub case: same start and step, different position.
    const ticket = spec({ prefix: 'NO. ', posY: 85 });
    const stub = spec({ prefix: 'STUB ', posY: 15 });
    for (const i of [0, 1, 7]) {
      expect(formatSerialFor(ticket, i).replace('NO. ', '')).toBe(
        formatSerialFor(stub, i).replace('STUB ', '')
      );
    }
  });

  it('gives every serial a distinct id, including duplicates of one another', () => {
    const original = spec();
    const copy = makeSerial({ ...original, posY: 20 });
    expect(copy.id).not.toBe(original.id);
    expect(copy.prefix).toBe(original.prefix);
  });
});

describe('drawSerialOnPage', () => {
  it('centres text on the anchor by default', () => {
    const { page, texts } = recordingPage();
    drawSerialOnPage(page, {
      spec: spec({ posX: 50, posY: 50, fontSize: 20, useBadge: false, textAlign: 'center' }),
      text: 'ABCD', font, rgb,
      boxX: 0, boxY: 0, boxW: 400, boxH: 200, scaleRatio: 1,
    });
    // Anchor x = 50% of 400 = 200; "ABCD" is 4 * 20 * 0.5 = 40pt wide.
    expect(texts[0].x).toBe(200 - 20);
    expect(texts[0].size).toBe(20);
  });

  it('anchors left and right alignment to the same point', () => {
    const base = { text: 'ABCD', font, rgb, boxX: 0, boxY: 0, boxW: 400, boxH: 200, scaleRatio: 1 };
    const left = recordingPage();
    const right = recordingPage();
    drawSerialOnPage(left.page, { ...base, spec: spec({ posX: 50, fontSize: 20, useBadge: false, textAlign: 'left' }) });
    drawSerialOnPage(right.page, { ...base, spec: spec({ posX: 50, fontSize: 20, useBadge: false, textAlign: 'right' }) });
    expect(left.texts[0].x).toBe(200);
    expect(right.texts[0].x).toBe(200 - 40);
  });

  it('measures posY from the top of the artwork, not the PDF origin', () => {
    const { page, texts } = recordingPage();
    drawSerialOnPage(page, {
      spec: spec({ posX: 0, posY: 25, fontSize: 20, useBadge: false, textAlign: 'left' }),
      text: 'A', font, rgb,
      boxX: 0, boxY: 0, boxW: 400, boxH: 200, scaleRatio: 1,
    });
    // 25% down from the top of a 200pt box is y = 150 in PDF coordinates.
    expect(texts[0].y).toBeCloseTo(150 - 20 * 0.3, 6);
  });

  it('offsets by the box, so a grid cell places the serial inside its own cell', () => {
    const { page, texts } = recordingPage();
    drawSerialOnPage(page, {
      spec: spec({ posX: 50, posY: 50, fontSize: 20, useBadge: false, textAlign: 'left' }),
      text: 'A', font, rgb,
      boxX: 300, boxY: 100, boxW: 200, boxH: 100, scaleRatio: 1,
    });
    expect(texts[0].x).toBe(300 + 100);
    expect(texts[0].y).toBeCloseTo(100 + 100 - 50 - 20 * 0.3, 6);
  });

  it('scales the type with the artwork when it is shrunk into a cell', () => {
    const { page, texts, rects } = recordingPage();
    drawSerialOnPage(page, {
      spec: spec({ fontSize: 20, badgePadding: 6, useBadge: true }),
      text: 'A', font, rgb,
      boxX: 0, boxY: 0, boxW: 200, boxH: 100, scaleRatio: 0.5,
    });
    expect(texts[0].size).toBe(10);
    // Badge padding scales with the type, so the box keeps its proportions.
    expect(rects[0].width).toBe(font.widthOfTextAtSize('A', 10) + 3 * 2);
  });

  it('draws the badge behind the text, not after it', () => {
    const calls: string[] = [];
    const page: PdfPageLike = {
      drawText: () => calls.push('text'),
      drawRectangle: () => calls.push('rect'),
    };
    drawSerialOnPage(page, {
      spec: spec({ useBadge: true, badgeBg: '#000000' }),
      text: 'A', font, rgb, boxX: 0, boxY: 0, boxW: 100, boxH: 100, scaleRatio: 1,
    });
    expect(calls).toEqual(['rect', 'text']);
  });

  it('omits the badge when it is switched off', () => {
    const { page, rects } = recordingPage();
    drawSerialOnPage(page, {
      spec: spec({ useBadge: false }),
      text: 'A', font, rgb, boxX: 0, boxY: 0, boxW: 100, boxH: 100, scaleRatio: 1,
    });
    expect(rects).toHaveLength(0);
  });

  it('places each serial independently', () => {
    const { page, texts } = recordingPage();
    const box = { font, rgb, boxX: 0, boxY: 0, boxW: 400, boxH: 200, scaleRatio: 1 };
    const serials = [
      spec({ posX: 25, posY: 10, fontSize: 20, useBadge: false, textAlign: 'left' }),
      spec({ posX: 75, posY: 90, fontSize: 20, useBadge: false, textAlign: 'left' }),
    ];
    serials.forEach((s, i) => drawSerialOnPage(page, { ...box, spec: s, text: `S${i}` }));
    expect(texts).toHaveLength(2);
    expect(texts[0].x).toBe(100);
    expect(texts[1].x).toBe(300);
    expect(Number(texts[0].y)).toBeGreaterThan(Number(texts[1].y));
  });
});

describe('colour parsing', () => {
  it('reads hex, short hex and rgba with opacity', () => {
    expect(parseColorToRgbAndOpacity('#ffffff', rgb)).toEqual({ color: { r: 1, g: 1, b: 1 }, opacity: 1 });
    expect(parseColorToRgbAndOpacity('#fff', rgb)).toEqual({ color: { r: 1, g: 1, b: 1 }, opacity: 1 });
    expect(parseColorToRgbAndOpacity('rgba(0, 0, 0, 0.6)', rgb)).toEqual({
      color: { r: 0, g: 0, b: 0 },
      opacity: 0.6,
    });
  });

  it('falls back to opaque black for an empty colour', () => {
    expect(parseColorToRgbAndOpacity('', rgb)).toEqual({ color: { r: 0, g: 0, b: 0 }, opacity: 1 });
  });
});

describe('WinAnsi sanitising', () => {
  it('replaces characters the standard fonts cannot encode', () => {
    expect(sanitizeWinAnsiText('№ 12—34')).toBe('No. 12-34');
  });

  it('keeps plain serials untouched', () => {
    expect(sanitizeWinAnsiText('NO. 0001')).toBe('NO. 0001');
  });
});
