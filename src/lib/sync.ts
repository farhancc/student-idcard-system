import { prisma } from '@/lib/prisma';

/**
 * Synchronizes front and back JSON field configurations to the TemplateField table.
 */
export async function syncTemplateFields(templateId: number, frontFieldsStr: string, backFieldsStr: string) {
  let frontFields = [];
  let backFields = [];
  try {
    frontFields = JSON.parse(frontFieldsStr || '[]');
  } catch (e) {
    console.error(`Failed to parse frontFields for template ID ${templateId}:`, e);
  }
  try {
    backFields = JSON.parse(backFieldsStr || '[]');
  } catch (e) {
    console.error(`Failed to parse backFields for template ID ${templateId}:`, e);
  }

  await prisma.$transaction([
    // Delete existing template fields
    prisma.templateField.deleteMany({
      where: { templateId }
    }),
    // Re-create from JSON
    prisma.templateField.createMany({
      data: [
        ...frontFields.map((f: any) => ({
          templateId,
          side: 'front',
          field: f.field,
          type: f.type || 'text',
          x: Number(f.x) || 0,
          y: Number(f.y) || 0,
          width: Number(f.width) || 0,
          height: Number(f.height) || 0,
          fontSize: f.fontSize ? Number(f.fontSize) : null,
          color: f.color || null,
          align: f.align || null,
          fontName: f.fontName || null,
          isRequired: !!f.required
        })),
        ...backFields.map((f: any) => ({
          templateId,
          side: 'back',
          field: f.field,
          type: f.type || 'text',
          x: Number(f.x) || 0,
          y: Number(f.y) || 0,
          width: Number(f.width) || 0,
          height: Number(f.height) || 0,
          fontSize: f.fontSize ? Number(f.fontSize) : null,
          color: f.color || null,
          align: f.align || null,
          fontName: f.fontName || null,
          isRequired: !!f.required
        }))
      ].reduce((acc: any[], current) => {
        // Enforce uniqueness constraint [templateId, side, field]
        const key = `${current.side}-${current.field.toLowerCase()}`;
        if (!acc.some(item => `${item.side}-${item.field.toLowerCase()}` === key)) {
          acc.push(current);
        }
        return acc;
      }, [])
    })
  ]);
}

/**
 * Synchronizes a cardholder's JSON custom fields into CardholderValue relational records,
 * matching them against template fields defined for templates belonging to the press/client.
 */
export async function syncCardholderValues(cardholderId: number, clientId: number, customFieldsJsonOrObj: any) {
  let customFields: Record<string, any> = {};
  if (typeof customFieldsJsonOrObj === 'string') {
    try {
      customFields = JSON.parse(customFieldsJsonOrObj || '{}');
    } catch (e) {
      customFields = {};
    }
  } else if (customFieldsJsonOrObj && typeof customFieldsJsonOrObj === 'object') {
    customFields = customFieldsJsonOrObj;
  }

  // Get cardholder
  const cardholder = await prisma.cardholder.findUnique({
    where: { id: cardholderId }
  });
  if (!cardholder) return;

  // Add standard fields to customFields map to ensure they can map if template fields reference them
  if (cardholder.name) customFields.name = cardholder.name;
  if (cardholder.designation) customFields.designation = cardholder.designation;

  // Find all TemplateFields that might apply to this client
  const templateFields = await prisma.templateField.findMany({
    where: {
      template: {
        OR: [
          { clientId },
          { clientId: null }
        ]
      }
    }
  });

  const valuesToInsert = [];
  for (const [key, val] of Object.entries(customFields)) {
    if (val === undefined || val === null) continue;
    const valStr = String(val).trim();

    // Match case-insensitive
    const matchingFields = templateFields.filter(f => f.field.toLowerCase() === key.toLowerCase());
    for (const field of matchingFields) {
      valuesToInsert.push({
        cardholderId,
        fieldId: field.id,
        value: valStr
      });
    }
  }

  await prisma.$transaction([
    prisma.cardholderValue.deleteMany({
      where: { cardholderId }
    }),
    ...(valuesToInsert.length > 0 ? [
      prisma.cardholderValue.createMany({
        data: valuesToInsert.reduce((acc: any[], current) => {
          const exists = acc.some(item => item.fieldId === current.fieldId);
          if (!exists) {
            acc.push(current);
          }
          return acc;
        }, [])
      })
    ] : [])
  ]);
}
