import { describe, it, expect, beforeEach } from 'vitest';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

describe('Rate Limiter (In-Memory Fallback)', () => {
  it('allows requests within the specified limit', async () => {
    const key = `test-key-${Date.now()}`;
    const maxHits = 3;
    const windowMs = 5000;

    const r1 = await rateLimit(key, maxHits, windowMs);
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);

    const r2 = await rateLimit(key, maxHits, windowMs);
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = await rateLimit(key, maxHits, windowMs);
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  it('blocks requests exceeding maxHits and returns retryAfterMs', async () => {
    const key = `test-blocked-${Date.now()}`;
    const maxHits = 2;
    const windowMs = 10000;

    await rateLimit(key, maxHits, windowMs);
    await rateLimit(key, maxHits, windowMs);

    const rBlocked = await rateLimit(key, maxHits, windowMs);
    expect(rBlocked.allowed).toBe(false);
    expect(rBlocked.remaining).toBe(0);
    expect(rBlocked.retryAfterMs).toBeGreaterThan(0);
    expect(rBlocked.retryAfterMs).toBeLessThanOrEqual(windowMs);
  });

  it('isolates counters for distinct keys', async () => {
    const keyA = `keyA-${Date.now()}`;
    const keyB = `keyB-${Date.now()}`;

    // Exhaust keyA limit
    await rateLimit(keyA, 1, 10000);
    const rA = await rateLimit(keyA, 1, 10000);
    expect(rA.allowed).toBe(false);

    // keyB should still be allowed
    const rB = await rateLimit(keyB, 1, 10000);
    expect(rB.allowed).toBe(true);
  });

  describe('getClientIp', () => {
    it('extracts IP from x-forwarded-for header', () => {
      const mockReq = {
        headers: new Headers({
          'x-forwarded-for': '203.0.113.195, 70.41.3.18',
        }),
      } as unknown as Request;

      expect(getClientIp(mockReq)).toBe('203.0.113.195');
    });

    it('falls back to x-real-ip if x-forwarded-for is missing', () => {
      const mockReq = {
        headers: new Headers({
          'x-real-ip': '198.51.100.42',
        }),
      } as unknown as Request;

      expect(getClientIp(mockReq)).toBe('198.51.100.42');
    });

    it('returns "unknown" if no IP headers exist', () => {
      const mockReq = {
        headers: new Headers(),
      } as unknown as Request;

      expect(getClientIp(mockReq)).toBe('unknown');
    });
  });
});
