import { PrismaClient } from '@prisma/client';
import { headers } from 'next/headers';

const globalForPrisma = global as unknown as { prisma: any };

const basePrisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = basePrisma;

async function getCurrentPressId(): Promise<number | null> {
  try {
    // In Next.js 15+, headers() is asynchronous and must be awaited
    const headersList = await headers();
    const pressIdStr = headersList.get('x-press-id');
    return pressIdStr ? Number(pressIdStr) : null;
  } catch {
    // Fallback when outside of a request context (e.g. build, seeding, cron jobs)
    return null;
  }
}

export const prisma = (basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }: any) {
        const tenantModels = [
          'PressUser', 'Client', 'Cardholder', 'CardTemplate', 'CardOrder',
          'OrderInvoice', 'CardSerialCounter', 'CardPrintRecord', 'PdfDownloadLog',
          'OrderActivityLog', 'PressFont', 'OrderNote', 'DeliveryRecord',
          'PressApiKey', 'PrintVendor', 'ClientPortalShare', 'ClientDepartment'
        ];

        if (!tenantModels.includes(model)) {
          return query(args);
        }

        const pressId = await getCurrentPressId();
        if (pressId === null) {
          return query(args);
        }

        const op = operation as string;

        // 1. Read operations (inject tenant filter)
        if (['findFirst', 'findMany', 'count', 'aggregate', 'groupBy'].includes(op)) {
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
            args.where.pressId = pressId;
          }
        }

        // 2. Write operations (inject tenant on creation/modification)
        if (['create', 'createMany'].includes(op)) {
          if (Array.isArray(args.data)) {
            args.data = args.data.map((item: any) => ({ ...item, pressId }));
          } else {
            args.data = args.data || {};
            args.data.pressId = pressId;
          }
        }

        if (['update', 'updateMany', 'delete', 'deleteMany', 'upsert'].includes(op)) {
          args.where = args.where || {};
          args.where.pressId = pressId;
          if (op === 'upsert') {
            args.create = args.create || {};
            args.create.pressId = pressId;
            args.update = args.update || {};
            args.update.pressId = pressId;
          }
        }

        return query(args);
      }
    }
  }
}) as unknown) as PrismaClient;
