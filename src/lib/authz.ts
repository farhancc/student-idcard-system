import { NextResponse } from 'next/server';
import { verifyMiddlewareHeaders } from '@/lib/middleware-verify';

export interface Actor {
  userId: number;
  pressId: number;
  role: string;
  name: string;
}

export function getActor(request: Request): Actor | null {
  if (!verifyMiddlewareHeaders(request)) {
    return null;
  }

  const userIdStr = request.headers.get('x-user-id');
  const pressIdStr = request.headers.get('x-press-id');
  const role = request.headers.get('x-user-role');
  const rawName = request.headers.get('x-user-name');

  if (!userIdStr || !pressIdStr || !role) {
    return null;
  }

  const userId = Number(userIdStr);
  const pressId = Number(pressIdStr);

  if (isNaN(userId) || isNaN(pressId)) {
    return null;
  }

  const name = rawName ? decodeURIComponent(rawName) : 'Operator';

  return {
    userId,
    pressId,
    role,
    name,
  };
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
