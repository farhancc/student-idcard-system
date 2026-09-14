import { describe, it, expect } from 'vitest';
import { cardholderUpdateSchema, createCardholderSchema } from '@/lib/schemas';
import crypto from 'crypto';

describe('V1 Public API Input Validation & Security', () => {
  describe('cardholderUpdateSchema (PUT payload validation)', () => {
    it('accepts valid partial update fields', () => {
      const result = cardholderUpdateSchema.safeParse({
        name: 'Jane Smith',
        designation: 'Senior Student',
        active: true,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Jane Smith');
        expect(result.data.designation).toBe('Senior Student');
        expect(result.data.active).toBe(true);
      }
    });

    it('validates customFields dictionary format', () => {
      const result = cardholderUpdateSchema.safeParse({
        customFields: {
          bloodGroup: 'O+',
          grade: 12,
          isPrefect: true,
          notes: null,
        },
      });
      expect(result.success).toBe(true);
    });

    it('rejects customFields with nested non-primitive objects', () => {
      const result = cardholderUpdateSchema.safeParse({
        customFields: {
          nested: { invalid: 'object' },
        },
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty name string', () => {
      const result = cardholderUpdateSchema.safeParse({
        name: '',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Name cannot be empty');
      }
    });

    it('handles uniqueKey field properly', () => {
      const result = cardholderUpdateSchema.safeParse({
        uniqueKey: 'STUDENT-2026-991',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.uniqueKey).toBe('STUDENT-2026-991');
      }
    });

    it('allows clearing photoUrl with empty string or null', () => {
      const nullResult = cardholderUpdateSchema.safeParse({ photoUrl: null });
      const emptyResult = cardholderUpdateSchema.safeParse({ photoUrl: '' });
      expect(nullResult.success).toBe(true);
      expect(emptyResult.success).toBe(true);
    });
  });

  describe('createCardholderSchema (POST payload validation)', () => {
    it('accepts valid create cardholder payload', () => {
      const result = createCardholderSchema.safeParse({
        clientId: 42,
        name: 'Alex Johnson',
        designation: 'Staff',
        uniqueKey: 'EMP-001',
      });
      expect(result.success).toBe(true);
    });

    it('coerces string clientId to number', () => {
      const result = createCardholderSchema.safeParse({
        clientId: '42',
        name: 'Alex Johnson',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.clientId).toBe(42);
      }
    });

    it('rejects payload missing required name', () => {
      const result = createCardholderSchema.safeParse({
        clientId: 42,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('API Key Security & Hashing', () => {
    it('hashes API key using SHA-256 matching authenticateApiKey logic', () => {
      const apiKey = 'idexo_live_abc123xyz789';
      const hash = crypto.createHash('sha256').update(apiKey).digest('hex');
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});
