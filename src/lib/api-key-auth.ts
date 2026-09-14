/**
 * Shared API Key Authentication for V1 Public API routes.
 *
 * Provides rate-limited, validated API key authentication.
 * Extracted from the duplicated `getPressIdFromApiKey()` implementations
 * to ensure a single source of truth for security logic.
 */

import { NextResponse } from 'next/server';
import { prisma, basePrisma, enterPressContext } from '@/lib/prisma';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import crypto from 'crypto';

interface AuthSuccess {
  pressId: number;
}

interface AuthError {
  response: NextResponse;
}

export type ApiKeyAuthResult = AuthSuccess | AuthError;

/**
 * Authenticate a V1 API request via API key with dual-layer rate limiting.
 *
 * Rate limits:
 * - Per-IP: 30 requests / minute (prevents brute-force key guessing)
 * - Per-key: 100 requests / minute (prevents abuse with a valid key)
 *
 * @returns `{ pressId }` on success, `{ response }` on failure (return it directly).
 */
export async function authenticateApiKey(request: Request): Promise<ApiKeyAuthResult> {
  // ── Layer 1: IP-based rate limit (anti brute-force) ────────────────────────
  const ip = getClientIp(request);
  const ipRl = await rateLimit(`v1:ip:${ip}`, 30, 60 * 1000);
  if (!ipRl.allowed) {
    return {
      response: NextResponse.json(
        { error: 'Too many requests. Please wait before trying again.' },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil(ipRl.retryAfterMs / 1000)) },
        }
      ),
    };
  }

  // ── Extract API key ────────────────────────────────────────────────────────
  const apiKey =
    request.headers.get('x-api-key') ||
    request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');

  if (!apiKey) {
    return {
      response: NextResponse.json(
        { error: 'Unauthorized: Missing API Key. Provide via x-api-key header or Authorization: Bearer <key>' },
        { status: 401 }
      ),
    };
  }

  // ── Validate key ───────────────────────────────────────────────────────────
  // Chicken-and-egg: the key record is what tells us the tenant, so this one
  // lookup cannot be tenant-scoped. It goes through basePrisma — the unextended
  // client kept for exactly these cross-tenant reads — rather than through a
  // withSystemContext() wrapper: Prisma batches findUnique into a later tick,
  // by which point an AsyncLocalStorage.run() scope has already unwound.
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
  const keyRecord = await basePrisma.pressApiKey.findUnique({ where: { keyHash } });

  if (!keyRecord) {
    return {
      response: NextResponse.json(
        { error: 'Unauthorized: Invalid API Key' },
        { status: 401 }
      ),
    };
  }

  // ── Layer 2: Per-key rate limit (anti abuse) ───────────────────────────────
  const keyRl = await rateLimit(`v1:key:${keyRecord.id}`, 100, 60 * 1000);
  if (!keyRl.allowed) {
    return {
      response: NextResponse.json(
        { error: 'API key rate limit exceeded. Please wait before trying again.' },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil(keyRl.retryAfterMs / 1000)) },
        }
      ),
    };
  }

  // Everything the caller does from here on is confined to their own press.
  enterPressContext(keyRecord.pressId);

  // ── Track usage (fire-and-forget) ──────────────────────────────────────────
  prisma.pressApiKey
    .update({
      where: { id: keyRecord.id },
      data: { lastUsed: new Date() },
    })
    .catch(() => {});

  return { pressId: keyRecord.pressId };
}
