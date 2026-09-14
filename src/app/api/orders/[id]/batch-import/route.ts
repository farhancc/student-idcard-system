import { NextResponse } from 'next/server';
import { requireActor } from '@/lib/authz';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/orders/[id]/batch-import
 * 
 * Bulk-creates cardholder records and links them to an existing order.
 * 
 * Body: {
 *   cardholders: Array<{
 *     name: string;
 *     designation?: string;
 *     photoUrl?: string;
 *     customFields?: Record<string, any>;
 *   }>
 * }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireActor(request);
    if ('response' in auth) return auth.response;
    const { pressId } = auth.actor;

    const { id } = await params;
    const orderId = Number(id);
    if (isNaN(orderId)) {
      return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 });
    }

    const body = await request.json();
    const { cardholders } = body;

    if (!cardholders || !Array.isArray(cardholders) || cardholders.length === 0) {
      return NextResponse.json(
        { error: 'At least one cardholder is required' },
        { status: 400 }
      );
    }

    // Verify order exists and belongs to this press
    const order = await prisma.cardOrder.findFirst({
      where: { id: orderId, pressId },
      select: { id: true, clientId: true, templateId: true },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Create cardholders + link them to the order in a single transaction
    const result = await prisma.$transaction(async (tx) => {
      const createdCardholders = [];

      for (const c of cardholders) {
        const cardholder = await tx.cardholder.create({
          data: {
            pressId,
            clientId: order.clientId,
            templateId: order.templateId,
            name: c.name || 'Unnamed',
            designation: c.designation || null,
            photoUrl: c.photoUrl || null,
            customFields: c.customFields
              ? JSON.stringify(c.customFields)
              : null,
            active: true,
          },
        });

        // Create OrderCardholder join record
        await tx.orderCardholder.create({
          data: {
            orderId,
            cardholderId: cardholder.id,
          },
        });

        createdCardholders.push(cardholder);
      }

      return createdCardholders;
    });

    return NextResponse.json({
      success: true,
      count: result.length,
      cardholders: result,
    });
  } catch (error: any) {
    console.error('[batch-import] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to import cardholders' },
      { status: 500 }
    );
  }
}
