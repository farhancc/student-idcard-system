import { NextResponse } from 'next/server';
import { requireActor } from '@/lib/authz';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const auth = requireActor(request);
    if ('response' in auth) return auth.response;
    const { pressId } = auth.actor;

    const { searchParams } = new URL(request.url);
    const page     = Math.max(1, Number(searchParams.get('page')     || 1));
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') || 30)));
    const sortBy   = searchParams.get('sortBy')  || 'createdAt';
    const sortDir  = searchParams.get('sortDir') === 'asc' ? 'asc' : 'desc';
    const search   = searchParams.get('search')  || '';

    let orderBy: any;
    switch (sortBy) {
      case 'client':   orderBy = { client:   { name: sortDir } }; break;
      case 'template': orderBy = { template: { name: sortDir } }; break;
      case 'status':   orderBy = { status:   sortDir };            break;
      default:         orderBy = { createdAt: sortDir };
    }

    const where: any = { pressId };
    if (search.trim()) {
      const q = search.trim();
      const isNumeric = /^\d+$/.test(q);
      where.OR = [
        ...(isNumeric ? [{ id: Number(q) }] : []),
        { client: { name: { contains: q, mode: 'insensitive' } } },
        { template: { name: { contains: q, mode: 'insensitive' } } },
        { status: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, pendingPrintingCount, orders] = await Promise.all([
      prisma.cardOrder.count({ where: { pressId } }),
      prisma.cardOrder.count({
        where: {
          pressId,
          status: { notIn: ['COMPLETED', 'PRINTED', 'DELIVERED', 'CANCELLED'] },
        },
      }),
      prisma.cardOrder.findMany({
        where,
        include: {
          client: true,
          template: true,
          invoice: true,
          cardholders: { select: { cardholderId: true } },
          pdfJobs: {
            select: { id: true, status: true, pdfType: true, progress: true, downloadUrl: true },
            orderBy: { generatedAt: 'desc' },
          },
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const ordersWithLegacyField = orders.map(ord => ({
      ...ord,
      cardholderIds: JSON.stringify(ord.cardholders.map(oc => oc.cardholderId)),
    }));

    return NextResponse.json({ success: true, orders: ordersWithLegacyField, total, pendingPrintingCount, page, pageSize });
  } catch (error) {
    console.error('Get orders error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    let pressId: number;
    let userId: number = 0;
    let actorName: string = 'Client Portal';

    if (body.orgToken) {
      const share = await prisma.clientPortalShare.findUnique({
        where: { orgToken: body.orgToken },
      });
      if (!share || !share.active) {
        return NextResponse.json({ error: 'Unauthorized or invalid portal link' }, { status: 403 });
      }
      pressId = share.pressId;
    } else {
      const auth = requireActor(request);
      if ('response' in auth) return auth.response;
      pressId = auth.actor.pressId;
      userId = auth.actor.userId;
      actorName = auth.actor.name;
    }

    const { createOrderSchema } = await import('@/lib/schemas');
    const parsed = createOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Client ID, Template ID, and non-empty Cardholder IDs array are required.' }, { status: 400 });
    }

    const { clientId, templateId, cardholderIds, validTill, pricePerCard, status } = parsed.data;


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
