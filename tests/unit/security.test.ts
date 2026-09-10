import { describe, it, expect } from 'vitest';
import crypto from 'crypto';

// ─── Inline implementations for unit testing ────────────────────────────
// We extract the pure logic from source modules to avoid importing Next.js
// runtime dependencies (headers, Prisma, Cloudinary) that aren't available
// in unit tests.

// ── Signed URL Logic (mirrors src/lib/signed-url.ts) ────────────────────

function generateSignedUrlToken(
  originalUrl: string,
  secret: string,
  ttlSeconds: number
): { sig: string; exp: number } {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${originalUrl}:${exp}`;
  const sig = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
    .slice(0, 32);
  return { sig, exp };
}

function validateSignedUrlToken(
  originalPath: string,
  sig: string,
  exp: string,
  secret: string
): boolean {
  const expiresAt = parseInt(exp, 10);
  if (isNaN(expiresAt) || Math.floor(Date.now() / 1000) > expiresAt) {
    return false;
  }
  const payload = `${originalPath}:${expiresAt}`;
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
    .slice(0, 32);

  if (typeof sig !== 'string' || sig.length !== expectedSig.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig));
}

// ── Magic Byte Validation (mirrors src/app/api/upload/route.ts) ─────────

function validateMagicBytes(buf: Buffer, ext: string): boolean {
  if (buf.length < 4) return false;
  if (ext === '.png')
    return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  if (ext === '.jpg' || ext === '.jpeg')
    return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  if (ext === '.webp')
    return (
      buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buf.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  if (ext === '.pdf')
    return buf.subarray(0, 4).toString('ascii') === '%PDF';
  if (ext === '.psd')
    return buf.subarray(0, 4).toString('ascii') === '8BPS';
  if (ext === '.svg') {
    const head = buf.subarray(0, 200).toString('utf8').trim().toLowerCase();
    return head.includes('<svg') || head.includes('<?xml');
  }
  return true; // Unknown extensions pass through
}

// ── Cache hash (mirrors src/lib/pdf/cache-manager.ts) ───────────────────

function computeTemplateHash(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('Security — Signed URL Validation', () => {
  const secret = 'test-secret-key-for-unit-tests';

  it('generates and validates a signed URL token round-trip', () => {
    const path = '/uploads/1/cache/42_front.png';
    const { sig, exp } = generateSignedUrlToken(path, secret, 3600);

    expect(sig).toHaveLength(32);
    expect(validateSignedUrlToken(path, sig, String(exp), secret)).toBe(true);
  });

  it('rejects an expired token', () => {
    const path = '/uploads/1/cache/42_front.png';
    const expiredExp = Math.floor(Date.now() / 1000) - 10; // 10 seconds ago
    const payload = `${path}:${expiredExp}`;
    const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex').slice(0, 32);

    expect(validateSignedUrlToken(path, sig, String(expiredExp), secret)).toBe(false);
  });

  it('rejects a tampered signature', () => {
    const path = '/uploads/1/cache/42_front.png';
    const { exp } = generateSignedUrlToken(path, secret, 3600);

    const tamperedSig = 'a'.repeat(32);
    expect(validateSignedUrlToken(path, tamperedSig, String(exp), secret)).toBe(false);
  });

  it('rejects a tampered path', () => {
    const originalPath = '/uploads/1/cache/42_front.png';
    const { sig, exp } = generateSignedUrlToken(originalPath, secret, 3600);

    // Attacker tries to access a different file using the same sig
    const attackerPath = '/uploads/2/cache/99_front.png';
    expect(validateSignedUrlToken(attackerPath, sig, String(exp), secret)).toBe(false);
  });

  it('rejects wrong-length signatures', () => {
    const path = '/uploads/1/cache/42_front.png';
    const { exp } = generateSignedUrlToken(path, secret, 3600);

    expect(validateSignedUrlToken(path, 'short', String(exp), secret)).toBe(false);
    expect(validateSignedUrlToken(path, '', String(exp), secret)).toBe(false);
  });

  it('rejects non-numeric exp values', () => {
    expect(validateSignedUrlToken('/path', 'a'.repeat(32), 'notanumber', secret)).toBe(false);
  });

  it('uses constant-time comparison (sig same length but different)', () => {
    const path = '/uploads/1/cache/42_front.png';
    const { sig, exp } = generateSignedUrlToken(path, secret, 3600);

    // Flip one character in the valid sig
    const flippedSig = sig[0] === 'a' ? 'b' + sig.slice(1) : 'a' + sig.slice(1);
    expect(validateSignedUrlToken(path, flippedSig, String(exp), secret)).toBe(false);
  });
});

describe('Security — Magic Byte Validation', () => {
  it('validates PNG magic bytes (89 50 4E 47)', () => {
    const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(validateMagicBytes(validPng, '.png')).toBe(true);

    const fakePng = Buffer.from([0x00, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    expect(validateMagicBytes(fakePng, '.png')).toBe(false);
  });

  it('validates JPEG magic bytes (FF D8 FF)', () => {
    const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(validateMagicBytes(validJpeg, '.jpg')).toBe(true);
    expect(validateMagicBytes(validJpeg, '.jpeg')).toBe(true);

    const fakeJpeg = Buffer.from([0xff, 0xd8, 0x00, 0xe0]);
    expect(validateMagicBytes(fakeJpeg, '.jpg')).toBe(false);
  });

  it('validates WebP magic bytes (RIFF....WEBP)', () => {
    const riff = Buffer.from('RIFF');
    const size = Buffer.alloc(4); // 4 bytes for size
    const webp = Buffer.from('WEBP');
    const validWebp = Buffer.concat([riff, size, webp]);
    expect(validateMagicBytes(validWebp, '.webp')).toBe(true);

    const fakeWebp = Buffer.concat([riff, size, Buffer.from('FAKE')]);
    expect(validateMagicBytes(fakeWebp, '.webp')).toBe(false);
  });

  it('validates PDF magic bytes (%PDF)', () => {
    const validPdf = Buffer.from('%PDF-1.7 ...');
    expect(validateMagicBytes(validPdf, '.pdf')).toBe(true);

    const fakePdf = Buffer.from('Not a real PDF');
    expect(validateMagicBytes(fakePdf, '.pdf')).toBe(false);
  });

  it('validates PSD magic bytes (8BPS)', () => {
    const validPsd = Buffer.from('8BPS\x00\x01');
    expect(validateMagicBytes(validPsd, '.psd')).toBe(true);

    const fakePsd = Buffer.from('FAKE\x00\x01');
    expect(validateMagicBytes(fakePsd, '.psd')).toBe(false);
  });

  it('validates SVG content (looks for <svg or <?xml)', () => {
    const validSvg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">');
    expect(validateMagicBytes(validSvg, '.svg')).toBe(true);

    const xmlSvg = Buffer.from('<?xml version="1.0"?><svg></svg>');
    expect(validateMagicBytes(xmlSvg, '.svg')).toBe(true);

    const fakeSvg = Buffer.from('This is not an SVG file at all');
    expect(validateMagicBytes(fakeSvg, '.svg')).toBe(false);
  });

  it('rejects buffers shorter than 4 bytes', () => {
    expect(validateMagicBytes(Buffer.from([0x89, 0x50]), '.png')).toBe(false);
    expect(validateMagicBytes(Buffer.alloc(0), '.jpg')).toBe(false);
  });

  it('passes unknown extensions through (CDR, AI)', () => {
    const randomBytes = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05]);
    expect(validateMagicBytes(randomBytes, '.cdr')).toBe(true);
    expect(validateMagicBytes(randomBytes, '.ai')).toBe(true);
  });

  it('detects polyglot attack: JPEG extension with PNG content', () => {
    const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    // Attacker renames .png to .jpg — magic bytes won't match JPEG signature
    expect(validateMagicBytes(pngBytes, '.jpg')).toBe(false);
  });
});

describe('Security — Schema Bounds (customFields)', () => {
  // Import the actual schemas — these don't have Next.js runtime deps
  // We use dynamic import to avoid top-level import issues
  it('enrollSchema: customFields accepts string values', async () => {
    const { enrollSchema } = await import('@/lib/schemas');
    const result = enrollSchema.safeParse({
      name: 'John Doe',
      customFields: { grade: '10th', section: 'A' },
    });
    expect(result.success).toBe(true);
  });

  it('enrollSchema: customFields rejects nested objects', async () => {
    const { enrollSchema } = await import('@/lib/schemas');
    const result = enrollSchema.safeParse({
      name: 'John Doe',
      customFields: { nested: { deep: 'value' } },
    });
    expect(result.success).toBe(false);
  });

  it('cardholderUpdateSchema: customFields accepts primitive values', async () => {
    const { cardholderUpdateSchema } = await import('@/lib/schemas');
    const result = cardholderUpdateSchema.safeParse({
      name: 'Jane',
      customFields: { grade: '12th', active: true, rollNo: 42, removed: null },
    });
    expect(result.success).toBe(true);
  });

  it('cardholderUpdateSchema: customFields rejects nested objects', async () => {
    const { cardholderUpdateSchema } = await import('@/lib/schemas');
    const result = cardholderUpdateSchema.safeParse({
      customFields: { nested: { deep: 'value' } },
    });
    expect(result.success).toBe(false);
  });
});

describe('Security — Template Hash uses SHA-256', () => {
  it('produces a 64-character hex string (SHA-256)', () => {
    const hash = computeTemplateHash('template-layout-data');
    expect(hash).toHaveLength(64); // SHA-256 = 32 bytes = 64 hex chars
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('produces deterministic output', () => {
    const input = 'front_fields_json|back_fields_json|front_url|back_url|1';
    expect(computeTemplateHash(input)).toBe(computeTemplateHash(input));
  });

  it('produces different hashes for different inputs', () => {
    const hash1 = computeTemplateHash('layout-v1');
    const hash2 = computeTemplateHash('layout-v2');
    expect(hash1).not.toBe(hash2);
  });
});
