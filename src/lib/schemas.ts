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
  photoUrl: z.string().max(10 * 1024 * 1024, 'Photo data is too large').nullable().optional(),
  uniqueKey: z.string().max(100).nullable().optional(),
  customFields: z.record(z.string(), z.string().max(10 * 1024 * 1024, 'Custom field data is too large')).optional(),
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

// ── Clients ───────────────────────────────────────────────────────────────────

export const clientSchema = z.object({
  name: z.string({ message: 'Name is required' }).min(1, 'Name is required').max(150, 'Name is too long'),
  type: z.string({ message: 'Type is required' }).max(50),
  contactName: z.string().max(150).nullable().optional(),
  contactPhone: z.string().max(20).nullable().optional(),
  contactEmail: z.union([z.string().email('Invalid email address').max(255), z.literal(''), z.null()]).optional(),
  address: z.string().max(500).nullable().optional(),
});

export const updateClientSchema = clientSchema.partial();

export type ClientInput = z.infer<typeof clientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;

// ── Templates ─────────────────────────────────────────────────────────────────

export const templateSchema = z.object({
  name: z.string({ message: 'Template name is required' }).min(1, 'Template name is required').max(150),
  cardWidth: z.union([z.number(), z.string()]).transform(val => Number(val)).optional(),
  cardHeight: z.union([z.number(), z.string()]).transform(val => Number(val)).optional(),
  frontImageUrl: z.string({ message: 'Front Image URL is required' }).url('Invalid front image URL'),
  backImageUrl: z.string().url('Invalid back image URL').nullable().optional().or(z.literal('')),
  frontOriginalUrl: z.string().url('Invalid front original URL').nullable().optional().or(z.literal('')),
  backOriginalUrl: z.string().url('Invalid back original URL').nullable().optional().or(z.literal('')),
  frontFields: z.string().max(10 * 1024 * 1024).optional().or(z.array(z.any())).transform(val => typeof val === 'string' ? val : JSON.stringify(val)),
  backFields: z.string().max(10 * 1024 * 1024).optional().or(z.array(z.any())).transform(val => typeof val === 'string' ? val : JSON.stringify(val)),
  clientId: z.union([z.number(), z.string()]).transform(val => val ? Number(val) : null).nullable().optional(),
});

export type TemplateInput = z.infer<typeof templateSchema>;
export const updateTemplateSchema = templateSchema.partial();
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;

// ── Cardholders ───────────────────────────────────────────────────────────────

export const cardholderUpdateSchema = z.object({
  name: z.string().min(1, 'Name cannot be empty').max(150).optional(),
  designation: z.string().max(150).nullable().optional(),
  photoUrl: z.string().max(1000).nullable().optional().or(z.literal('')),
  uniqueKey: z.string().max(100).nullable().optional(),
  customFields: z.record(z.string(), z.any()).nullable().optional(),
  active: z.boolean().optional(),
});

export type CardholderUpdateInput = z.infer<typeof cardholderUpdateSchema>;

// ── SuperAdmin ────────────────────────────────────────────────────────────────

export const creditUpdateSchema = z.object({
  pressId: z.union([z.number(), z.string()]).transform(val => Number(val)),
  amount: z.union([z.number(), z.string()]).transform(val => Number(val)),
});

export type CreditUpdateInput = z.infer<typeof creditUpdateSchema>;

