import { NextResponse } from 'next/server';
import { prisma, basePrisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// POST /api/marketplace/purchase
// Body: { templateId }
export async function POST(request: Request) {
  try {
    const pressIdStr = request.headers.get('x-press-id');
    if (!pressIdStr) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const buyerPressId = Number(pressIdStr);

    const { templateId } = await request.json();
    if (!templateId) return NextResponse.json({ error: 'templateId required' }, { status: 400 });

    // Fetch the template — use basePrisma to bypass tenant isolation and see all presses
    const template = await basePrisma.cardTemplate.findFirst({
      where: {
        id: Number(templateId),
        isModerated: false,
        OR: [
          { isPublic: true },
          { pressId: null },
        ],
      },
      select: {
        id: true, name: true, price: true, pressId: true,
        cardWidth: true, cardHeight: true,
        frontImageUrl: true, backImageUrl: true,
        frontOriginalUrl: true, backOriginalUrl: true,
        frontFields: true, backFields: true,
        category: true, sides: true,
        cdrFileUrl: true, aiFileUrl: true, psdFileUrl: true, pdfFileUrl: true,
      },
    });

    if (!template) return NextResponse.json({ error: 'Template not found or not available' }, { status: 404 });

    // Can't buy your own template
    if (template.pressId === buyerPressId) {
      return NextResponse.json({ error: 'You cannot purchase your own template' }, { status: 400 });
    }

    const price = template.price;

    // Execute purchase in a transaction
    const result = await prisma.$transaction(async (tx) => {
      if (price > 0) {
        // Only paid credits accepted for purchasing templates (not signup bonus / promo credits)
        const buyer = await tx.$queryRaw<any[]>`
          SELECT id, credits, promo_credits FROM "press" WHERE id = ${buyerPressId} FOR UPDATE
        `;
        const buyerPress = buyer[0];
        if (!buyerPress) {
          throw new Error('Buyer press tenant not found');
        }
        const paidCredits = Number(buyerPress.credits || 0);
        const promoCredits = Number(buyerPress.promo_credits || 0);

        if (paidCredits < price) {
          if (promoCredits > 0) {
            throw new Error(`Marketplace templates cannot be purchased using signup bonus or promotional credits. Required paid credits: ${price}, Available paid credits: ${paidCredits}.`);
          }
          throw new Error(`Insufficient paid credits. Required: ${price}, Available: ${paidCredits}.`);
        }
        // Deduct from buyer
        await tx.press.update({
          where: { id: buyerPressId },
          data: { credits: { decrement: price } },
        });
        // Credit seller (if template has a seller press)
        if (template.pressId) {
          await tx.press.update({
            where: { id: template.pressId },
            data: { credits: { increment: price } },
          });
        }
      }

      // Generate a unique name for the purchased template in the buyer's library
      let baseName = `${template.name} (Purchased)`;
      let uniqueName = baseName;
      let counter = 2;
      while (true) {
        const existing = await tx.cardTemplate.findFirst({
          where: { pressId: buyerPressId, isLatest: true, name: uniqueName },
        });
        if (!existing) break;
        uniqueName = `${baseName} ${counter}`;
        counter++;
      }

      // Clone the template to the buyer's library
      const cloned = await tx.cardTemplate.create({
        data: {
          pressId: buyerPressId,
          name: uniqueName,
          cardWidth: template.cardWidth,
          cardHeight: template.cardHeight,
          frontImageUrl: template.frontImageUrl,
          backImageUrl: template.backImageUrl,
          frontOriginalUrl: template.frontOriginalUrl,
          backOriginalUrl: template.backOriginalUrl,
          frontFields: template.frontFields,
          backFields: template.backFields,
          category: template.category,
          sides: template.sides,
          // Source files are accessible via the download gateway using original template ID
          // Don't copy file URLs — buyer downloads via /api/marketplace/download?templateId=originalId
        },
      });

      // Record the purchase
      const purchase = await tx.templatePurchase.create({
        data: {
          buyerPressId,
          templateId: template.id,
          templateName: template.name,
          sellerPressId: template.pressId,
          creditsSpent: price,
          clonedTemplateId: cloned.id,
        },
      });

      return { purchase, clonedTemplateId: cloned.id };
    });

    return NextResponse.json({
      success: true,
      message: price > 0 ? `Purchase successful! ${price} credits deducted.` : 'Template added to your library!',
      clonedTemplateId: result.clonedTemplateId,
      purchaseId: result.purchase.id,
    });
  } catch (error: any) {
    console.error('Marketplace purchase error:', error);
    return NextResponse.json({ error: error.message || 'Purchase failed' }, { status: 500 });
  }
}
