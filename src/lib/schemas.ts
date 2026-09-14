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

export const TEMPLATE_CATEGORIES = [
  'ID_CARD', 'CERTIFICATE', 'BADGE', 'LABEL', 'TICKET',
  'VISITOR_PASS', 'LETTER', 'CARD', 'TAG', 'STICKER', 'OTHER',
] as const;

export type TemplateCategory = typeof TEMPLATE_CATEGORIES[number];

export const templateSchema = z.object({
  name: z.string({ message: 'Template name is required' }).min(1, 'Template name is required').max(150),
  cardWidth: z.union([z.number(), z.string()]).transform(val => Number(val)).optional(),
  cardHeight: z.union([z.number(), z.string()]).transform(val => Number(val)).optional(),
  frontImageUrl: z.string({ message: 'Front Image URL is required' }).min(1, 'Front Image URL is required'),
  backImageUrl: z.string().nullable().optional(),
  frontOriginalUrl: z.string().nullable().optional(),
  backOriginalUrl: z.string().nullable().optional(),
  frontFields: z.string().max(10 * 1024 * 1024).optional().or(z.array(z.any())).transform(val => typeof val === 'string' ? val : JSON.stringify(val)),
  backFields: z.string().max(10 * 1024 * 1024).optional().or(z.array(z.any())).transform(val => typeof val === 'string' ? val : JSON.stringify(val)),
  clientId: z.union([z.number(), z.string()]).transform(val => val ? Number(val) : null).nullable().optional(),
  category: z.enum(TEMPLATE_CATEGORIES).optional().default('OTHER'),
  sides: z.union([z.literal(1), z.literal(2)]).optional().default(1),
  clientIds: z.array(z.union([z.number(), z.string()]).transform(val => Number(val))).optional(),
  cdrFileUrl: z.string().nullable().optional(),
  psdFileUrl: z.string().nullable().optional(),
  aiFileUrl: z.string().nullable().optional(),
  pdfFileUrl: z.string().nullable().optional(),
});

export type TemplateInput = z.infer<typeof templateSchema>;
export const updateTemplateSchema = templateSchema.partial();
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;

// ── Cardholders ───────────────────────────────────────────────────────────────

export const cardholderUpdateSchema = z.object({
  name: z.string().min(1, 'Name cannot be empty').max(150).optional(),
  designation: z.string().max(150).nullable().optional(),
  photoUrl: z.string().max(10 * 1024 * 1024, 'Photo data is too large').nullable().optional().or(z.literal('')),
  uniqueKey: z.string().max(500).nullable().optional(),
  customFields: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).nullable().optional(),
  active: z.boolean().optional(),
});

export type CardholderUpdateInput = z.infer<typeof cardholderUpdateSchema>;

// ── SuperAdmin ────────────────────────────────────────────────────────────────

export const creditUpdateSchema = z.object({
  pressId: z.union([z.number(), z.string()]).transform(val => Number(val)).refine(val => !isNaN(val) && val > 0, 'Press ID must be a positive number'),
  amount: z.union([z.number(), z.string()]).transform(val => Number(val)).refine(val => !isNaN(val) && val > 0, 'Credit amount must be greater than 0'),
});

export type CreditUpdateInput = z.infer<typeof creditUpdateSchema>;

// ── Password & User Management ────────────────────────────────────────────────

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string({ message: 'Current password is required' })
      .min(1, 'Current password is required'),
    newPassword: z
      .string({ message: 'New password is required' })
      .min(8, 'New password must be at least 8 characters long')
      .max(256),
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'New password must be different from current password',
    path: ['newPassword'],
  });

export const superadminLoginSchema = z.object({
  email: z
    .string({ message: 'Email is required' })
    .email('Invalid email address')
    .max(255),
  password: z
    .string({ message: 'Password is required' })
    .min(1, 'Password is required')
    .max(256),
});

export const createUserSchema = z.object({
  name: z
    .string({ message: 'Name is required' })
    .min(1, 'Name is required')
    .max(150),
  email: z
    .string({ message: 'Email is required' })
    .email('Invalid email address')
    .max(255),
  password: z
    .string({ message: 'Password is required' })
    .min(8, 'Password must be at least 8 characters long')
    .max(256),
  role: z.enum(['OWNER', 'OPERATOR', 'DESIGNER'], { message: 'Invalid role' }),
});

export const creditRequestSchema = z.object({
  amount: z.union([z.number(), z.string()]).transform(val => Number(val)).refine(val => !isNaN(val) && val > 0, { message: 'Amount must be a positive number' }),
});

export const marketplacePurchaseSchema = z.object({
  templateId: z.union([z.number(), z.string()]).transform(val => Number(val)).refine(val => !isNaN(val) && val > 0, { message: 'templateId required' }),
});

export const createCardholderSchema = z.object({
  clientId: z.union([z.number(), z.string()]).transform(val => Number(val)).optional(),
  name: z.string({ message: 'Name is required' }).min(1, 'Name is required').max(150),
  designation: z.string().max(150).nullable().optional(),
  photoUrl: z.string().max(10 * 1024 * 1024, 'Photo data is too large').nullable().optional().or(z.literal('')),
  uniqueKey: z.string().max(500).nullable().optional(),
  customFields: z.union([
    z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
    z.string().transform(val => {
      try { return JSON.parse(val); } catch { return {}; }
    })
  ]).nullable().optional(),
  ignoreDuplicate: z.boolean().optional(),
  templateId: z.union([z.number(), z.string()]).transform(val => Number(val)).optional(),
});

export const createOrderSchema = z.object({
  clientId: z.union([z.number(), z.string()]).transform(val => Number(val)).refine(val => !isNaN(val) && val > 0, { message: 'Client ID is required' }),
  templateId: z.union([z.number(), z.string()]).transform(val => Number(val)).refine(val => !isNaN(val) && val > 0, { message: 'Template ID is required' }),
  cardholderIds: z.array(z.union([z.number(), z.string()]).transform(val => Number(val))).min(1, 'Cardholder IDs array cannot be empty'),
  validTill: z.string().nullable().optional(),
  pricePerCard: z.union([z.number(), z.string()]).transform(val => Number(val)).optional(),
  status: z.enum(['DRAFT', 'APPROVAL_PDF_GENERATED', 'APPROVAL_PDF_SENT', 'APPROVED', 'PRINTING', 'DELIVERED']).optional(),
});



