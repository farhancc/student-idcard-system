import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { getActor, requireRole } from '@/lib/authz';
import {
  SIGNATURE_HEX_LENGTH,
  TenantScope,
  middlewareSigPayload,
} from '@/lib/middleware-context';

// Signs with the same payload builder the middleware uses, so this test fails
// if the two ever disagree rather than silently testing a stale format.
function computeSig(userId: string, pressId: string, role: string, scope: TenantScope = 'tenant'): string {
  const secret = process.env.JWT_SECRET || 'dev-middleware-secret';
  const payload = middlewareSigPayload({
    userId: Number(userId),
    pressId: Number(pressId),
    role,
    scope,
  });
  return crypto.createHmac('sha256', secret).update(payload).digest('hex').slice(0, SIGNATURE_HEX_LENGTH);
}

describe('authz helper', () => {
  it('returns null when headers are missing', () => {
    const request = new Request('http://localhost/api/test');
    expect(getActor(request)).toBeNull();
  });

  it('returns null when x-middleware-sig is invalid or forged', () => {
    const request = new Request('http://localhost/api/test', {
      headers: {
        'x-user-id': '42',
        'x-press-id': '7',
        'x-user-role': 'OWNER',
        'x-middleware-sig': 'invalid_forged_signature_here_32',
      },
    });
    expect(getActor(request)).toBeNull();
  });

  it('parses actor correctly when signed headers are present', () => {
    const userId = '42';
    const pressId = '7';
    const role = 'OWNER';
    const sig = computeSig(userId, pressId, role);

    const request = new Request('http://localhost/api/test', {
      headers: {
        'x-user-id': userId,
        'x-press-id': pressId,
        'x-user-role': role,
        'x-user-name': encodeURIComponent('Alice Manager'),
        'x-middleware-sig': sig,
      },
    });

    const actor = getActor(request);
    expect(actor).toEqual({
      userId: 42,
      pressId: 7,
      role: 'OWNER',
      name: 'Alice Manager',
    });
  });

  it('returns 401 response from requireRole when unauthenticated', () => {
    const request = new Request('http://localhost/api/test');
    const result = requireRole(request, ['OWNER', 'OPERATOR']);
    expect('response' in result).toBe(true);
    if ('response' in result) {
      expect(result.response.status).toBe(401);
    }
  });

  it('returns 403 response from requireRole when role is unauthorized', () => {
    const userId = '42';
    const pressId = '7';
    const role = 'DESIGNER';
    const sig = computeSig(userId, pressId, role);

    const request = new Request('http://localhost/api/test', {
      headers: {
        'x-user-id': userId,
        'x-press-id': pressId,
        'x-user-role': role,
        'x-middleware-sig': sig,
      },
    });
    const result = requireRole(request, ['OWNER', 'OPERATOR']);
    expect('response' in result).toBe(true);
    if ('response' in result) {
      expect(result.response.status).toBe(403);
    }
  });

  it('returns actor from requireRole when role is allowed', () => {
    const userId = '42';
    const pressId = '7';
    const role = 'OPERATOR';
    const sig = computeSig(userId, pressId, role);

    const request = new Request('http://localhost/api/test', {
      headers: {
        'x-user-id': userId,
        'x-press-id': pressId,
        'x-user-role': role,
        'x-middleware-sig': sig,
      },
    });
    const result = requireRole(request, ['OWNER', 'OPERATOR']);
    expect('actor' in result).toBe(true);
    if ('actor' in result) {
      expect(result.actor.role).toBe('OPERATOR');
      expect(result.actor.pressId).toBe(7);
    }
  });
});
