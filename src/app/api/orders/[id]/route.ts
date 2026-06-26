import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { updateOrderSchema } from '@/lib/schemas';

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
    const orderId = Number(id);

    const order = await prisma.cardOrder.findFirst({
      where: { id: orderId, pressId },
      include: {
        client: true,
        template: true,
        invoice: true,
        deliveryRecord: true,
        notesHistory: { orderBy: { createdAt: 'desc' } },
        activities: { orderBy: { createdAt: 'desc' } },
        pdfJobs: { orderBy: { generatedAt: 'desc' } },
        cardholders: {
          include: {
            cardholder: true
          }
        }
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const cardholderIds = order.cardholders.map(oc => oc.cardholderId);
    const orderWithLegacyField = {
      ...order,
      cardholderIds: JSON.stringify(cardholderIds)
    };

    return NextResponse.json({
      success: true,
      order: orderWithLegacyField,
      logs: order.activities.map(a => ({
        id: a.id,
        timestamp: a.createdAt,
        actorName: a.actorName,
        action: a.action,
        note: a.note
      })),
      notes: order.notesHistory.map(n => ({
        id: n.id,
        authorName: n.authorName,
        note: n.content,
        createdAt: n.createdAt
      }))
    });
  } catch (error) {
    console.error('Get order error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const parsed = updateOrderSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Invalid input';
      return NextResponse.json({ error: message }, { status: 400 });
    }
    const { status, notes, validTill, deliveredTo, deliveredBy, deliveryRemarks, paymentStatus, paymentMethod } = parsed.data;

    const order = await prisma.cardOrder.findFirst({
      where: { id: orderId, pressId },
      include: { cardholders: true }
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const fromStatus = order.status;
    const toStatus = status || fromStatus;

    const updatedOrder = await prisma.$transaction(async (tx) => {
      // 1. Update order core details
      const upd = await tx.cardOrder.update({
        where: { id: orderId },
        data: {
          status: toStatus,
          notes: notes !== undefined ? notes : order.notes,
          validTill: validTill ? new Date(validTill) : order.validTill,
        },
      });

      // 1b. Update invoice payment status if provided
      if (paymentStatus) {
        const invoice = await tx.orderInvoice.findFirst({
          where: { orderId },
        });
        if (invoice) {
          await tx.orderInvoice.update({
            where: { id: invoice.id },
            data: {
              paymentStatus,
              paidAmount: paymentStatus === 'PAID' ? invoice.totalAmount : 0,
              paymentMethod: paymentStatus === 'PAID' ? (paymentMethod || 'CASH') : null,
              paidAt: paymentStatus === 'PAID' ? new Date() : null,
            }
          });
        }
      }

      // 2. Handle state changes audit log (M10)
      if (toStatus !== fromStatus) {
        await tx.orderActivityLog.create({
          data: {
            orderId,
            pressId,
            actorId: userId,
            actorName,
            action: 'STATUS_CHANGED',
            fromStatus,
            toStatus,
            note: `Status changed from ${fromStatus} to ${toStatus}.`,
          },
        });
      }

      // 3. M13: Create delivery record if state becomes DELIVERED
      if (toStatus === 'DELIVERED' && fromStatus !== 'DELIVERED') {
        const cardCount = order.cardholders.length;
        await tx.deliveryRecord.create({
          data: {
            orderId,
            pressId,
            deliveredTo: deliveredTo || 'Client Office',
            deliveredBy: deliveredBy || 'Courier Agent',
            deliveredAt: new Date(),
            cardCount,
            remarks: deliveryRemarks || 'Delivered securely.',
          },
        });

        // Update print records state
        await tx.cardPrintRecord.updateMany({
          where: { orderId },
          data: {
            status: 'DELIVERED',
            deliveredAt: new Date(),
          },
        });
      }

      return upd;
    });

    return NextResponse.json({
      success: true,
      message: 'Order updated successfully',
      order: updatedOrder,
    });
  } catch (error) {
    console.error('Update order error:', error);
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
    const orderId = Number(id);

    const order = await prisma.cardOrder.findFirst({
      where: { id: orderId, pressId },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Delete (cascade handles invoices, activity logs, notes, delivery records)
    await prisma.cardOrder.delete({
      where: { id: orderId },
    });

    return NextResponse.json({
      success: true,
      message: 'Order and all associated records deleted successfully',
    });
  } catch (error) {
    console.error('Delete order error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
