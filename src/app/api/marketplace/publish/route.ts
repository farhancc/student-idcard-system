import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireActor } from '@/lib/authz';
import { marketplacePublishSchema } from '@/lib/schemas';
import { acceptanceContextFromRequest, recordLegalAcceptance } from '@/lib/legal/acceptance';

export const dynamic = 'force-dynamic';

// POST /api/marketplace/publish  — seller marks their template as public
// Body: { templateId, price, description }
export async function POST(request: Request) {
  try {
    const auth = requireActor(request);
    if ('response' in auth) return auth.response;
    const { pressId, userId } = auth.actor;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // Listing someone else's artwork is the main legal risk the Marketplace
    // carries, so the IP warranty is required here — from the press user who
    // actually uploads — rather than once at signup.
    const parsed = marketplacePublishSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
        { status: 400 }
      );
    }

    const { templateId, price, cdrFileUrl, psdFileUrl, aiFileUrl, pdfFileUrl } = parsed.data;

    // Verify ownership
    const template = await prisma.cardTemplate.findFirst({
      where: { id: Number(templateId), pressId },
    });
    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

    // Block reselling of purchased templates
    const isPurchased = await prisma.templatePurchase.findFirst({
      where: { clonedTemplateId: Number(templateId) },
    });

    if (isPurchased) {
      return NextResponse.json(
        { error: 'Purchased templates cannot be resold or listed on the marketplace.' },
        { status: 400 }
      );
    }

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

    await recordLegalAcceptance({
      point: 'MARKETPLACE_PUBLISH',
      subjectType: 'PRESS_USER',
      subjectId: userId,
      pressId,
      context: acceptanceContextFromRequest(request),
    });

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
  } catch (error: unknown) {
    console.error('Marketplace publish error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/marketplace/publish?templateId=X  — unpublish (delist)
export async function DELETE(request: Request) {
  try {
    const auth = requireActor(request);
    if ('response' in auth) return auth.response;
    const { pressId } = auth.actor;

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
  } catch (error: unknown) {
    console.error('Marketplace unpublish error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
