import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  signUserToken,
  signSuperAdminToken,
  verifyToken,
  UserSessionPayload,
  SuperAdminSessionPayload,
} from '@/lib/auth';

describe('Authentication & JWT System', () => {
  describe('Password Hashing', () => {
    it('hashes passwords and verifies valid passwords', async () => {
      const password = 'mySecretPassword123!';
      const hash = await hashPassword(password);

      expect(hash).not.toBe(password);
      expect(typeof hash).toBe('string');

      const isMatch = await verifyPassword(password, hash);
      expect(isMatch).toBe(true);
    });

    it('rejects incorrect passwords', async () => {
      const password = 'correctPassword';
      const hash = await hashPassword(password);

      const isMatch = await verifyPassword('wrongPassword', hash);
      expect(isMatch).toBe(false);
    });
  });

  describe('JWT Token Lifecycle', () => {
    it('signs and verifies valid Press User JWT tokens', async () => {
      const userPayload: UserSessionPayload = {
        userId: 42,
        pressId: 7,
        email: 'operator@press.com',
        role: 'OPERATOR',
        name: 'John Operator',
      };

      const token = await signUserToken(userPayload);
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // Standard JWT format: header.payload.signature

      const verified = await verifyToken(token);
      expect(verified).not.toBeNull();
      expect(verified?.userId).toBe(42);
      expect(verified?.pressId).toBe(7);
      expect(verified?.role).toBe('OPERATOR');
      expect(verified?.email).toBe('operator@press.com');
    });

    it('signs and verifies Super Admin JWT tokens', async () => {
      const adminPayload: SuperAdminSessionPayload = {
        adminId: 1,
        email: 'admin@idexo.com',
        name: 'Super Admin',
        isSuperAdmin: true,
      };

      const token = await signSuperAdminToken(adminPayload);
      expect(typeof token).toBe('string');

      const verified = await verifyToken(token);
      expect(verified).not.toBeNull();
      expect(verified?.isSuperAdmin).toBe(true);
      expect(verified?.email).toBe('admin@idexo.com');
    });

    it('returns null for tampered or invalid tokens', async () => {
      const invalidToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalidpayload.invalidsignature';
      const verified = await verifyToken(invalidToken);
      expect(verified).toBeNull();
    });

    it('returns null for completely malformed string', async () => {
      const verified = await verifyToken('random_garbage_string');
      expect(verified).toBeNull();
    });
  });
});
