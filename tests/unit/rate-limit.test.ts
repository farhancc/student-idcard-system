import { describe, it, expect, beforeEach, vi } from 'vitest';
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
    const req = (h: Record<string, string>) =>
      ({ headers: new Headers(h) }) as unknown as Request;

    it('trusts x-vercel-forwarded-for, which the platform sets itself', () => {
      expect(getClientIp(req({ 'x-vercel-forwarded-for': '203.0.113.195, 70.41.3.18' })))
        .toBe('203.0.113.195');
    });

    it('ignores client-settable forwarding headers by default', () => {
      // Without a trusted proxy in front, these are attacker-controlled: honouring
      // them would let a caller rotate the rate-limit key at will.
      expect(getClientIp(req({ 'x-forwarded-for': '203.0.113.195' }))).toBe('unknown');
      expect(getClientIp(req({ 'x-real-ip': '198.51.100.42' }))).toBe('unknown');
    });

    it('honours forwarding headers when the deployment declares a trusted proxy', () => {
      vi.stubEnv('TRUST_PROXY_HEADERS', 'true');
      expect(getClientIp(req({ 'x-forwarded-for': '203.0.113.195, 70.41.3.18' })))
        .toBe('203.0.113.195');
      expect(getClientIp(req({ 'x-real-ip': '198.51.100.42' }))).toBe('198.51.100.42');
      vi.unstubAllEnvs();
    });

    it('prefers the platform header over a spoofed one', () => {
      vi.stubEnv('TRUST_PROXY_HEADERS', 'true');
      expect(getClientIp(req({
        'x-vercel-forwarded-for': '203.0.113.1',
        'x-forwarded-for': '10.0.0.1',
      }))).toBe('203.0.113.1');
      vi.unstubAllEnvs();
    });

    it('returns "unknown" if no IP headers exist', () => {
      const mockReq = {
        headers: new Headers(),
      } as unknown as Request;

      expect(getClientIp(mockReq)).toBe('unknown');
    });
  });
});
