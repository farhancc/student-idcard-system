import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const pressIdStr = request.headers.get('x-press-id');
    if (!pressIdStr) {
      return NextResponse.json({ error: 'Unauthorized session' }, { status: 401 });
    }
    const pressId = Number(pressIdStr);

    // Fetch the oldest pending job for this press (FIFO)
    const job = await prisma.pdfJob.findFirst({
      where: {
        pressId,
        isLocalJob: true,
        status: 'PENDING',
      },
      orderBy: { generatedAt: 'asc' },
    });

    if (!job) {
      return NextResponse.json({ success: true, job: null });
    }

    // Retrieve order and template details
    const order = await prisma.cardOrder.findUnique({
      where: { id: job.orderId },
      include: {
        template: true,
        client: true,
        invoice: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found for PDF job' }, { status: 404 });
    }

    const press = await prisma.press.findUnique({
      where: { id: job.pressId },
    });

    // Parse cardholders
    const cardholderIds: number[] = JSON.parse(order.cardholderIds || '[]');
    const cardholders = await prisma.cardholder.findMany({
      where: {
        id: { in: cardholderIds },
      },
    });

    return NextResponse.json({
      success: true,
      job: {
        id: job.id,
        orderId: job.orderId,
        pdfType: job.pdfType,
        fileName: job.fileName,
        metadata: JSON.parse(job.metadata || '{}'),
        label: job.label,
      },
      order: {
        id: order.id,
        status: order.status,
        clientName: order.client.name,
        clientPhone: order.client.contactPhone,
        clientAddress: order.client.address,
        invoice: order.invoice ? {
          id: order.invoice.id,
          createdAt: order.invoice.createdAt,
          cardCount: order.invoice.cardCount,
          pricePerCard: order.invoice.pricePerCard,
          subtotal: order.invoice.subtotal,
          taxPercent: order.invoice.taxPercent,
          taxAmount: order.invoice.taxAmount,
          totalAmount: order.invoice.totalAmount,
          paymentStatus: order.invoice.paymentStatus,
          paymentMethod: order.invoice.paymentMethod,
        } : null,
      },
      press: press ? {
        name: press.name,
        email: press.email,
        city: press.city,
      } : null,
      template: {
        id: order.template.id,
        name: order.template.name,
        width: order.template.cardWidth,
        height: order.template.cardHeight,
        frontImageUrl: order.template.frontImageUrl,
        backImageUrl: order.template.backImageUrl,
        isDoubleSided: !!order.template.backImageUrl,
      },
      cardholders: cardholders.map(ch => ({
        id: ch.id,
        name: ch.name,
        designation: ch.designation,
        photoUrl: ch.photoUrl,
        customFields: ch.customFields ? JSON.parse(ch.customFields) : {},
        cardSerial: ch.cardSerial,
      })),
    });
  } catch (error) {
    console.error('Poll PDF jobs error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
