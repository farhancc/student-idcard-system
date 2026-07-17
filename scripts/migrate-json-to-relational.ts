import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting migration: JSON to relational tables...');

  // 1. Migrate Templates
  const templates = await prisma.cardTemplate.findMany();
  console.log(`Found ${templates.length} templates to migrate.`);

  for (const template of templates) {
    console.log(`Migrating template: ${template.name} (ID: ${template.id})...`);
    
    let frontFields = [];
    let backFields = [];
    try {
      frontFields = JSON.parse(template.frontFields || '[]');
    } catch (e) {
      console.warn(`Failed to parse frontFields for template ID ${template.id}`);
    }
    try {
      backFields = JSON.parse(template.backFields || '[]');
    } catch (e) {
      console.warn(`Failed to parse backFields for template ID ${template.id}`);
    }

    // Delete existing template fields to start fresh
    await prisma.templateField.deleteMany({
      where: { templateId: template.id }
    });

    const fieldsToInsert = [];

    // Map front fields
    for (const f of frontFields) {
      if (!f.field) continue;
      fieldsToInsert.push({
        templateId: template.id,
        side: 'front',
        field: f.field,
        type: f.type || 'text',
        x: Number(f.x) || 0,
        y: Number(f.y) || 0,
        width: Number(f.width) || 100,
        height: Number(f.height) || 20,
        fontSize: f.fontSize ? Number(f.fontSize) : null,
        color: f.color || null,
        align: f.align || null,
        fontName: f.fontName || null,
        isRequired: !!f.required
      });
    }

    // Map back fields
    for (const f of backFields) {
      if (!f.field) continue;
      fieldsToInsert.push({
        templateId: template.id,
        side: 'back',
        field: f.field,
        type: f.type || 'text',
        x: Number(f.x) || 0,
        y: Number(f.y) || 0,
        width: Number(f.width) || 100,
        height: Number(f.height) || 20,
        fontSize: f.fontSize ? Number(f.fontSize) : null,
        color: f.color || null,
        align: f.align || null,
        fontName: f.fontName || null,
        isRequired: !!f.required
      });
    }

    if (fieldsToInsert.length > 0) {
      // Avoid duplicate keys
      const uniqueFields: any[] = [];
      const seen = new Set();
      for (const field of fieldsToInsert) {
        const key = `${field.templateId}-${field.side}-${field.field.toLowerCase()}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueFields.push(field);
        }
      }
      await prisma.templateField.createMany({
        data: uniqueFields
      });
    }
  }

  // 2. Migrate Cardholders
  const cardholders = await prisma.cardholder.findMany();
  console.log(`Found ${cardholders.length} cardholders to migrate.`);

  // Get all template fields to match keys
  const allTemplateFields = await prisma.templateField.findMany();

  for (const cardholder of cardholders) {
    let customFields: Record<string, any> = {};
    if (cardholder.customFields) {
      try {
        customFields = JSON.parse(cardholder.customFields || '{}');
      } catch (e) {
        console.warn(`Failed to parse customFields for cardholder ID ${cardholder.id}`);
      }
    }

    // Also include standard fields as potential values (e.g. name, designation)
    if (cardholder.name) customFields.name = cardholder.name;
    if (cardholder.designation) customFields.designation = cardholder.designation;

    await prisma.cardholderValue.deleteMany({
      where: { cardholderId: cardholder.id }
    });

    const valuesToInsert = [];
    const templateFieldsForClient = allTemplateFields.filter(f => f.templateId !== null); // or filter by client

    for (const [key, val] of Object.entries(customFields)) {
      if (val === undefined || val === null) continue;
      const valStr = String(val).trim();

      // Find matching template fields (match case-insensitive)
      const matchingFields = allTemplateFields.filter(f => f.field.toLowerCase() === key.toLowerCase());
      for (const field of matchingFields) {
        valuesToInsert.push({
          cardholderId: cardholder.id,
          fieldId: field.id,
          value: valStr
        });
      }
    }

    if (valuesToInsert.length > 0) {
      // Remove duplicate combinations of cardholderId and fieldId
      const uniqueValues: any[] = [];
      const seen = new Set();
      for (const v of valuesToInsert) {
        const key = `${v.cardholderId}-${v.fieldId}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueValues.push(v);
        }
      }
      await prisma.cardholderValue.createMany({
        data: uniqueValues
      });
    }
  }

  console.log('Migration complete!');
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
