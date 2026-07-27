import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/marketplace/publish  — seller marks their template as public
// Body: { templateId, price, description }
export async function POST(request: Request) {
  try {
    const pressIdStr = request.headers.get('x-press-id');
    if (!pressIdStr) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const pressId = Number(pressIdStr);

    const body = await request.json();
    const { templateId, price = 0, cdrFileUrl, psdFileUrl, aiFileUrl, pdfFileUrl } = body;

    if (!templateId) return NextResponse.json({ error: 'templateId required' }, { status: 400 });

    // Verify ownership
    const template = await prisma.cardTemplate.findFirst({
      where: { id: Number(templateId), pressId },
    });
    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

    // Check listing fee from system settings if template is not already public
    if (!template.isPublic) {
      const feeSetting = await prisma.systemSetting.findUnique({
        where: { key: 'marketplace_listing_fee' },
      });
      const listingFee = Number(feeSetting?.value || '0');

      if (listingFee > 0) {
        // Only deduct from paid credits (not promo) for listing
        const press = await prisma.press.findUnique({ where: { id: pressId }, select: { credits: true } });
        if (!press || press.credits < listingFee) {
          return NextResponse.json(
            { error: `Insufficient credits for listing fee. Required: ${listingFee} credits.` },
            { status: 402 }
          );
        }
        await prisma.press.update({
          where: { id: pressId },
          data: { credits: { decrement: listingFee } },
        });
      }
    }

    const updated = await prisma.cardTemplate.update({
      where: { id: Number(templateId) },
      data: {
        isPublic: true,
        price: Math.max(0, Number(price)),
        ...(cdrFileUrl !== undefined && { cdrFileUrl }),
        ...(psdFileUrl !== undefined && { psdFileUrl }),
        ...(aiFileUrl !== undefined && { aiFileUrl }),
        ...(pdfFileUrl !== undefined && { pdfFileUrl }),
      },
    });

    return NextResponse.json({
      success: true,
      template: {
        id: updated.id,
        isPublic: updated.isPublic,
        price: updated.price,
        cdrFileUrl: updated.cdrFileUrl,
        psdFileUrl: updated.psdFileUrl,
        aiFileUrl: updated.aiFileUrl,
        pdfFileUrl: updated.pdfFileUrl,
      },
    });
  } catch (error: any) {
    console.error('Marketplace publish error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/marketplace/publish?templateId=X  — unpublish (delist)
export async function DELETE(request: Request) {
  try {
    const pressIdStr = request.headers.get('x-press-id');
    if (!pressIdStr) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const pressId = Number(pressIdStr);

    const { searchParams } = new URL(request.url);
    const templateId = Number(searchParams.get('templateId'));
    if (!templateId) return NextResponse.json({ error: 'templateId required' }, { status: 400 });

    const template = await prisma.cardTemplate.findFirst({ where: { id: templateId, pressId } });
    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

    await prisma.cardTemplate.update({
      where: { id: templateId },
      data: { isPublic: false },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
