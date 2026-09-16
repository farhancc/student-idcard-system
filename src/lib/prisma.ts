import { PrismaClient } from '@prisma/client';
import { headers } from 'next/headers';
import { readVerifiedContext } from '@/lib/middleware-verify';
import { AsyncLocalStorage } from 'async_hooks';

export type TenantContext = { pressId: number } | { system: true };

/**
 * Pinned to globalThis, not module scope.
 *
 * The server bundle contains more than one copy of this module (Turbopack
 * emits it into several chunks), and a per-copy AsyncLocalStorage means the
 * copy that *sets* the context is not the copy the Prisma extension *reads* —
 * so a correctly-wrapped query still looks unscoped and throws. Same reason
 * the PrismaClient below is pinned.
 */
const globalForTenantCtx = globalThis as unknown as {
  __tenantCtxStore?: AsyncLocalStorage<TenantContext>;
};
const ctxStore: AsyncLocalStorage<TenantContext> =
  globalForTenantCtx.__tenantCtxStore ??
  (globalForTenantCtx.__tenantCtxStore = new AsyncLocalStorage<TenantContext>());

/** Run with an explicit tenant — for token-authenticated routes (portal, v1). */
export function withPressContext<T>(pressId: number, fn: () => Promise<T>): Promise<T> {
  return ctxStore.run({ pressId }, fn);
}

/** Run unscoped, deliberately — cron, superadmin, marketplace, seed. */
export function withSystemContext<T>(fn: () => Promise<T>): Promise<T> {
  return ctxStore.run({ system: true }, fn);
}

/** Run the remainder of the current request unscoped, deliberately. */
export function enterSystemContext(): void {
  ctxStore.enterWith({ system: true });
}

/**
 * Set the tenant for the remainder of the current request, rather than for the
 * duration of a callback.
 *
 * Token-authenticated routes (portal, v1) only learn their tenant part-way
 * through the handler, after looking the token up. Without this they would each
 * have to be re-indented into a withPressContext() closure.
 */
export function enterPressContext(pressId: number): void {
  ctxStore.enterWith({ pressId });
}

/**
 * Look a token up unscoped, then adopt the tenant it points at.
 *
 * The lookup itself cannot be tenant-scoped — the token *is* how we discover
 * which tenant this is — so it runs in system context and nothing else does.
 */
export async function resolveTenantFrom<T>(
  lookup: () => Promise<T>,
  getPressId: (found: NonNullable<T>) => number | null | undefined
): Promise<T> {
  const found = await withSystemContext(lookup);
  if (found != null) {
    const pressId = getPressId(found as NonNullable<T>);
    if (typeof pressId === 'number' && Number.isInteger(pressId)) {
      enterPressContext(pressId);
    }
  }
  return found;
}

async function resolveContext(): Promise<TenantContext | null> {
  const explicit = ctxStore.getStore();
  if (explicit) return explicit;
  try {
    // Only a signed context counts. The plain x-press-id header is settable by
    // any client on a route the middleware waves through, so reading it without
    // verifying the signature would let the caller pick their own tenant.
    const headersList = await headers();
    const verified = readVerifiedContext(name => headersList.get(name));
    if (verified) {
      return verified.scope === 'system' ? { system: true } : { pressId: verified.pressId };
    }
  } catch {
    // Outside a request context (build, seeding, scripts) — caller must wrap.
  }
  return null;
}

const globalForPrisma = global as unknown as { prisma: any };

const basePrisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = basePrisma;

// Export the raw client for cross-tenant reads (e.g. marketplace — shows ALL presses)
export { basePrisma };

async function syncTemplateFields(templateId: number, db: any = basePrisma) {
  const tmpl = await db.cardTemplate.findUnique({
    where: { id: templateId },
  });
  if (!tmpl) return;

  let frontFields: any[] = [];
  let backFields: any[] = [];
  try { if (tmpl.frontFields) frontFields = JSON.parse(tmpl.frontFields); } catch {}
  try { if (tmpl.backFields) backFields = JSON.parse(tmpl.backFields); } catch {}

  const merged = [
    ...frontFields.map((f: any) => ({ ...f, side: 'front' })),
    ...backFields.map((f: any) => ({ ...f, side: 'back' })),
  ];

  const activeKeys = new Set<string>();

  for (let i = 0; i < merged.length; i++) {
    const f = merged[i];
    if (!f.field) continue;
    const side = f.side || 'front';
    activeKeys.add(`${f.field}:${side}`);

    await db.templateField.upsert({
      where: {
        templateId_field_side: {
          templateId,
          field: f.field,
          side,
        }
      },
      update: {
        type: f.type || 'text',
        x: Number(f.x) || 0,
        y: Number(f.y) || 0,
        width: Number(f.width) || 100,
        height: Number(f.height) || 30,
        fontSize: f.fontSize ? Number(f.fontSize) : null,
        fontWeight: f.fontWeight || 'normal',
        fontFamily: f.fontFamily || null,
        color: f.color || '#000000',
        align: f.align || 'left',
        verticalAlign: f.verticalAlign || 'top',
        isRequired: Boolean(f.required || f.isRequired),
        prefix: f.prefix || null,
        suffix: f.suffix || null,
        lineHeight: f.lineHeight ? Number(f.lineHeight) : 1.2,
        sortOrder: i,
        validationPattern: f.validationPattern || f.pattern || null,
        maxLength: f.maxLength ? Number(f.maxLength) : (f.length ? Number(f.length) : null),
      },
      create: {
        templateId,
        field: f.field,
        type: f.type || 'text',
        side,
        x: Number(f.x) || 0,
        y: Number(f.y) || 0,
        width: Number(f.width) || 100,
        height: Number(f.height) || 30,
        fontSize: f.fontSize ? Number(f.fontSize) : null,
        fontWeight: f.fontWeight || 'normal',
        fontFamily: f.fontFamily || null,
        color: f.color || '#000000',
        align: f.align || 'left',
        verticalAlign: f.verticalAlign || 'top',
        isRequired: Boolean(f.required || f.isRequired),
        prefix: f.prefix || null,
        suffix: f.suffix || null,
        lineHeight: f.lineHeight ? Number(f.lineHeight) : 1.2,
        sortOrder: i,
        validationPattern: f.validationPattern || f.pattern || null,
        maxLength: f.maxLength ? Number(f.maxLength) : (f.length ? Number(f.length) : null),
      }
    });
  }

  const existingFields = await db.templateField.findMany({
    where: { templateId },
    select: { field: true, side: true }
  });

  for (const ef of existingFields) {
    if (!activeKeys.has(`${ef.field}:${ef.side}`)) {
      await db.templateField.delete({
        where: {
          templateId_field_side: {
            templateId,
            field: ef.field,
            side: ef.side,
          }
        }
      });
    }
  }
}

async function syncCardholderValues(cardholderId: number, db: any = basePrisma) {
  const ch = await db.cardholder.findUnique({
    where: { id: cardholderId },
  });
  if (!ch) return;

  let customFields: Record<string, any> = {};
  try { if (ch.customFields) customFields = JSON.parse(ch.customFields); } catch {}

  const idVal = customFields.uniqueKey || customFields.id || customFields.unique_key || null;

  const allValues: Record<string, string> = {
    name: ch.name,
    ...(ch.designation ? { designation: ch.designation } : {}),
    ...(ch.photoUrl ? { photo: ch.photoUrl } : {}),
    ...(idVal ? { id: String(idVal) } : {}),
    ...(ch.cardSerial ? { cardSerial: ch.cardSerial } : {}),
    ...Object.fromEntries(
      Object.entries(customFields)
        .filter(([k]) => k !== '__proto__' && k !== 'constructor' && k !== 'prototype')
        .map(([k, v]) => [k, v !== null && v !== undefined ? String(v) : ''])
    ),
  };

  const activeFields = new Set<string>();

  for (const [field, value] of Object.entries(allValues)) {
    if (!field || value === undefined || value === null) continue;
    activeFields.add(field);

    await db.cardholderValue.upsert({
      where: {
        cardholderId_field: {
          cardholderId,
          field,
        }
      },
      update: { value: String(value) },
      create: { cardholderId, field, value: String(value) }
    });
  }

  // Delete cardholder values no longer present
  const existingValues = await db.cardholderValue.findMany({
    where: { cardholderId },
    select: { field: true }
  });

  for (const ev of existingValues) {
    if (!activeFields.has(ev.field)) {
      await db.cardholderValue.delete({
        where: {
          cardholderId_field: {
            cardholderId,
            field: ev.field,
          }
        }
      });
    }
  }
}

export const TENANT_MODELS = [
  'PressUser', 'Client', 'Cardholder', 'CardTemplate', 'CardOrder',
  'OrderInvoice', 'CardSerialCounter', 'CardPrintRecord', 'PdfDownloadLog',
  'OrderActivityLog', 'PressFont', 'OrderNote', 'DeliveryRecord',
  'PressApiKey', 'PrintVendor', 'ClientPortalShare',
  'PdfJob', 'CardAsset', 'CreditRequest', 'CreditHold',
  'TemplatePurchase', 'TemplateLike', 'TemplateReport'
];

export const prisma = (basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }: any) {
        const tenantModels = TENANT_MODELS;

        // TemplatePurchase uses buyerPressId instead of the standard pressId column
        const pressIdField = model === 'TemplatePurchase' ? 'buyerPressId' : 'pressId';

        const op = operation as string;
        const ctx = await resolveContext();

        if (tenantModels.includes(model)) {
          if (ctx === null) {
            if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'test' || process.env.STRICT_TENANT_ENFORCEMENT === 'true') {
              throw new Error(
                `[TENANT ISOLATION] Blocked unscoped query on tenant model "${model}" (operation: ${op}). ` +
                `Wrap in withPressContext() or withSystemContext().`
              );
            } else {
              console.warn('[TENANT WARNING] unscoped query on tenant model:', {
                model,
                operation: op,
              });
            }
          } else if ('pressId' in ctx) {
            const pressId = ctx.pressId;
            // 1a. Rewrite findUnique → findFirst for tenant-scoped models
            //     (pressId is not part of unique constraints, so findUnique can't accept it)
            if (['findUnique', 'findUniqueOrThrow'].includes(op)) {
              args.where = args.where || {};
              if (model === 'CardTemplate') {
                const existingWhere = args.where;
                args.where = {
                  AND: [
                    existingWhere,
                    {
                      OR: [
                        { pressId: null },
                        { pressId: pressId }
                      ]
                    }
                  ]
                };
              } else {
                args.where[pressIdField] = pressId;
              }
              const rewrittenOp = op === 'findUnique' ? 'findFirst' : 'findFirstOrThrow';
              return (basePrisma as any)[model][rewrittenOp](args);
            }

            // 1b. Read operations (inject tenant filter & soft-delete filter)
            if (['findFirst', 'findMany', 'count', 'aggregate', 'groupBy', 'findFirstOrThrow'].includes(op)) {
              args.where = args.where || {};
              if (model === 'CardTemplate') {
                // Allow global templates (pressId is null) or tenant-specific templates
                const existingWhere = args.where;
                args.where = {
                  AND: [
                    existingWhere,
                    {
                      OR: [
                        { pressId: null },
                        { pressId: pressId }
                      ]
                    }
                  ]
                };
              } else {
                args.where[pressIdField] = pressId;
              }

              // Auto-filter soft-deleted records unless explicitly queried
              if (['Client', 'Cardholder', 'CardOrder'].includes(model) && args.where.deletedAt === undefined && !args.where.includeDeleted) {
                args.where.deletedAt = null;
              }
            }

            // Global safety net: cap findMany to 5000 rows unless explicitly set
            if (op === 'findMany' && args.take === undefined) {
              args.take = 5000;
            }

            // 2. Write operations (inject tenant on creation/modification)
            if (['create', 'createMany'].includes(op)) {
              if (Array.isArray(args.data)) {
                args.data = args.data.map((item: any) => ({ ...item, [pressIdField]: pressId }));
              } else {
                args.data = args.data || {};
                args.data[pressIdField] = pressId;
              }
            }

            if (['update', 'updateMany', 'delete', 'deleteMany', 'upsert'].includes(op)) {
              args.where = args.where || {};
              args.where[pressIdField] = pressId;
              if (op === 'upsert') {
                args.create = args.create || {};
                args.create[pressIdField] = pressId;
                args.update = args.update || {};
                args.update[pressIdField] = pressId;
              }
            }
          }
          // Note: if ctx is { system: true }, tenant filtering is deliberately skipped.
        }

        const result = await query(args);

        // Double-write logic for CardTemplate
        if (model === 'CardTemplate' && ['create', 'update', 'upsert'].includes(op) && result) {
          const items = Array.isArray(result) ? result : [result];
          for (const item of items) {
            if (item && item.id) {
              try {
                await syncTemplateFields(item.id, (this as any) || basePrisma);
              } catch (err) {
                console.error(`[Prisma Double-Write] Error syncing TemplateFields for template ${item.id}:`, err);
              }
            }
          }
        }

        // Double-write logic for Cardholder
        if (model === 'Cardholder' && ['create', 'update', 'upsert'].includes(op) && result) {
          const items = Array.isArray(result) ? result : [result];
          for (const item of items) {
            if (item && item.id) {
              try {
                await syncCardholderValues(item.id, (this as any) || basePrisma);
              } catch (err) {
                console.error(`[Prisma Double-Write] Error syncing CardholderValues for cardholder ${item.id}:`, err);
              }
            }
          }
        }

        return result;
      }
    }
  }
}) as unknown) as PrismaClient;
