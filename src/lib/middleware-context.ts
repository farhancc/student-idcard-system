/**
 * The shape of the request context the proxy/middleware injects, and the exact
 * string it signs.
 *
 * Kept dependency-free so both sides can import it: the middleware runs on the
 * edge runtime (WebCrypto) and the verifier runs on Node (`node:crypto`). If
 * these two ever build the payload differently, every signed request fails
 * closed — which is why the string lives here and not in either of them.
 */

export type TenantScope = 'tenant' | 'system';

export interface MiddlewareContext {
  userId: number;
  pressId: number;
  role: string;
  /**
   * 'tenant'  — queries are confined to `pressId`.
   * 'system'  — deliberately unscoped (superadmin). Only the middleware can
   *             assert this, because only the middleware can sign it.
   */
  scope: TenantScope;
}

export const MIDDLEWARE_HEADERS = {
  userId: 'x-user-id',
  pressId: 'x-press-id',
  role: 'x-user-role',
  name: 'x-user-name',
  scope: 'x-tenant-scope',
  signature: 'x-middleware-sig',
} as const;

/** Every header the middleware owns. Client-supplied copies must be dropped. */
export const INJECTED_HEADER_NAMES: readonly string[] = Object.values(MIDDLEWARE_HEADERS);

export function middlewareSigPayload(ctx: MiddlewareContext): string {
  return `${ctx.userId}:${ctx.pressId}:${ctx.role}:${ctx.scope}`;
}

/** Truncated to 128 bits — ample for an integrity tag on a same-process hop. */
export const SIGNATURE_HEX_LENGTH = 32;
