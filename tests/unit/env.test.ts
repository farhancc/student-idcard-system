import { describe, it, expect } from 'vitest';
import { envSchema } from '@/lib/env';

describe('Environment Variable Validation Schema', () => {
  it('validates a complete environment configuration', () => {
    const result = envSchema.safeParse({
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/idexo',
      JWT_SECRET: 'super-secret-jwt-signing-key-production-12345',
      NODE_ENV: 'production',
      CRON_SECRET: 'cron_sec_abcdef123',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.DATABASE_URL).toContain('postgresql://');
      expect(result.data.JWT_SECRET).toBe('super-secret-jwt-signing-key-production-12345');
      expect(result.data.NODE_ENV).toBe('production');
    }
  });

  it('rejects short JWT_SECRET (< 16 characters)', () => {
    const result = envSchema.safeParse({
      DATABASE_URL: 'postgresql://localhost:5432/db',
      JWT_SECRET: 'short-secret',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('at least 16 characters');
    }
  });

  it('defaults NODE_ENV to development when omitted', () => {
    const result = envSchema.safeParse({
      DATABASE_URL: 'postgresql://localhost:5432/db',
      JWT_SECRET: 'valid-secret-at-least-16-chars-long',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.NODE_ENV).toBe('development');
    }
  });
});
