import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const pressIdStr = request.headers.get('x-press-id');
    if (!pressIdStr) {
      return NextResponse.json({ error: 'Missing Press ID' }, { status: 400 });
    }
    const pressId = Number(pressIdStr);

    const orders = await prisma.cardOrder.findMany({
      where: { pressId },
      include: {
        client: true,
        template: true,
        invoice: true,
        cardholders: {
          select: {
            cardholderId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const ordersWithLegacyField = orders.map(ord => ({
      ...ord,
      cardholderIds: JSON.stringify(ord.cardholders.map(oc => oc.cardholderId)),
    }));

    return NextResponse.json({ success: true, orders: ordersWithLegacyField });
  } catch (error) {
    console.error('Get orders error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const pressIdStr = request.headers.get('x-press-id');
    const userIdStr = request.headers.get('x-user-id');
    const userNameHeader = request.headers.get('x-user-name');
    if (!pressIdStr || !userIdStr) {
      return NextResponse.json({ error: 'Unauthorized session' }, { status: 401 });
    }
    const pressId = Number(pressIdStr);
    const userId = Number(userIdStr);
    const actorName = userNameHeader ? decodeURIComponent(userNameHeader) : 'Operator';

    const { clientId, templateId, cardholderIds, validTill, pricePerCard, status } = await request.json();

    if (!clientId || !templateId || !cardholderIds || !Array.isArray(cardholderIds) || cardholderIds.length === 0) {
      return NextResponse.json({ error: 'Client ID, Template ID, and non-empty Cardholder IDs array are required.' }, { status: 400 });
    }

    // Verify client and template belong to press
    const client = await prisma.client.findFirst({ where: { id: Number(clientId), pressId } });
    const template = await prisma.cardTemplate.findFirst({ where: { id: Number(templateId), pressId } });

    if (!client || !template) {
      return NextResponse.json({ error: 'Client or Template not found' }, { status: 404 });
    }

    const validTillDate = validTill ? new Date(validTill) : null;

    // Create Order, Invoice and Activity Log inside a Transaction
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.cardOrder.create({
        data: {
          pressId,
          clientId: Number(clientId),
          templateId: Number(templateId),
          status: status || 'DRAFT',
          validTill: validTillDate,
          templateVersion: template.version,
        },
      });

      // Link cardholders via the join table
      await tx.orderCardholder.createMany({
        data: (cardholderIds as number[]).map((chId: number) => ({
          orderId: order.id,
          cardholderId: chId,
        })),
        skipDuplicates: true,
      });

      // M1 Order Pricing / Invoice calculation
      const cardCount = cardholderIds.length;
      const unitPrice = pricePerCard !== undefined ? Number(pricePerCard) : 50.0; // Default ₹50 per card
      const subtotal = cardCount * unitPrice;
      const taxPercent = 18.0; // Default 18% GST
      const taxAmount = (subtotal * taxPercent) / 100.0;
      const totalAmount = subtotal + taxAmount;

      const invoice = await tx.orderInvoice.create({
        data: {
          orderId: order.id,
          pressId,
          pricePerCard: unitPrice,
          cardCount,
          subtotal,
          taxPercent,
          taxAmount,
          totalAmount,
          paymentStatus: 'UNPAID',
          paidAmount: 0.0,
        },
      });

      // Create Order Activity log
      await tx.orderActivityLog.create({
        data: {
          orderId: order.id,
          pressId,
          actorId: userId,
          actorName,
          action: 'ORDER_CREATED',
          fromStatus: null,
          toStatus: 'DRAFT',
          note: `Created draft order with ${cardCount} cards. Price per card set to ₹${unitPrice.toFixed(2)}.`,
        },
      });

      return { order, invoice };
    });

    return NextResponse.json({
      success: true,
      message: 'Order and Invoice created successfully',
      order: result.order,
      invoice: result.invoice,
    });
  } catch (error) {
    console.error('Create order error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
