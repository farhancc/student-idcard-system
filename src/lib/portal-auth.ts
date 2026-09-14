/**
 * Tenant resolution for the public portal.
 *
 * Portal routes are unauthenticated in the session sense — the URL token *is*
 * the credential — so the middleware cannot tell the Prisma extension which
 * press a request belongs to. Each handler resolves its token here first, which
 * both rejects bad tokens and scopes every query that follows.
 */

import { basePrisma, enterPressContext } from '@/lib/prisma';

/**
 * Resolve any portal token — an org token, a department token, or either kind
 * of enrolment token — to the press that owns it, and adopt that press as the
 * tenant for the rest of the request.
 *
 * The lookup runs unscoped because identifying the tenant is its whole purpose;
 * it selects nothing but the id, so an invalid token reveals nothing.
 *
 * @returns the press id, or null when the token matches nothing.
 */
export async function enterPortalTenant(token: string): Promise<number | null> {
  if (!token) return null;

  // Deliberately cross-tenant, via the unextended client: identifying the
  // tenant is the whole point, and a tenant filter here would be circular.
  const share = await basePrisma.clientPortalShare.findFirst({
    where: { OR: [{ orgToken: token }, { enrollToken: token }] },
    select: { pressId: true },
  });
  const pressId =
    share?.pressId ??
    (
      await basePrisma.clientDepartment.findFirst({
        where: { OR: [{ deptToken: token }, { enrollToken: token }] },
        select: { portalShare: { select: { pressId: true } } },
      })
    )?.portalShare?.pressId ??
    null;

  if (pressId != null) enterPressContext(pressId);
  return pressId;
}
