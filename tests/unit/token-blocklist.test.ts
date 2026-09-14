import { describe, it, expect } from 'vitest';
import { revokeToken, isTokenRevoked } from '@/lib/token-blocklist';
import { signUserToken, verifyToken } from '@/lib/auth';

describe('JWT Token Revocation & Blocklist', () => {
  it('identifies un-revoked tokens as valid', async () => {
    const isRev = await isTokenRevoked('random-non-existent-jti-12345');
    expect(isRev).toBe(false);
  });

  it('revokes a token by jti and prevents verification', async () => {
    const token = await signUserToken({
      userId: 1,
      pressId: 1,
      email: 'test@example.com',
      role: 'OWNER',
      name: 'Test Owner',
    });

    const payloadBefore = await verifyToken(token);
    expect(payloadBefore).not.toBeNull();
    expect(payloadBefore?.jti).toBeDefined();

    if (payloadBefore?.jti) {
      await revokeToken(payloadBefore.jti);
      const isRev = await isTokenRevoked(payloadBefore.jti);
      expect(isRev).toBe(true);

      const payloadAfter = await verifyToken(token);
      expect(payloadAfter).toBeNull();
    }
  });
});
