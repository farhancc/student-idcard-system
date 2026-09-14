import { NextResponse } from 'next/server';
import { requireActor, requireRole } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { calculateInvoice } from '@/lib/invoice';

export async function GET(request: Request) {
  try {
    const auth = requireActor(request);
    if ('response' in auth) return auth.response;
    const { pressId } = auth.actor;

    const { searchParams } = new URL(request.url);
    const limitStr = searchParams.get('limit') || searchParams.get('take');
    const offsetStr = searchParams.get('offset') || searchParams.get('skip');
    const limit = limitStr ? Number(limitStr) : undefined;
    const offset = offsetStr ? Number(offsetStr) : undefined;

    const [total, invoices] = await Promise.all([
      prisma.orderInvoice.count({ where: { pressId } }),
      prisma.orderInvoice.findMany({
        where: { pressId },
        include: {
          order: {
            include: {
              client: true,
              template: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        ...(limit !== undefined ? { take: limit } : {}),
        ...(offset !== undefined ? { skip: offset } : {}),
      }),
    ]);

    return NextResponse.json({
      success: true,
      invoices,
      data: invoices,
      total,
      limit: limit ?? invoices.length,
      offset: offset ?? 0,
    });
  } catch (error) {
    console.error('Get invoices error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const auth = requireRole(request, ['OWNER', 'OPERATOR']);
    if ('response' in auth) return auth.response;
    const { pressId } = auth.actor;

    const { id, pricePerCard, cardCount, taxPercent, paymentStatus, paymentMethod, notes } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Invoice ID is required' }, { status: 400 });
    }

    const invoice = await prisma.orderInvoice.findFirst({
      where: { id: Number(id), pressId },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const newPricePerCard = pricePerCard !== undefined ? Number(pricePerCard) : Number(invoice.pricePerCard);
    const newCardCount = cardCount !== undefined ? Number(cardCount) : invoice.cardCount;
    const newTaxPercent = taxPercent !== undefined ? Number(taxPercent) : Number(invoice.taxPercent);

    const calc = calculateInvoice(newPricePerCard, newCardCount, newTaxPercent);

    const data: any = {
      pricePerCard: calc.pricePerCard,
      cardCount: calc.cardCount,
      taxPercent: calc.taxPercent,
      subtotal: calc.subtotal,
      taxAmount: calc.taxAmount,
      totalAmount: calc.totalAmount,
      notes: notes !== undefined ? notes : invoice.notes,
    };

    if (paymentStatus !== undefined) {
      data.paymentStatus = paymentStatus;
      if (paymentStatus === 'PAID') {
        data.paidAmount = calc.totalAmount;
        data.paymentMethod = paymentMethod || 'CASH';
        data.paidAt = new Date();
      } else {
        data.paidAmount = 0.0;
        data.paymentMethod = null;
        data.paidAt = null;
      }
    }

    const updated = await prisma.orderInvoice.update({
      where: { id: invoice.id },
      data,
    });

    return NextResponse.json({ success: true, invoice: updated });
  } catch (error) {
    console.error('Update invoice error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
