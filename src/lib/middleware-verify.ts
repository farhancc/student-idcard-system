/**
 * Middleware Header Verification — Defense-in-Depth
 *
 * The Next.js middleware injects x-user-id, x-press-id, x-user-role headers
 * and signs them with an HMAC (x-middleware-sig). This module verifies that
 * signature in API route handlers to ensure the headers were genuinely set
 * by middleware and not forged by an external caller.
 *
 * Usage in API routes (opt-in):
 *   import { verifyMiddlewareHeaders } from '@/lib/middleware-verify';
 *   if (!verifyMiddlewareHeaders(request)) {
 *     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 *   }
 */

import crypto from 'crypto';

const MIDDLEWARE_SECRET = process.env.JWT_SECRET || 'dev-middleware-secret';

/**
 * Verify that the x-middleware-sig header matches the expected HMAC of the
 * injected user context headers. Returns true if valid.
 */
export function verifyMiddlewareHeaders(request: Request): boolean {
  const sig = request.headers.get('x-middleware-sig');
  const userId = request.headers.get('x-user-id');
  const pressId = request.headers.get('x-press-id');
  const role = request.headers.get('x-user-role');

  // If no sig header is present, the request didn't pass through middleware
  if (!sig || !userId || !pressId || !role) {
    return false;
  }

  const payload = `${userId}:${pressId}:${role}`;
  const expectedSig = crypto
    .createHmac('sha256', MIDDLEWARE_SECRET)
    .update(payload)
    .digest('hex')
    .slice(0, 32);

  if (sig.length !== expectedSig.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig));
}
