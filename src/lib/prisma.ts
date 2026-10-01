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

export const TENANT_MODELS = [
  'PressUser', 'Client', 'Cardholder', 'CardTemplate', 'CardOrder',
  'OrderInvoice', 'CardSerialCounter', 'CardPrintRecord', 'PdfDownloadLog',
  'OrderActivityLog', 'PressFont', 'OrderNote', 'DeliveryRecord',
  'PressApiKey', 'PrintVendor', 'ClientPortalShare',
  'PdfJob', 'CardAsset', 'CreditRequest', 'CreditHold',
  'TemplatePurchase', 'TemplateLike', 'TemplateReport'
];

// Tenant models that also carry rows shared with every press (pressId: null) —
// global templates and the built-in/superadmin-provided font library. Reads on
// these must OR in the null-pressId rows rather than being narrowed to the
// current tenant only, the way every other tenant model is.
const MODELS_WITH_GLOBAL_ROWS = ['CardTemplate', 'PressFont'];

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
              if (MODELS_WITH_GLOBAL_ROWS.includes(model)) {
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
              if (MODELS_WITH_GLOBAL_ROWS.includes(model)) {
                // Allow global rows (pressId is null) or tenant-specific rows
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
            // createManyAndReturn takes the same array-of-rows shape as
            // createMany; without it listed here a caller that forgets to set
            // pressId in the payload writes rows with no tenant.
            if (['create', 'createMany', 'createManyAndReturn'].includes(op)) {
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

        return query(args);
      }
    }
  }
}) as unknown) as PrismaClient;
