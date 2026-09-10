import { describe, it, expect } from 'vitest';
import { getActor, requireRole } from '@/lib/authz';

describe('authz helper', () => {
  it('returns null when headers are missing', () => {
    const request = new Request('http://localhost/api/test');
    expect(getActor(request)).toBeNull();
  });

  it('parses actor correctly when headers are present', () => {
    const request = new Request('http://localhost/api/test', {
      headers: {
        'x-user-id': '42',
        'x-press-id': '7',
        'x-user-role': 'OWNER',
        'x-user-name': encodeURIComponent('Alice Manager'),
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
    const request = new Request('http://localhost/api/test', {
      headers: {
        'x-user-id': '42',
        'x-press-id': '7',
        'x-user-role': 'DESIGNER',
      },
    });
    const result = requireRole(request, ['OWNER', 'OPERATOR']);
    expect('response' in result).toBe(true);
    if ('response' in result) {
      expect(result.response.status).toBe(403);
    }
  });

  it('returns actor from requireRole when role is allowed', () => {
    const request = new Request('http://localhost/api/test', {
      headers: {
        'x-user-id': '42',
        'x-press-id': '7',
        'x-user-role': 'OPERATOR',
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
