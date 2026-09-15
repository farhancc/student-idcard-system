import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createCanvas, loadImage } from 'canvas';

/**
 * Batch-imported cards whose photo/signature is missing from the ZIP (or whose
 * link is broken) fall back to a 1x1 placeholder that the renderer stretches
 * across the whole field box. The placeholder shipped as rgba(0,255,0,127),
 * which painted a light-green block (#80FE80 over white) onto every such card
 * in the compiled PDF.
 *
 * The placeholder must be fully transparent so the slot stays blank.
 */
describe('missing image placeholder', () => {
  it('is a fully transparent pixel, not a coloured block', async () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/pdf/card-renderer-client.ts'),
      'utf8'
    );

    const match = src.match(/data:image\/png;base64,[A-Za-z0-9+/=]+/);
    expect(match, 'placeholder PNG data URI not found').toBeTruthy();

    const img = await loadImage(match![0]);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, img.width, img.height);
    ctx.drawImage(img, 0, 0);

    // Every pixel must be fully transparent; alpha 0 is what keeps the slot blank.
    const { data } = ctx.getImageData(0, 0, img.width, img.height);
    for (let i = 3; i < data.length; i += 4) {
      expect(data[i]).toBe(0);
    }
  });
});
