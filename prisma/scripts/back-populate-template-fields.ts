/**
 * Back-population script: TemplateField + CardholderValue
 *
 * Run: npx tsx prisma/scripts/back-populate-template-fields.ts
 *
 * What this does:
 *   1. For every CardTemplate: parse frontFields + backFields JSON arrays,
 *      create TemplateField rows (upsert on templateId + field + side).
 *   2. For every Cardholder with customFields JSON: create CardholderValue rows
 *      (upsert on cardholderId + field).
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface RawField {
  field: string;
  type: string;
  label?: string;
  required?: boolean;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fontSize?: number;
  fontWeight?: string;
  fontFamily?: string;
  color?: string;
  align?: string;
}

async function main() {
  console.log('=== Phase 2 Back-Population Script ===\n');

  // ── Step 1: Populate TemplateField from JSON ────────────────────────────
  const templates = await prisma.cardTemplate.findMany({
    select: { id: true, name: true, frontFields: true, backFields: true },
  });

  console.log(`Found ${templates.length} templates. Syncing TemplateField records...`);

  let tfCreated = 0;
  let tfSkipped = 0;

  for (const tmpl of templates) {
    let front: RawField[] = [];
    let back: RawField[] = [];

    try { front = JSON.parse(tmpl.frontFields || '[]'); } catch {}
    try { back = JSON.parse(tmpl.backFields || '[]'); } catch {}

    const fieldsBySide: Array<{ f: RawField; side: string }> = [
      ...front.map(f => ({ f, side: 'front' })),
      ...back.map(f => ({ f, side: 'back' })),
    ];

    for (const { f, side } of fieldsBySide) {
      if (!f.field) continue;
      try {
        await prisma.templateField.upsert({
          where: { templateId_field_side: { templateId: tmpl.id, field: f.field, side } },
          update: {
            type: f.type || 'text',
            x: f.x ?? 0,
            y: f.y ?? 0,
            width: f.width ?? 100,
            height: f.height ?? 30,
            fontSize: f.fontSize ?? null,
            fontWeight: f.fontWeight ?? 'normal',
            color: f.color ?? '#000000',
          },
          create: {
            templateId: tmpl.id,
            field: f.field,
            type: f.type || 'text',
            side,
            x: f.x ?? 0,
            y: f.y ?? 0,
            width: f.width ?? 100,
            height: f.height ?? 30,
            fontSize: f.fontSize ?? null,
            fontWeight: f.fontWeight ?? 'normal',
            color: f.color ?? '#000000',
            isRequired: f.required ?? false,
            sortOrder: 0,
          },
        });
        tfCreated++;
      } catch (err: any) {
        console.warn(`  [SKIP] Template ${tmpl.id} field "${f.field}" (${side}): ${err.message}`);
        tfSkipped++;
      }
    }

    console.log(`  Template "${tmpl.name}" (id=${tmpl.id}): ${fieldsBySide.length} fields processed`);
  }

  console.log(`\nTemplateFields — created/updated: ${tfCreated}, skipped: ${tfSkipped}`);

  // ── Step 2: Populate CardholderValue from customFields JSON ────────────
  console.log('\nSyncing CardholderValue records from cardholder customFields...');

  let cvCreated = 0;
  let cvSkipped = 0;

  const BATCH_SIZE = 200;
  let offset = 0;

  while (true) {
    const cardholders = await prisma.cardholder.findMany({
      skip: offset,
      take: BATCH_SIZE,
      select: { id: true, customFields: true, templateId: true },
      where: { customFields: { not: null } },
    });

    if (cardholders.length === 0) break;
    offset += BATCH_SIZE;

    for (const ch of cardholders) {
      if (!ch.customFields) continue;

      let parsed: Record<string, any> = {};
      try { parsed = JSON.parse(ch.customFields); } catch { continue; }

      for (const [fieldKey, value] of Object.entries(parsed)) {
        if (value === undefined || value === null || value === '') continue;

        try {
          await prisma.cardholderValue.upsert({
            where: { cardholderId_field: { cardholderId: ch.id, field: fieldKey } },
            update: { value: String(value) },
            create: { cardholderId: ch.id, field: fieldKey, value: String(value) },
          });
          cvCreated++;
        } catch {
          cvSkipped++;
        }
      }
    }

    console.log(`  Processed batch up to offset ${offset}...`);
  }

  console.log(`\nCardholderValues — created/updated: ${cvCreated}, skipped: ${cvSkipped}`);
  console.log('\n=== Back-population complete! ===');
}

main()
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
