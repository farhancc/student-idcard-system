import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

    // Retrieve order details — template is fetched separately (fresh direct query)
    // to guarantee the latest frontFields/backFields after any template edits.
    const order = await prisma.cardOrder.findUnique({
      where: { id: job.orderId },
      include: {
        client: true,
        invoice: true,
        cardholders: {
          include: {
            cardholder: true
          }
        }
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found for PDF job' }, { status: 404 });
    }

    // Fetch template directly with $queryRaw to bypass any ORM-level query plan
    // caching or JOIN shortcuts — this guarantees we always read the absolute
    // latest frontFields/backFields that were saved by the most recent template edit.
    const templateRows = await prisma.$queryRaw<any[]>`
      SELECT * FROM "card_templates" WHERE id = ${order.templateId} LIMIT 1
    `;
    const template = templateRows[0] ?? null;

    if (!template) {
      return NextResponse.json({ error: 'Template not found for this order' }, { status: 404 });
    }

    const press = await prisma.press.findUnique({
      where: { id: job.pressId },
    });

    const pressFonts = await prisma.pressFont.findMany({
      where: {
        OR: [
          { pressId },
          { pressId: null }
        ]
      },
    });

    // Sort: cards sorted by name (since uniqueKey concept is removed)
    const cardholders = order.cardholders
      .map(oc => oc.cardholder)
      .sort((a, b) => a.name.localeCompare(b.name));

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
      pressFonts: pressFonts.map(pf => ({
        name: pf.name,
        fileUrl: pf.fileUrl,
      })),
      template: {
        id: template.id,
        name: template.name,
        // Raw SQL column names (snake_case) — map to the schema field names
        width: template.card_width ?? template.cardWidth,
        height: template.card_height ?? template.cardHeight,
        frontImageUrl: template.front_image_url ?? template.frontImageUrl,
        backImageUrl: template.back_image_url ?? template.backImageUrl ?? null,
        frontOriginalUrl: template.front_original_url ?? template.frontOriginalUrl ?? null,
        backOriginalUrl: template.back_original_url ?? template.backOriginalUrl ?? null,
        isDoubleSided: !!(template.back_image_url ?? template.backImageUrl),
        frontFields: template.front_fields ?? template.frontFields ?? '[]',
        backFields: template.back_fields ?? template.backFields ?? '[]',
        validTillDate: order.validTill,
        version: template.version,
      },
      cardholders: cardholders.map(ch => ({
        id: ch.id,
        name: ch.name,
        designation: ch.designation,
        photoUrl: ch.photoUrl,
        customFields: ch.customFields ? JSON.parse(ch.customFields) : {},
        cardSerial: ch.cardSerial,
      })),
    }, {
      headers: {
        // Prevent any CDN/edge/proxy from caching the poll response —
        // stale job data would cause the Electron daemon to miss template updates.
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      }
    });
  } catch (error) {
    console.error('Poll PDF jobs error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
