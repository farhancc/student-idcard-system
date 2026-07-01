import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

/**
 * Edge-compatible in-memory rate limiter / Upstash distributed rate limiter fallback.
 *
 * Uses Upstash Redis if UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set.
 * Otherwise, falls back to sliding window strategy stored in a module-level Map.
 */

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

// Stored per-key sliding window data for local fallback
const store = new Map<string, RateLimitEntry>();

// Cache for dynamic Upstash Ratelimit instances
const ratelimitCache = new Map<string, Ratelimit>();

function getUpstashRatelimit(maxHits: number, windowMs: number): Ratelimit | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  const cacheKey = `${maxHits}:${windowMs}`;
  if (!ratelimitCache.has(cacheKey)) {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    const limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(maxHits, `${windowMs} ms`),
      analytics: true,
      prefix: '@upstash/ratelimit/idexo',
    });
    ratelimitCache.set(cacheKey, limiter);
  }
  return ratelimitCache.get(cacheKey)!;
}

// Periodic sweep to prevent memory growth — run every 10 minutes
let lastCleanup = Date.now();
function maybeSweep(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup > 10 * 60 * 1000) {
    lastCleanup = now;
    for (const [key, entry] of store.entries()) {
      if (now - entry.windowStart > windowMs * 2) {
        store.delete(key);
      }
    }
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

/**
 * Perform rate limiting check for a given key.
 *
 * @param key        Unique identifier (e.g., IP address or `ip:route`)
 * @param maxHits    Maximum number of requests allowed within the window
 * @param windowMs   Window duration in milliseconds
 */
export async function rateLimit(
  key: string,
  maxHits: number,
  windowMs: number
): Promise<RateLimitResult> {
  const upstash = getUpstashRatelimit(maxHits, windowMs);
  if (upstash) {
    try {
      const { success, limit, remaining, reset } = await upstash.limit(key);
      const now = Date.now();
      const retryAfterMs = success ? 0 : Math.max(0, reset - now);
      return {
        allowed: success,
        remaining,
        retryAfterMs,
      };
    } catch (err) {
      console.error('Upstash ratelimit error, falling back to in-memory:', err);
    }
  }

  // ── Local Fallback (Map-based sliding window) ──
  maybeSweep(windowMs);

  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now - entry.windowStart > windowMs) {
    // Start a fresh window
    store.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: maxHits - 1, retryAfterMs: 0 };
  }

  entry.count += 1;

  if (entry.count > maxHits) {
    const retryAfterMs = windowMs - (now - entry.windowStart);
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  return { allowed: true, remaining: maxHits - entry.count, retryAfterMs: 0 };
}

/**
 * Extract client IP from a Next.js Request, falling back gracefully.
 */
export function getClientIp(request: Request): string {
  const headers = (request as any).headers as Headers;
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headers.get('x-real-ip') ??
    'unknown'
  );
}
