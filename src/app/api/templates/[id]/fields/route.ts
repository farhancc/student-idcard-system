import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/templates/[id]/fields
 * Returns TemplateField rows for a given template (both sides).
 * Used by the column-mapping import UI to show which fields need to be mapped.
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const templateId = Number(params.id);
  if (isNaN(templateId)) {
    return NextResponse.json({ error: 'Invalid template ID' }, { status: 400 });
  }

  // Verify template exists
  const template = await prisma.cardTemplate.findUnique({
    where: { id: templateId },
    select: { id: true, name: true, frontFields: true, backFields: true },
  });

  if (!template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  // Prefer normalized TemplateField rows
  const dbFields = await prisma.templateField.findMany({
    where: { templateId },
    orderBy: [{ side: 'asc' }, { sortOrder: 'asc' }],
    select: {
      field: true,
      type: true,
      side: true,
      isRequired: true,
      fontSize: true,
      color: true,
      prefix: true,
    },
  });

  // Fallback: if no TemplateField rows exist yet, parse from JSON columns
  if (dbFields.length === 0) {
    let frontFields: any[] = [];
    let backFields: any[] = [];
    try { frontFields = JSON.parse(template.frontFields || '[]'); } catch {}
    try { backFields = JSON.parse(template.backFields || '[]'); } catch {}

    const merged = [
      ...frontFields.map((f: any) => ({ ...f, side: 'front' })),
      ...backFields.map((f: any) => ({ ...f, side: 'back' })),
    ];

    const seen = new Set<string>();
    const deduplicated = merged.filter(f => {
      const key = `${f.field}:${f.side}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return NextResponse.json({
      templateId,
      templateName: template.name,
      fields: deduplicated.map((f: any) => ({
        field: f.field,
        type: f.type || 'text',
        side: f.side,
        isRequired: Boolean(f.required || f.isRequired),
        prefix: f.prefix || null,
      })),
      source: 'json_fallback',
    });
  }

  return NextResponse.json({
    templateId,
    templateName: template.name,
    fields: dbFields,
    source: 'template_fields',
  });
}
