import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { getCreditSettings } from '@/lib/system-settings';

const productionRequestSchema = z.object({
  orderId: z.union([z.number(), z.string().transform(Number)]),
  pdfType: z.enum(['PRODUCTION', 'APPROVAL', 'INVOICE']),
  paperSize: z.string().optional().default('A3'),
  orientation: z.string().optional().default('PORTRAIT'),
  bleed: z.union([z.number(), z.string().transform(Number)]).optional().default(0),
  cropMarks: z.boolean().optional().default(false),
  foldLine: z.boolean().optional().default(false),
  marginLeft: z.union([z.number(), z.string().transform(Number)]).optional(),
  marginTop: z.union([z.number(), z.string().transform(Number)]).optional(),
  marginRight: z.union([z.number(), z.string().transform(Number)]).optional(),
  marginBottom: z.union([z.number(), z.string().transform(Number)]).optional(),
  colGap: z.union([z.number(), z.string().transform(Number)]).optional(),
  rowGap: z.union([z.number(), z.string().transform(Number)]).optional(),
  emptySlotStrategy: z.enum(['LEAVE_BLANK', 'REPEAT_LAST', 'REPEAT_FIRST', 'FILL_CUSTOM']).optional().default('LEAVE_BLANK'),
  emptySlotCustomCardId: z.string().optional(),
  bypassValidation: z.boolean().optional().default(false),
  customWidth: z.union([z.number(), z.string().transform(Number)]).optional(),
  customHeight: z.union([z.number(), z.string().transform(Number)]).optional(),
});

export async function POST(request: Request) {
  try {
    const pressIdStr = request.headers.get('x-press-id');
    const userIdStr = request.headers.get('x-user-id');
    if (!pressIdStr || !userIdStr) {
      return NextResponse.json({ error: 'Unauthorized session' }, { status: 401 });
    }
    const pressId = Number(pressIdStr);
    const userId = Number(userIdStr);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400 });
    }

    const validation = productionRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid request parameters', details: validation.error.format() }, { status: 400 });
    }

    const {
      orderId, pdfType, paperSize, orientation, bleed, cropMarks, foldLine,
      marginLeft, marginTop, marginRight, marginBottom, colGap, rowGap,
      emptySlotStrategy, emptySlotCustomCardId, bypassValidation, customWidth, customHeight
    } = validation.data;


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
    const isIDCard = template.category === 'ID_CARD';
    
    const creditSettings = await getCreditSettings();
    let totalCreditsNeeded = 0;
    if (isProduction) {
      const costPerCard = isIDCard
        ? (isDoubleSided ? creditSettings.costDoubleSided : creditSettings.costSingleSided)
        : (isDoubleSided ? creditSettings.costDoubleSidedFull : creditSettings.costSingleSidedFull);
      totalCreditsNeeded = cardCount * costPerCard;
    } else if (pdfType === 'APPROVAL') {
      totalCreditsNeeded = isDoubleSided ? creditSettings.costApprovalPdfDouble : creditSettings.costApprovalPdfSingle;
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
      emptySlotStrategy: emptySlotStrategy || 'LEAVE_BLANK',
      emptySlotCustomCardId: emptySlotCustomCardId || undefined,
      bypassValidation: !!bypassValidation,
      customWidth: customWidth !== undefined ? Number(customWidth) : undefined,
      customHeight: customHeight !== undefined ? Number(customHeight) : undefined,
    };

    let cardCountLocked = totalCreditsNeeded;

    // Run the entire check-lock-create operation in a single atomic transaction
    const transactionResult = await prisma.$transaction(async (tx) => {
      // 1. Acquire pessimistic write lock on the press
      const presses = await tx.$queryRaw<any[]>`
        SELECT id, credits, promo_credits, plan FROM "press" WHERE id = ${pressId} FOR UPDATE
      `;
      const press = presses[0];

      if (!press) {
        throw new Error('Press tenant not found');
      }

      const paidCredits = Number(press.credits || 0);
      const promoCredits = Number(press.promo_credits || 0);
      const totalAvailable = paidCredits + promoCredits;

      if (totalAvailable < totalCreditsNeeded) {
        throw new Error(`Insufficient credits. This job requires ${totalCreditsNeeded} credits, but you only have ${totalAvailable}.`);
      }

      if (totalCreditsNeeded > 0) {
        const promoDeduct = Math.min(promoCredits, totalCreditsNeeded);
        const paidDeduct = totalCreditsNeeded - promoDeduct;

        await tx.press.update({
          where: { id: pressId },
          data: {
            ...(paidDeduct > 0 ? { credits: { decrement: paidDeduct } } : {}),
            ...(promoDeduct > 0 ? { promoCredits: { decrement: promoDeduct } } : {}),
          },
        });
      }

      // Calculate credit rates at the moment of queuing
      const plan = press.plan || 'BASIC';
      let rate = creditSettings.priceCreditBasic;
      if (plan === 'PRO') {
        rate = creditSettings.priceCreditPro;
      } else if (plan === 'ENTERPRISE') {
        rate = creditSettings.priceCreditEnterprise;
      }
      const calculatedRevenue = totalCreditsNeeded * rate;

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
          rateApplied: rate,
          revenueGenerated: calculatedRevenue,
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

      return { job, remainingCredits: totalAvailable - cardCountLocked };
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
