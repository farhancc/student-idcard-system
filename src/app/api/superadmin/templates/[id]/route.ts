import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { updateTemplateSchema } from '@/lib/schemas';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const templateId = Number(id);

    const template = await prisma.cardTemplate.findFirst({
      where: { id: templateId, pressId: null },
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, template });
  } catch (error) {
    console.error('Superadmin get template error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const templateId = Number(id);

    const oldTemplate = await prisma.cardTemplate.findFirst({
      where: { id: templateId, pressId: null },
    });

    if (!oldTemplate) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const body = await request.json();
    const result = updateTemplateSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
    }

    const { name, cardWidth, cardHeight, frontImageUrl, backImageUrl, frontOriginalUrl, backOriginalUrl, frontFields, backFields } = result.data;

    const newTemplate = await prisma.$transaction(async (tx) => {
      // Mark older version as not latest
      await tx.cardTemplate.update({
        where: { id: templateId },
        data: { isLatest: false },
      });

      // Create new version
      return tx.cardTemplate.create({
        data: {
          pressId: null, // Global
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

    // Mark any cached CardAssets as stale because coordinates changed
    await prisma.cardAsset.updateMany({
      where: { templateId: oldTemplate.id },
      data: { isStale: true },
    });

    return NextResponse.json({
      success: true,
      message: `Global template updated to version ${newTemplate.version}`,
      template: newTemplate,
    });
  } catch (error) {
    console.error('Superadmin update template error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const templateId = Number(id);

    const template = await prisma.cardTemplate.findFirst({
      where: { id: templateId, pressId: null },
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    await prisma.cardTemplate.delete({
      where: { id: templateId },
    });

    return NextResponse.json({
      success: true,
      message: 'Global template deleted successfully',
    });
  } catch (error) {
    console.error('Superadmin delete template error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
