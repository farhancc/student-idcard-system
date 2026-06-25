import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifySubscriptionLimits } from '@/lib/pdf/subscription';

export async function POST(request: Request) {
  try {
    const pressIdStr = request.headers.get('x-press-id');
    const userIdStr = request.headers.get('x-user-id');
    if (!pressIdStr || !userIdStr) {
      return NextResponse.json({ error: 'Unauthorized session' }, { status: 401 });
    }
    const pressId = Number(pressIdStr);
    const userId = Number(userIdStr);
    const userRole = request.headers.get('x-user-role') || 'DESIGNER';

    const {
      orderId, pdfType, paperSize, orientation, bleed, cropMarks, foldLine,
      marginLeft, marginTop, marginRight, marginBottom, colGap, rowGap
    } = await request.json();

    if (!orderId || !pdfType) {
      return NextResponse.json({ error: 'Order ID and PDF Type are required' }, { status: 400 });
    }

    // 1. Role-Based PDF Type Permissions (R1)
    if (userRole === 'DESIGNER') {
      return NextResponse.json({ error: 'Forbidden: DESIGNER role cannot generate PDFs (preview only).' }, { status: 403 });
    }
    if (userRole === 'OPERATOR' && pdfType === 'PRODUCTION') {
      return NextResponse.json({ error: 'Forbidden: OPERATOR role is not permitted to generate PRODUCTION PDFs.' }, { status: 403 });
    }

    const order = await prisma.cardOrder.findFirst({
      where: { id: Number(orderId), pressId },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const cardholderIds: number[] = JSON.parse(order.cardholderIds || '[]');
    if (cardholderIds.length === 0) {
      return NextResponse.json({ error: 'Order does not contain any cardholders' }, { status: 400 });
    }

    // 2. Subscription & Trial Limit checks
    const limitCheck = await verifySubscriptionLimits(pressId, cardholderIds.length, pdfType);
    if (!limitCheck.allowed) {
      return NextResponse.json({ error: limitCheck.reason }, { status: 403 });
    }

    // 3. M12: PDF Job Version History Calculation
    const existingJobCount = await prisma.pdfJob.count({
      where: { orderId: order.id, pdfType },
    });
    const nextVersion = existingJobCount + 1;
    const versionLabel = `${pdfType.charAt(0) + pdfType.slice(1).toLowerCase()} v${nextVersion}`;

    // 4. Create PdfJob record in database
    const jobOptions = {
      paperSize: paperSize || 'A3',
      orientation: orientation || 'PORTRAIT',
      bleed: bleed !== undefined ? Number(bleed) : 0,
      cropMarks: !!cropMarks,
      foldLine: !!foldLine,
      // Layout spacing
      marginLeft:   marginLeft   !== undefined ? Number(marginLeft)   : undefined,
      marginTop:    marginTop    !== undefined ? Number(marginTop)    : undefined,
      marginRight:  marginRight  !== undefined ? Number(marginRight)  : undefined,
      marginBottom: marginBottom !== undefined ? Number(marginBottom) : undefined,
      colGap:       colGap       !== undefined ? Number(colGap)       : undefined,
      rowGap:       rowGap       !== undefined ? Number(rowGap)       : undefined,
    };


    // If pdfType is PRODUCTION, ensure an invoice exists for the order
    if (pdfType === 'PRODUCTION') {
      const existingInvoice = await prisma.orderInvoice.findFirst({
        where: { orderId: order.id }
      });
      
      if (!existingInvoice) {
        const cardCount = cardholderIds.length;
        const pricePerCard = 50.0; // Default ₹50 per card
        const subtotal = cardCount * pricePerCard;
        const taxPercent = 18.0;   // Default 18% GST
        const taxAmount = (subtotal * taxPercent) / 100.0;
        const totalAmount = subtotal + taxAmount;

        await prisma.orderInvoice.create({
          data: {
            orderId: order.id,
            pressId,
            pricePerCard,
            cardCount,
            subtotal,
            taxPercent,
            taxAmount,
            totalAmount,
            paymentStatus: 'UNPAID',
            paidAmount: 0.0,
          },
        });
      }
    }

    const fileName = `${pdfType.toLowerCase()}_order_${order.id}_v${nextVersion}.pdf`;

    const job = await prisma.pdfJob.create({
      data: {
        pressId,
        orderId: order.id,
        pdfType,
        status: 'PENDING',
        fileName,
        generatedBy: userId,
        progress: 0,
        metadata: JSON.stringify(jobOptions),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // Expires in 7 days (R5 PDF job link expiry)
        version: nextVersion,
        label: versionLabel,
      },
    });

    // 3. Delegation: The local Electron daemon will poll and process the PENDING job.


    return NextResponse.json({
      success: true,
      message: 'PDF generation job queued successfully',
      job: {
        id: job.id,
        status: job.status,
      },
    });
  } catch (error) {
    console.error('Queue PDF job error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const pressIdStr = request.headers.get('x-press-id');
    if (!pressIdStr) {
      return NextResponse.json({ error: 'Unauthorized session' }, { status: 401 });
    }
    const pressId = Number(pressIdStr);

    const jobs = await prisma.pdfJob.findMany({
      where: { pressId },
      orderBy: { generatedAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({ success: true, jobs });
  } catch (error) {
    console.error('List PDF jobs error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
