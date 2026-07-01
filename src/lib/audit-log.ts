import { prisma } from '@/lib/prisma';

export type AuditCategory =
  | 'TEMPLATE'
  | 'SECURITY'
  | 'BILLING'
  | 'USER'
  | 'PORTAL'
  | 'ORDER'
  | 'SYSTEM';

export type AuditSeverity = 'INFO' | 'WARN' | 'CRITICAL';

export interface AuditLogEntry {
  pressId?: number | null;
  actorId?: number | null;
  actorType: 'PRESS_USER' | 'SUPER_ADMIN' | 'SYSTEM';
  actorName: string;
  action: string;
  category: AuditCategory;
  resourceType?: string;
  resourceId?: string | number;
  description: string;
  oldValue?: Record<string, any> | null;
  newValue?: Record<string, any> | null;
  ipAddress: string;
  userAgent?: string | null;
  severity?: AuditSeverity;
}

/**
 * Write a structured audit log entry to the database.
 * Fire-and-forget — never throws, so it never breaks the calling request.
 */
export async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    await (prisma as any).systemAuditLog.create({
      data: {
        pressId: entry.pressId ?? null,
        actorId: entry.actorId ?? null,
        actorType: entry.actorType,
        actorName: entry.actorName,
        action: entry.action,
        category: entry.category,
        resourceType: entry.resourceType ?? null,
        resourceId: entry.resourceId != null ? String(entry.resourceId) : null,
        description: entry.description,
        oldValue: entry.oldValue != null ? JSON.stringify(entry.oldValue) : null,
        newValue: entry.newValue != null ? JSON.stringify(entry.newValue) : null,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent ?? null,
        severity: entry.severity ?? 'INFO',
      },
    });
  } catch (err) {
    // Never crash the calling request due to audit logging failure
    console.error('[AuditLog] Failed to write audit log:', err);
  }
}

/**
 * Extract actor context from request headers (injected by middleware).
 */
export function getActorFromRequest(request: Request): {
  pressId: number | null;
  actorId: number | null;
  actorName: string;
  actorType: 'PRESS_USER' | 'SUPER_ADMIN' | 'SYSTEM';
  ipAddress: string;
  userAgent: string | null;
} {
  const pressIdStr = request.headers.get('x-press-id');
  const userIdStr = request.headers.get('x-user-id');
  const userName = request.headers.get('x-user-name') || 'Unknown User';
  const isSuperAdmin = request.headers.get('x-super-admin') === 'true';
  const ipAddress =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1';
  const userAgent = request.headers.get('user-agent');

  return {
    pressId: pressIdStr ? Number(pressIdStr) : null,
    actorId: userIdStr ? Number(userIdStr) : null,
    actorName: userName,
    actorType: isSuperAdmin ? 'SUPER_ADMIN' : 'PRESS_USER',
    ipAddress,
    userAgent,
  };
}

// ── Pre-built audit helpers for common actions ────────────────────────────

export const AuditActions = {
  // Templates
  TEMPLATE_CREATED: 'TEMPLATE_CREATED',
  TEMPLATE_UPDATED: 'TEMPLATE_UPDATED',
  TEMPLATE_DELETED: 'TEMPLATE_DELETED',
  TEMPLATE_CLONED: 'TEMPLATE_CLONED',

  // Security
  API_KEY_CREATED: 'API_KEY_CREATED',
  API_KEY_DELETED: 'API_KEY_DELETED',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILED: 'LOGIN_FAILED',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',

  // Billing / Plan
  PLAN_CHANGED: 'PLAN_CHANGED',
  CREDITS_ADDED: 'CREDITS_ADDED',
  INVOICE_GENERATED: 'INVOICE_GENERATED',

  // Users
  USER_CREATED: 'USER_CREATED',
  USER_UPDATED: 'USER_UPDATED',
  USER_DEACTIVATED: 'USER_DEACTIVATED',

  // Portal
  PORTAL_SHARE_CREATED: 'PORTAL_SHARE_CREATED',
  PORTAL_SHARE_REVOKED: 'PORTAL_SHARE_REVOKED',
  ENROLLMENT_SUBMITTED: 'ENROLLMENT_SUBMITTED',

  // Orders
  ORDER_STATUS_CHANGED: 'ORDER_STATUS_CHANGED',
  PDF_JOB_CREATED: 'PDF_JOB_CREATED',
  PDF_JOB_DELETED: 'PDF_JOB_DELETED',

  // System
  CRON_CLEANUP_RUN: 'CRON_CLEANUP_RUN',
  SETTINGS_UPDATED: 'SETTINGS_UPDATED',
} as const;
