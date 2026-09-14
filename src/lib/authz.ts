import { NextResponse } from 'next/server';
import { getVerifiedContext } from '@/lib/middleware-verify';
import { getSuperAdminSession, SuperAdminSessionPayload } from '@/lib/auth';

export type { SuperAdminSessionPayload };

export async function requireSuperAdmin(): Promise<
  { admin: SuperAdminSessionPayload } | { response: NextResponse }
> {
  const session = await getSuperAdminSession();
  if (!session) {
    return {
      response: NextResponse.json({ error: 'Unauthorized: SuperAdmin access required' }, { status: 401 }),
    };
  }
  return { admin: session };
}

export interface Actor {
  userId: number;
  pressId: number;
  role: string;
  name: string;
}

export function getActor(request: Request): Actor | null {
  const ctx = getVerifiedContext(request);
  if (!ctx) return null;

  const rawName = request.headers.get('x-user-name');
  return {
    userId: ctx.userId,
    pressId: ctx.pressId,
    role: ctx.role,
    name: rawName ? decodeURIComponent(rawName) : 'Operator',
  };
}

/**
 * Convenience wrapper: returns the verified Actor or an early 401 Response.
 * Use in routes that need any authenticated user regardless of role.
 */
export function requireActor(
  request: Request
): { actor: Actor } | { response: NextResponse } {
  const actor = getActor(request);
  if (!actor) {
    return {
      response: NextResponse.json({ error: 'Unauthorized session' }, { status: 401 }),
    };
  }
  return { actor };
}

export function requireRole(
  request: Request,
  allowedRoles: string[]
): { actor: Actor } | { response: NextResponse } {
  const actor = getActor(request);

  if (!actor) {
    return {
      response: NextResponse.json({ error: 'Unauthorized session' }, { status: 401 }),
    };
  }

  if (!allowedRoles.includes(actor.role)) {
    return {
      response: NextResponse.json(
        { error: `Forbidden: role '${actor.role}' is not allowed to perform this action` },
        { status: 403 }
      ),
    };
  }

  return { actor };
}
