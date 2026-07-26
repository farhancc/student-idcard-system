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

async function syncTemplateFields(templateId: number) {
  const tmpl = await basePrisma.cardTemplate.findUnique({
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

    await basePrisma.templateField.upsert({
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

  const existingFields = await basePrisma.templateField.findMany({
    where: { templateId },
    select: { field: true, side: true }
  });

  for (const ef of existingFields) {
    if (!activeKeys.has(`${ef.field}:${ef.side}`)) {
      await basePrisma.templateField.delete({
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

async function syncCardholderValues(cardholderId: number) {
  const ch = await basePrisma.cardholder.findUnique({
    where: { id: cardholderId },
  });
  if (!ch) return;

  let customFields: Record<string, any> = {};
  try { if (ch.customFields) customFields = JSON.parse(ch.customFields); } catch {}

  const allValues: Record<string, string> = {
    name: ch.name,
    ...(ch.designation ? { designation: ch.designation } : {}),
    ...(ch.photoUrl ? { photo: ch.photoUrl } : {}),
    ...(ch.uniqueKey ? { id: ch.uniqueKey } : {}),
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

    await basePrisma.cardholderValue.upsert({
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
  const existingValues = await basePrisma.cardholderValue.findMany({
    where: { cardholderId },
    select: { field: true }
  });

  for (const ev of existingValues) {
    if (!activeFields.has(ev.field)) {
      await basePrisma.cardholderValue.delete({
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

export const prisma = (basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }: any) {
        const tenantModels = [
          'PressUser', 'Client', 'Cardholder', 'CardTemplate', 'CardOrder',
          'OrderInvoice', 'CardSerialCounter', 'CardPrintRecord', 'PdfDownloadLog',
          'OrderActivityLog', 'PressFont', 'OrderNote', 'DeliveryRecord',
          'PressApiKey', 'PrintVendor', 'ClientPortalShare'
        ];

        const op = operation as string;
        const pressId = await getCurrentPressId();

        if (tenantModels.includes(model) && pressId !== null) {
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
        }

        const result = await query(args);

        // Double-write logic for CardTemplate
        if (model === 'CardTemplate' && ['create', 'update', 'upsert'].includes(op) && result) {
          const items = Array.isArray(result) ? result : [result];
          for (const item of items) {
            if (item && item.id) {
              try {
                await syncTemplateFields(item.id);
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
                await syncCardholderValues(item.id);
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
