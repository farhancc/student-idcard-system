/**
 * Middleware Header Verification
 *
 * The proxy/middleware injects the caller's identity as request headers and
 * signs them (see `middleware-context.ts`). Anything downstream that acts on
 * those headers — authorization *and* tenant scoping — must verify the
 * signature first, or it is trusting a value the client can set on any route
 * the middleware waves through.
 */

import crypto from 'crypto';
import {
  MIDDLEWARE_HEADERS,
  MiddlewareContext,
  SIGNATURE_HEX_LENGTH,
  TenantScope,
  middlewareSigPayload,
} from '@/lib/middleware-context';

const MIDDLEWARE_SECRET = process.env.JWT_SECRET || 'dev-middleware-secret';

type HeaderGetter = (name: string) => string | null;

/**
 * Verify the injected headers and return the context they assert.
 * Returns null if the signature is absent, malformed, or does not match.
 */
export function readVerifiedContext(get: HeaderGetter): MiddlewareContext | null {
  const sig = get(MIDDLEWARE_HEADERS.signature);
  const userIdStr = get(MIDDLEWARE_HEADERS.userId);
  const pressIdStr = get(MIDDLEWARE_HEADERS.pressId);
  const role = get(MIDDLEWARE_HEADERS.role);
  // Absent scope means a 'tenant' context, so an older signature still verifies.
  const scopeRaw = get(MIDDLEWARE_HEADERS.scope) ?? 'tenant';

  if (!sig || !userIdStr || !pressIdStr || !role) return null;
  if (scopeRaw !== 'tenant' && scopeRaw !== 'system') return null;

  const userId = Number(userIdStr);
  const pressId = Number(pressIdStr);
  if (!Number.isInteger(userId) || !Number.isInteger(pressId)) return null;

  const ctx: MiddlewareContext = { userId, pressId, role, scope: scopeRaw as TenantScope };

  const expectedSig = crypto
    .createHmac('sha256', MIDDLEWARE_SECRET)
    .update(middlewareSigPayload(ctx))
    .digest('hex')
    .slice(0, SIGNATURE_HEX_LENGTH);

  if (sig.length !== expectedSig.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;

  return ctx;
}

/** `Request` convenience wrapper around {@link readVerifiedContext}. */
export function getVerifiedContext(request: Request): MiddlewareContext | null {
  return readVerifiedContext(name => request.headers.get(name));
}

/** Back-compat boolean form. Prefer {@link getVerifiedContext}. */
export function verifyMiddlewareHeaders(request: Request): boolean {
  return getVerifiedContext(request) !== null;
}
