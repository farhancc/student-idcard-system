import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const pressIdStr = request.headers.get('x-press-id');
    if (!pressIdStr) {
      return NextResponse.json({ error: 'Missing Press ID' }, { status: 400 });
    }
    const pressId = Number(pressIdStr);

    const invoices = await prisma.orderInvoice.findMany({
      where: { pressId },
      include: {
        order: {
          include: {
            client: true,
            template: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, invoices });
  } catch (error) {
    console.error('Get invoices error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const pressIdStr = request.headers.get('x-press-id');
    if (!pressIdStr) {
      return NextResponse.json({ error: 'Missing Press ID' }, { status: 400 });
    }
    const pressId = Number(pressIdStr);

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

    const subtotal = newPricePerCard * newCardCount;
    const taxAmount = (subtotal * newTaxPercent) / 100.0;
    const totalAmount = subtotal + taxAmount;

    const data: any = {
      pricePerCard: newPricePerCard,
      cardCount: newCardCount,
      taxPercent: newTaxPercent,
      subtotal,
      taxAmount,
      totalAmount,
      notes: notes !== undefined ? notes : invoice.notes,
    };

    if (paymentStatus !== undefined) {
      data.paymentStatus = paymentStatus;
      if (paymentStatus === 'PAID') {
        data.paidAmount = totalAmount;
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
