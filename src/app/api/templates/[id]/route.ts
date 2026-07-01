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

    const { name, cardWidth, cardHeight, frontImageUrl, backImageUrl, frontOriginalUrl, backOriginalUrl, frontFields, backFields, clientId } = result.data;

    // 1. Transaction to handle versioning
    const newTemplate = await prisma.$transaction(async (tx) => {
      await tx.cardTemplate.update({
        where: { id: templateId },
        data: { isLatest: false },
      });

      return tx.cardTemplate.create({
        data: {
          pressId,
          clientId: clientId !== undefined ? (clientId ? Number(clientId) : null) : oldTemplate.clientId,
          name: name || oldTemplate.name,
          cardWidth: cardWidth ? Number(cardWidth) : oldTemplate.cardWidth,
          cardHeight: cardHeight ? Number(cardHeight) : oldTemplate.cardHeight,
          frontImageUrl: frontImageUrl || oldTemplate.frontImageUrl,
          backImageUrl: backImageUrl !== undefined ? backImageUrl : oldTemplate.backImageUrl,
          frontOriginalUrl: frontOriginalUrl !== undefined ? frontOriginalUrl : oldTemplate.frontOriginalUrl,
          backOriginalUrl: backOriginalUrl !== undefined ? backOriginalUrl : oldTemplate.backOriginalUrl,
          frontFields: frontFields || oldTemplate.frontFields,
          backFields: backFields || oldTemplate.backFields,
          version: oldTemplate.version + 1,
          parentId: oldTemplate.id,
          isLatest: true,
        },
      });
    });

    // 2. Mark any cached CardAssets as stale
    await prisma.cardAsset.updateMany({
      where: { templateId: oldTemplate.id },
      data: { isStale: true },
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
