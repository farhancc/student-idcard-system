import { Redis } from '@upstash/redis';

let redis: Redis | null = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

// In-memory fallback for local development or when Redis is not configured
const inMemoryRevokedTokens = new Set<string>();

/**
 * Mark a JWT (by its `jti` unique token ID) as revoked until its natural expiration.
 * @param jti Unique JWT identifier
 * @param ttlSeconds Time-to-live in seconds (defaults to 24h = 86400s)
 */
export async function revokeToken(jti: string, ttlSeconds: number = 86400): Promise<void> {
  if (!jti) return;
  if (redis) {
    try {
      await redis.set(`revoked:${jti}`, '1', { ex: ttlSeconds });
      return;
    } catch (err) {
      console.warn('[TokenBlocklist] Redis error, falling back to in-memory:', err);
    }
  }
  inMemoryRevokedTokens.add(jti);
  // Auto-clean in-memory after TTL
  setTimeout(() => {
    inMemoryRevokedTokens.delete(jti);
  }, ttlSeconds * 1000);
}

/**
 * Check whether a JWT `jti` has been revoked.
 */
export async function isTokenRevoked(jti: string): Promise<boolean> {
  if (!jti) return false;
  if (redis) {
    try {
      const exists = await redis.get(`revoked:${jti}`);
      return exists !== null;
    } catch (err) {
      console.warn('[TokenBlocklist] Redis lookup error:', err);
    }
  }
  return inMemoryRevokedTokens.has(jti);
}
