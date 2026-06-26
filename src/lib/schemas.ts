/**
 * Centralised Zod schemas for API request validation.
 * Written for Zod v4+ (required_error removed; use message instead).
 * Import individual schemas in each route handler.
 */

import { z } from 'zod';

// ── Auth ─────────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z
    .string({ message: 'Email is required' })
    .email('Invalid email address')
    .max(255),
  password: z
    .string({ message: 'Password is required' })
    .min(1, 'Password is required')
    .max(256),
});

export const signupSchema = z.object({
  pressName: z
    .string({ message: 'Press name is required' })
    .min(2, 'Press name must be at least 2 characters')
    .max(150),
  ownerName: z
    .string({ message: 'Owner name is required' })
    .min(2, 'Owner name must be at least 2 characters')
    .max(150),
  email: z
    .string({ message: 'Email is required' })
    .email('Invalid email address')
    .max(255),
  password: z
    .string({ message: 'Password is required' })
    .min(8, 'Password must be at least 8 characters')
    .max(256),
  phone: z
    .string({ message: 'Phone number is required' })
    .min(7, 'Invalid phone number')
    .max(20)
    .regex(/^[+\d\s\-().]+$/, 'Invalid phone number format'),
  city: z.string().max(100).optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;

// ── Portal Enrollment ─────────────────────────────────────────────────────────

export const enrollSchema = z.object({
  name: z
    .string({ message: 'Name is required' })
    .min(1, 'Name is required')
    .max(150, 'Name is too long'),
  designation: z.string().max(150).nullable().optional(),
  photoUrl: z.string().url('Invalid photo URL').nullable().optional(),
  uniqueKey: z.string().max(100).nullable().optional(),
  customFields: z.record(z.string(), z.string().max(500)).optional(),
});

export type EnrollInput = z.infer<typeof enrollSchema>;

// ── Orders ────────────────────────────────────────────────────────────────────

export const updateOrderSchema = z.object({
  status: z
    .enum([
      'DRAFT',
      'APPROVAL_PDF_GENERATED',
      'APPROVAL_PDF_SENT',
      'APPROVED',
      'PRINTING',
      'DELIVERED',
    ])
    .optional(),
  notes: z.string().max(2000).nullable().optional(),
  validTill: z.string().datetime().nullable().optional(),
  deliveredTo: z.string().max(200).optional(),
  deliveredBy: z.string().max(200).optional(),
  deliveryRemarks: z.string().max(500).optional(),
  paymentStatus: z.enum(['UNPAID', 'PARTIAL', 'PAID']).optional(),
  paymentMethod: z.enum(['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE']).nullable().optional(),
});

export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
