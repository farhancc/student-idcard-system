import { describe, it, expect } from 'vitest';
import {
  loginSchema,
  signupSchema,
  enrollSchema,
  updateOrderSchema,
  clientSchema,
  templateSchema,
  cardholderUpdateSchema,
  creditUpdateSchema,
} from '@/lib/schemas';

describe('Zod Validation Schemas', () => {
  describe('loginSchema', () => {
    it('accepts valid email and password', () => {
      const result = loginSchema.safeParse({
        email: 'operator@press.com',
        password: 'securePassword123',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('operator@press.com');
      }
    });

    it('rejects invalid email formats', () => {
      const result = loginSchema.safeParse({
        email: 'not-an-email',
        password: 'password123',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Invalid email');
      }
    });

    it('rejects missing password', () => {
      const result = loginSchema.safeParse({
        email: 'user@test.com',
        password: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('signupSchema', () => {
    it('validates complete signup input', () => {
      const result = signupSchema.safeParse({
        pressName: 'Apex Prints',
        ownerName: 'Jane Doe',
        email: 'jane@apexprints.com',
        password: 'superSecretPassword123',
        phone: '+1234567890',
        city: 'Metropolis',
      });
      expect(result.success).toBe(true);
    });

    it('rejects short passwords (< 8 chars)', () => {
      const result = signupSchema.safeParse({
        pressName: 'Apex Prints',
        ownerName: 'Jane Doe',
        email: 'jane@apexprints.com',
        password: 'short',
        phone: '+1234567890',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid phone characters', () => {
      const result = signupSchema.safeParse({
        pressName: 'Apex Prints',
        ownerName: 'Jane Doe',
        email: 'jane@apexprints.com',
        password: 'validPassword123',
        phone: 'INVALID_PHONE_###',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('enrollSchema', () => {
    it('accepts valid cardholder portal enrollment data', () => {
      const result = enrollSchema.safeParse({
        name: 'John Smith',
        designation: 'Student',
        customFields: { grade: '10th', rollNo: '1024' },
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty name', () => {
      const result = enrollSchema.safeParse({
        name: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('updateOrderSchema', () => {
    it('allows valid order status transitions', () => {
      const result = updateOrderSchema.safeParse({
        status: 'APPROVED',
        notes: 'Client approved proof PDF',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid status values', () => {
      const result = updateOrderSchema.safeParse({
        status: 'NON_EXISTENT_STATUS',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('clientSchema', () => {
    it('validates client registration payload', () => {
      const result = clientSchema.safeParse({
        name: 'St. Jude High School',
        type: 'SCHOOL',
        contactEmail: 'info@stjude.edu',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('templateSchema', () => {
    it('validates template data and transforms JSON strings', () => {
      const result = templateSchema.safeParse({
        name: 'Modern Student ID',
        frontImageUrl: 'https://cloudinary.com/front.png',
        category: 'ID_CARD',
        sides: 2,
        frontFields: [{ id: 1, type: 'text', field: 'name' }],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(typeof result.data.frontFields).toBe('string');
      }
    });

    it('rejects unknown template categories', () => {
      const result = templateSchema.safeParse({
        name: 'Invalid Template',
        frontImageUrl: 'https://cloudinary.com/front.png',
        category: 'INVALID_CATEGORY',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('creditUpdateSchema', () => {
    it('coerces string numbers to integers for admin credit update', () => {
      const result = creditUpdateSchema.safeParse({
        pressId: '12',
        amount: '500',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.pressId).toBe(12);
        expect(result.data.amount).toBe(500);
      }
    });
  });
});
