/**
 * Edge-compatible in-memory rate limiter.
 *
 * Uses a sliding window strategy stored in a module-level Map.
 * Works correctly on single-instance deployments (local dev, single Vercel region).
 *
 * ⚠ For multi-instance production (Vercel Serverless / Edge with multiple cold-start
 *   replicas), upgrade to @upstash/ratelimit + Vercel KV for shared state.
 *
 * Usage:
 *   const result = rateLimit(ip, 5, 60_000); // 5 requests per 60 seconds
 *   if (!result.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
 */

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

// Stored per-key sliding window data
const store = new Map<string, RateLimitEntry>();

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
 * @param key        Unique identifier (e.g., IP address or `ip:route`)
 * @param maxHits    Maximum number of requests allowed within the window
 * @param windowMs   Window duration in milliseconds
 */
export function rateLimit(key: string, maxHits: number, windowMs: number): RateLimitResult {
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
