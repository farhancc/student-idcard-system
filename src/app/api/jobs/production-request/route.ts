import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const pressIdStr = request.headers.get('x-press-id');
    const userIdStr = request.headers.get('x-user-id');
    if (!pressIdStr || !userIdStr) {
      return NextResponse.json({ error: 'Unauthorized session' }, { status: 401 });
    }
    const pressId = Number(pressIdStr);
    const userId = Number(userIdStr);

    const {
      orderId, pdfType, paperSize, orientation, bleed, cropMarks, foldLine,
      marginLeft, marginTop, marginRight, marginBottom, colGap, rowGap
    } = await request.json();

    if (!orderId || !pdfType) {
      return NextResponse.json({ error: 'Order ID and PDF Type are required' }, { status: 400 });
    }

    const order = await prisma.cardOrder.findFirst({
      where: { id: Number(orderId), pressId },
      include: {
        _count: { select: { cardholders: true } }
      }
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const cardCount = order._count.cardholders;
    if (cardCount === 0) {
      return NextResponse.json({ error: 'Order does not contain any cardholders' }, { status: 400 });
    }

    // Fetch template to check if it has a back side (for pricing determination)
    const template = await prisma.cardTemplate.findUnique({
      where: { id: order.templateId },
    });

    if (!template) {
      return NextResponse.json({ error: 'Order template not found' }, { status: 404 });
    }

    // 1. Credit Check & Lock
    const isProduction = pdfType === 'PRODUCTION';
    const isDoubleSided = !!template.backImageUrl;
    
    let totalCreditsNeeded = 0;
    if (isProduction) {
      const costPerCard = isDoubleSided ? 15 : 10;
      totalCreditsNeeded = cardCount * costPerCard;
    } else if (pdfType === 'APPROVAL') {
      totalCreditsNeeded = 20; // 20 credit for approval print (per export)
    }

    const jobOptions = {
      paperSize: paperSize || 'A3',
      orientation: orientation || 'PORTRAIT',
      bleed: bleed !== undefined ? Number(bleed) : 0,
      cropMarks: !!cropMarks,
      foldLine: !!foldLine,
      marginLeft:   marginLeft   !== undefined ? Number(marginLeft)   : undefined,
      marginTop:    marginTop    !== undefined ? Number(marginTop)    : undefined,
      marginRight:  marginRight  !== undefined ? Number(marginRight)  : undefined,
      marginBottom: marginBottom !== undefined ? Number(marginBottom) : undefined,
      colGap:       colGap       !== undefined ? Number(colGap)       : undefined,
      rowGap:       rowGap       !== undefined ? Number(rowGap)       : undefined,
    };

    let cardCountLocked = totalCreditsNeeded;

    // Run the entire check-lock-create operation in a single atomic transaction
    const transactionResult = await prisma.$transaction(async (tx) => {
      // 1. Acquire pessimistic write lock on the press
      const presses = await tx.$queryRaw<any[]>`
        SELECT id, credits FROM "press" WHERE id = ${pressId} FOR UPDATE
      `;
      const press = presses[0];

      if (!press) {
        throw new Error('Press tenant not found');
      }

      if (press.credits < totalCreditsNeeded) {
        throw new Error(`Insufficient credits. This job requires ${totalCreditsNeeded} credits, but you only have ${press.credits}.`);
      }

      if (totalCreditsNeeded > 0) {
        // Deduct credits
        await tx.press.update({
          where: { id: pressId },
          data: {
            credits: {
              decrement: totalCreditsNeeded,
            },
          },
        });
      }

      // 2. Job Version calculation
      const existingJobCount = await tx.pdfJob.count({
        where: { orderId: order.id, pdfType },
      });
      const nextVersion = existingJobCount + 1;
      const versionLabel = `${pdfType.charAt(0) + pdfType.slice(1).toLowerCase()} v${nextVersion}`;

      const fileName = `${pdfType.toLowerCase()}_order_${order.id}_v${nextVersion}.pdf`;

      // 3. Create PDF Job record in database
      const job = await tx.pdfJob.create({
        data: {
          pressId,
          orderId: order.id,
          pdfType,
          status: 'PENDING',
          fileName,
          generatedBy: userId,
          progress: 0,
          metadata: JSON.stringify(jobOptions),
          isLocalJob: true,
          creditsLocked: cardCountLocked,
          version: nextVersion,
          label: versionLabel,
        },
      });

      // 4. Log the lock
      await tx.orderActivityLog.create({
        data: {
          orderId: order.id,
          pressId,
          actorId: userId,
          actorName: 'System Queue',
          action: 'PDF_JOB_QUEUED_DESKTOP',
          fromStatus: order.status,
          toStatus: order.status,
          note: isProduction 
            ? `Queued print job #${job.id}. Locked ${cardCount} credits.`
            : `Queued print job #${job.id} (Free Approval).`,
        },
      });

      return { job, remainingCredits: press.credits - cardCountLocked };
    });

    return NextResponse.json({
      success: true,
      message: 'PDF generation job queued successfully',
      jobId: transactionResult.job.id,
      creditsBalance: transactionResult.remainingCredits,
    });
  } catch (error: any) {
    console.error('Request PDF job error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
