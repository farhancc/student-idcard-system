import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { updateTemplateSchema } from '@/lib/schemas';
import { writeAuditLog, getActorFromRequest, AuditActions } from '@/lib/audit-log';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const pressIdStr = request.headers.get('x-press-id');
    if (!pressIdStr) {
      return NextResponse.json({ error: 'Missing Press ID' }, { status: 400 });
    }
    const pressId = Number(pressIdStr);
    const { id } = await params;
    const templateId = Number(id);

    const template = await prisma.cardTemplate.findFirst({
      where: {
        id: templateId,
        OR: [{ pressId }, { pressId: null }],
      },
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, template });
  } catch (error) {
    console.error('Get template error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/templates/[id] -> Versioning (M11)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const pressIdStr = request.headers.get('x-press-id');
    if (!pressIdStr) {
      return NextResponse.json({ error: 'Missing Press ID' }, { status: 400 });
    }
    const pressId = Number(pressIdStr);
    const { id } = await params;
    const templateId = Number(id);
    const actor = getActorFromRequest(request);

    const oldTemplate = await prisma.cardTemplate.findFirst({
      where: { id: templateId, pressId },
    });

    if (!oldTemplate) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const body = await request.json();
    const result = updateTemplateSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
    }

    const { name, cardWidth, cardHeight, frontImageUrl, backImageUrl, frontOriginalUrl, backOriginalUrl, frontFields, backFields, clientId, category, sides, clientIds } = result.data;

    // Check if the template name is being changed and is already taken
    if (name && name.trim().toLowerCase() !== oldTemplate.name.trim().toLowerCase()) {
      const existing = await prisma.cardTemplate.findFirst({
        where: {
          pressId,
          isLatest: true,
          name: {
            equals: name.trim(),
            mode: 'insensitive',
          },
        },
      });
      if (existing) {
        return NextResponse.json({ error: `A template with the name "${name.trim()}" already exists` }, { status: 400 });
      }
    }

    // Sanitize frontFields / backFields input to guarantee valid JSON strings
    const sanitizedFrontFields = frontFields !== undefined
      ? (typeof frontFields === 'string' ? frontFields : JSON.stringify(frontFields))
      : oldTemplate.frontFields;

    const sanitizedBackFields = backFields !== undefined
      ? (typeof backFields === 'string' ? backFields : JSON.stringify(backFields))
      : oldTemplate.backFields;

    // 1. Update template in-place (same ID) so all existing orders/cardholders/shares
    //    automatically pick up the latest fields without any FK cascading.
    const newTemplate = await prisma.$transaction(async (tx) => {
      const updated = await tx.cardTemplate.update({
        where: { id: templateId },
        data: {
          name: name || oldTemplate.name,
          cardWidth: cardWidth ? Number(cardWidth) : oldTemplate.cardWidth,
          cardHeight: cardHeight ? Number(cardHeight) : oldTemplate.cardHeight,
          frontImageUrl: frontImageUrl || oldTemplate.frontImageUrl,
          backImageUrl: backImageUrl !== undefined ? backImageUrl : oldTemplate.backImageUrl,
          frontOriginalUrl: frontOriginalUrl !== undefined ? frontOriginalUrl : oldTemplate.frontOriginalUrl,
          backOriginalUrl: backOriginalUrl !== undefined ? backOriginalUrl : oldTemplate.backOriginalUrl,
          frontFields: sanitizedFrontFields,
          backFields: sanitizedBackFields,
          category: category || (oldTemplate as any).category || 'OTHER',
          sides: sides || (oldTemplate as any).sides || 1,
          clientId: clientId !== undefined ? (clientId ? Number(clientId) : null) : oldTemplate.clientId,
          version: { increment: 1 },
          isLatest: true,
        },
      });

      // 2. Synchronize normalized TemplateField table
      await tx.templateField.deleteMany({ where: { templateId } });

      let parsedFront: any[] = [];
      let parsedBack: any[] = [];
      try { parsedFront = JSON.parse(sanitizedFrontFields || '[]'); } catch {}
      try { parsedBack = JSON.parse(sanitizedBackFields || '[]'); } catch {}

      const fieldRows = [
        ...parsedFront.map((f: any, idx: number) => ({
          templateId,
          field: f.field,
          type: f.type || 'text',
          side: 'front',
          x: Number(f.x || 0),
          y: Number(f.y || 0),
          width: Number(f.width || 0),
          height: Number(f.height || 0),
          fontSize: f.fontSize ? Number(f.fontSize) : null,
          fontWeight: f.fontWeight || 'normal',
          fontFamily: f.fontFamily || null,
          color: f.color || '#000000',
          align: f.align || 'left',
          verticalAlign: f.verticalAlign || 'top',
          isRequired: Boolean(f.required || f.isRequired),
          prefix: f.prefix || null,
          lineHeight: f.lineHeight ? Number(f.lineHeight) : 1.2,
          sortOrder: idx + 1,
        })),
        ...parsedBack.map((f: any, idx: number) => ({
          templateId,
          field: f.field,
          type: f.type || 'text',
          side: 'back',
          x: Number(f.x || 0),
          y: Number(f.y || 0),
          width: Number(f.width || 0),
          height: Number(f.height || 0),
          fontSize: f.fontSize ? Number(f.fontSize) : null,
          fontWeight: f.fontWeight || 'normal',
          fontFamily: f.fontFamily || null,
          color: f.color || '#000000',
          align: f.align || 'left',
          verticalAlign: f.verticalAlign || 'top',
          isRequired: Boolean(f.required || f.isRequired),
          prefix: f.prefix || null,
          lineHeight: f.lineHeight ? Number(f.lineHeight) : 1.2,
          sortOrder: idx + 1,
        })),
      ];

      if (fieldRows.length > 0) {
        await tx.templateField.createMany({ data: fieldRows });
      }

      // Sync client assignments if provided
      if (clientIds !== undefined) {
        await tx.templateClientAssignment.deleteMany({ where: { templateId } });
        if (clientIds.length > 0) {
          await tx.templateClientAssignment.createMany({
            data: clientIds.map((cid) => ({ templateId, clientId: cid })),
            skipDuplicates: true,
          });
        }
      }

      // Mark all cached card assets as stale so re-renders are forced on next compile
      await tx.cardAsset.updateMany({
        where: { templateId },
        data: { isStale: true },
      });

      // Also update the templateVersion on active orders so the daemon knows the layout changed
      await tx.cardOrder.updateMany({
        where: { templateId, status: { not: 'DELIVERED' } },
        data: { templateVersion: updated.version },
      });

      return updated;
    });

    // 3. Audit log
    writeAuditLog({
      ...actor,
      action: AuditActions.TEMPLATE_UPDATED,
      category: 'TEMPLATE',
      resourceType: 'CardTemplate',
      resourceId: newTemplate.id,
      description: `Template "${newTemplate.name}" updated to v${newTemplate.version}`,
      oldValue: { name: oldTemplate.name, version: oldTemplate.version },
      newValue: { name: newTemplate.name, version: newTemplate.version, id: newTemplate.id },
      severity: 'INFO',
    });

    return NextResponse.json({
      success: true,
      message: `Template updated to version ${newTemplate.version}`,
      template: newTemplate,
    });
  } catch (error) {
    console.error('Update template error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const pressIdStr = request.headers.get('x-press-id');
    if (!pressIdStr) {
      return NextResponse.json({ error: 'Missing Press ID' }, { status: 400 });
    }
    const pressId = Number(pressIdStr);
    const { id } = await params;
    const templateId = Number(id);
    const actor = getActorFromRequest(request);

    const template = await prisma.cardTemplate.findFirst({
      where: { id: templateId, pressId },
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    await prisma.cardTemplate.delete({ where: { id: templateId } });

    // Audit log
    writeAuditLog({
      ...actor,
      action: AuditActions.TEMPLATE_DELETED,
      category: 'TEMPLATE',
      resourceType: 'CardTemplate',
      resourceId: templateId,
      description: `Template "${template.name}" (v${template.version}) deleted`,
      oldValue: { name: template.name, version: template.version },
      severity: 'WARN',
    });

    return NextResponse.json({ success: true, message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Delete template error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
