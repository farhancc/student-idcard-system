import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/marketplace/purchase
// Body: { templateId }
export async function POST(request: Request) {
  try {
    const pressIdStr = request.headers.get('x-press-id');
    if (!pressIdStr) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const buyerPressId = Number(pressIdStr);

    const { templateId } = await request.json();
    if (!templateId) return NextResponse.json({ error: 'templateId required' }, { status: 400 });

    // Fetch the template
    const template = await prisma.cardTemplate.findFirst({
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
        // Only paid credits accepted (not promo credits)
        const buyer = await tx.$queryRaw<any[]>`
          SELECT id, credits FROM "press" WHERE id = ${buyerPressId} FOR UPDATE
        `;
        if (!buyer[0] || buyer[0].credits < price) {
          throw new Error(`Insufficient credits. Required: ${price}, Available: ${buyer[0]?.credits ?? 0}`);
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
