import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
      where: { id: templateId, pressId },
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

    const oldTemplate = await prisma.cardTemplate.findFirst({
      where: { id: templateId, pressId },
    });

    if (!oldTemplate) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const { name, cardWidth, cardHeight, frontImageUrl, backImageUrl, frontFields, backFields, clientId } = await request.json();

    // 1. Transaction to handle versioning
    const newTemplate = await prisma.$transaction(async (tx) => {
      // Mark older version as not latest
      await tx.cardTemplate.update({
        where: { id: templateId },
        data: { isLatest: false },
      });

      // Create new version
      return tx.cardTemplate.create({
        data: {
          pressId,
          clientId: clientId !== undefined ? (clientId ? Number(clientId) : null) : oldTemplate.clientId,
          name: name || oldTemplate.name,
          cardWidth: cardWidth ? Number(cardWidth) : oldTemplate.cardWidth,
          cardHeight: cardHeight ? Number(cardHeight) : oldTemplate.cardHeight,
          frontImageUrl: frontImageUrl || oldTemplate.frontImageUrl,
          backImageUrl: backImageUrl !== undefined ? backImageUrl : oldTemplate.backImageUrl,
          frontFields: frontFields || oldTemplate.frontFields,
          backFields: backFields || oldTemplate.backFields,
          version: oldTemplate.version + 1,
          parentId: oldTemplate.id,
          isLatest: true,
        },
      });
    });

    // 2. Mark any cached CardAssets as stale because coordinates changed
    await prisma.cardAsset.updateMany({
      where: { templateId: oldTemplate.id },
      data: { isStale: true },
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

    const template = await prisma.cardTemplate.findFirst({
      where: { id: templateId, pressId },
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Delete (historical versions can be deleted or kept. Let's delete this specific latest version)
    await prisma.cardTemplate.delete({
      where: { id: templateId },
    });

    return NextResponse.json({
      success: true,
      message: 'Template deleted successfully',
    });
  } catch (error) {
    console.error('Delete template error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
