/**
 * prisma/migrate-json-to-relational.ts
 *
 * Phase 2 Section 1b: Back-populate TemplateField and CardholderValue
 * from the legacy JSON columns (frontFields/backFields and customFields).
 *
 * Run ONCE in production after deploying the schema migration:
 *   npx tsx prisma/migrate-json-to-relational.ts
 *
 * This script is idempotent — safe to re-run. Uses upsert for all rows.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ── Keyword-based category guesser ──────────────────────────────────────────
function guessCategory(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('certificate') || n.includes('cert')) return 'CERTIFICATE';
  if (n.includes('badge')) return 'BADGE';
  if (n.includes('label')) return 'LABEL';
  if (n.includes('ticket')) return 'TICKET';
  if (n.includes('visitor') || n.includes('pass')) return 'VISITOR_PASS';
  if (n.includes('letter')) return 'LETTER';
  if (n.includes('membership') || n.includes('member card')) return 'CARD';
  if (n.includes('tag')) return 'TAG';
  if (n.includes('sticker')) return 'STICKER';
  if (n.includes('id') || n.includes('identity') || n.includes('student') || n.includes('employee') || n.includes('staff')) return 'ID_CARD';
  return 'ID_CARD'; // safe default for ID card printing companies
}

async function main() {
  console.log('=== Phase 2 Migration: JSON → Relational ===\n');

  // ─────────────────────────────────────────────────────────────────────────
  // 1. Back-populate TemplateField from frontFields / backFields JSON
  // ─────────────────────────────────────────────────────────────────────────
  console.log('Step 1: Migrating template fields...');

  const templates = await prisma.cardTemplate.findMany({
    where: { isLatest: true },
  });

  let templateFieldsCreated = 0;
  let templateFieldsSkipped = 0;

  for (const tmpl of templates) {
    // Auto-set category if still "OTHER" (default) and can be guessed
    if (tmpl.category === 'OTHER') {
      const guessed = guessCategory(tmpl.name);
      await prisma.cardTemplate.update({
        where: { id: tmpl.id },
        data: { category: guessed },
      });
    }

    // Auto-set sides from backImageUrl presence
    const inferredSides = tmpl.backImageUrl ? 2 : 1;
    if (tmpl.sides !== inferredSides) {
      await prisma.cardTemplate.update({
        where: { id: tmpl.id },
        data: { sides: inferredSides },
      });
    }

    // Parse front fields
    let frontFields: any[] = [];
    let backFields: any[] = [];

    try {
      frontFields = JSON.parse(tmpl.frontFields || '[]');
    } catch {
      console.warn(`  ⚠ Template ${tmpl.id} (${tmpl.name}): invalid frontFields JSON — skipping`);
    }

    try {
      backFields = JSON.parse(tmpl.backFields || '[]');
    } catch {
      console.warn(`  ⚠ Template ${tmpl.id} (${tmpl.name}): invalid backFields JSON — skipping`);
    }

    const allFields = [
      ...frontFields.map((f: any) => ({ ...f, side: 'front' })),
      ...backFields.map((f: any) => ({ ...f, side: 'back' })),
    ];

    for (let i = 0; i < allFields.length; i++) {
      const f = allFields[i];
      if (!f.field) continue; // skip malformed entries

      try {
        await prisma.templateField.upsert({
          where: {
            templateId_field_side: {
              templateId: tmpl.id,
              field: f.field,
              side: f.side,
            },
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
            lineHeight: f.lineHeight ? Number(f.lineHeight) : 1.2,
            sortOrder: i,
          },
          create: {
            templateId: tmpl.id,
            field: f.field,
            type: f.type || 'text',
            side: f.side,
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
            lineHeight: f.lineHeight ? Number(f.lineHeight) : 1.2,
            sortOrder: i,
          },
        });
        templateFieldsCreated++;
      } catch (err: any) {
        console.warn(`  ⚠ Template ${tmpl.id} field "${f.field}" (${f.side}): ${err.message}`);
        templateFieldsSkipped++;
      }
    }
  }

  console.log(`  ✓ Templates processed: ${templates.length}`);
  console.log(`  ✓ TemplateField rows upserted: ${templateFieldsCreated}`);
  if (templateFieldsSkipped > 0) {
    console.log(`  ⚠ Skipped: ${templateFieldsSkipped}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Back-populate CardholderValue from customFields JSON
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\nStep 2: Migrating cardholder values...');

  // Process in batches of 500 to avoid memory issues
  const BATCH = 500;
  let offset = 0;
  let totalCardholders = 0;
  let valuesCreated = 0;
  let valuesSkipped = 0;

  while (true) {
    const cardholders = await prisma.cardholder.findMany({
      where: { customFields: { not: null } },
      take: BATCH,
      skip: offset,
      orderBy: { id: 'asc' },
    });

    if (cardholders.length === 0) break;
    offset += cardholders.length;
    totalCardholders += cardholders.length;

    for (const ch of cardholders) {
      let customFields: Record<string, any> = {};
      try {
        customFields = JSON.parse(ch.customFields || '{}');
      } catch {
        continue;
      }

      // Also migrate top-level fields (name, designation, photoUrl) as values
      const idVal = customFields.uniqueKey || customFields.id || customFields.unique_key || null;
      const allValues: Record<string, string> = {
        name: ch.name,
        ...(ch.designation ? { designation: ch.designation } : {}),
        ...(ch.photoUrl ? { photo: ch.photoUrl } : {}),
        ...(idVal ? { id: String(idVal) } : {}),
        ...(ch.cardSerial ? { cardSerial: ch.cardSerial } : {}),
        ...Object.fromEntries(
          Object.entries(customFields).map(([k, v]) => [k, v !== null && v !== undefined ? String(v) : ''])
        ),
      };

      for (const [field, value] of Object.entries(allValues)) {
        if (!field || value === undefined || value === null) continue;
        try {
          await prisma.cardholderValue.upsert({
            where: { cardholderId_field: { cardholderId: ch.id, field } },
            update: { value: String(value) },
            create: { cardholderId: ch.id, field, value: String(value) },
          });
          valuesCreated++;
        } catch (err: any) {
          valuesSkipped++;
        }
      }
    }

    console.log(`  → Processed ${offset} cardholders so far...`);
  }

  console.log(`  ✓ Cardholders processed: ${totalCardholders}`);
  console.log(`  ✓ CardholderValue rows upserted: ${valuesCreated}`);
  if (valuesSkipped > 0) {
    console.log(`  ⚠ Skipped: ${valuesSkipped}`);
  }

  console.log('\n=== Migration Complete ===');
  console.log('Both TemplateField and CardholderValue tables are now populated.');
  console.log('The system is in DOUBLE-WRITE phase. JSON columns are still active.');
}

main()
  .catch(e => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
