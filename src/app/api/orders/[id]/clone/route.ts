import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id } = await params;
    const orderId = Number(id);

    // 1. Fetch original order with invoice details
    const originalOrder = await prisma.cardOrder.findFirst({
      where: { id: orderId, pressId },
      include: { invoice: true },
    });

    if (!originalOrder) {
      return NextResponse.json({ error: 'Original order not found' }, { status: 404 });
    }

    // 2. Clone inside transaction
    const cloned = await prisma.$transaction(async (tx) => {
      // Create clone CardOrder in DRAFT status
      const newOrder = await tx.cardOrder.create({
        data: {
          pressId,
          clientId: originalOrder.clientId,
          templateId: originalOrder.templateId,
          status: 'DRAFT',
          // cardholders join rows start empty — fresh import required
          validTill: originalOrder.validTill,
          templateVersion: originalOrder.templateVersion,
          notes: `Cloned from Order #${originalOrder.id}.`,
        },
      });

      // Create new unpaid invoice
      if (originalOrder.invoice) {
        await tx.orderInvoice.create({
          data: {
            orderId: newOrder.id,
            pressId,
            pricePerCard: originalOrder.invoice.pricePerCard,
            cardCount: 0,
            subtotal: 0.0,
            taxPercent: originalOrder.invoice.taxPercent,
            taxAmount: 0.0,
            totalAmount: 0.0,
            paymentStatus: 'UNPAID',
            paidAmount: 0.0,
          },
        });
      }

      // Log activity
      await tx.orderActivityLog.create({
        data: {
          orderId: newOrder.id,
          pressId,
          actorId: userId,
          actorName,
          action: 'ORDER_CLONED',
          note: `Cloned from Order #${originalOrder.id}.`,
        },
      });

      return newOrder;
    });

    return NextResponse.json({
      success: true,
      message: 'Order cloned successfully into draft',
      order: cloned,
    });
  } catch (error) {
    console.error('Clone order error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
