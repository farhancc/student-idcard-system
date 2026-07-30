import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCreditSettings } from '@/lib/system-settings';

export async function POST(request: Request) {
  try {
    const pressIdStr = request.headers.get('x-press-id');
    const userIdStr = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role') || 'DESIGNER';

    if (!pressIdStr || !userIdStr) {
      return NextResponse.json({ error: 'Unauthorized session' }, { status: 401 });
    }

    if (userRole === 'DESIGNER') {
      return NextResponse.json({ error: 'Forbidden: Designers cannot process batch orders' }, { status: 403 });
    }

    const pressId = Number(pressIdStr);
    const userId = Number(userIdStr);

    const body = await request.json();
    const { clientId: clientIdRaw, templateId: templateIdRaw, pricePerCard: pricePerCardRaw, taxPercent: taxPercentRaw, validTill, cardholders } = body;

    if (!clientIdRaw || !templateIdRaw) {
      return NextResponse.json({ error: 'Client ID and Template ID are required' }, { status: 400 });
    }

    if (!cardholders || !Array.isArray(cardholders) || cardholders.length === 0) {
      return NextResponse.json({ error: 'A list of cardholders is required' }, { status: 400 });
    }

    const clientId = Number(clientIdRaw);
    const templateId = Number(templateIdRaw);
    const pricePerCard = pricePerCardRaw ? Number(pricePerCardRaw) : 50.0;
    const taxPercent = taxPercentRaw ? Number(taxPercentRaw) : 18.0;

    // Verify client and template belong to press
    const client = await prisma.client.findFirst({
      where: { id: clientId, pressId },
    });
    const template = await prisma.cardTemplate.findFirst({
      where: { id: templateId, pressId },
    });

    if (!client || !template) {
      return NextResponse.json({ error: 'Client or Template not found' }, { status: 404 });
    }

    // 1. Process/Import Cardholders list
    const cardholderIds: number[] = [];
    let matchedPhotosCount = 0;

    for (let i = 0; i < cardholders.length; i++) {
      const ch = cardholders[i];
      const name = String(ch.name || '').trim();
      if (!name) continue;

      const designation = ch.designation ? String(ch.designation).trim() : null;
      const uniqueKey = ch.uniqueKey ? String(ch.uniqueKey).trim() : null;
      const photoUrl = ch.photoUrl ? String(ch.photoUrl).trim() : null;
      
      if (photoUrl) {
        matchedPhotosCount++;
      }

      // Convert customFields object to string JSON
      const custom = ch.customFields && typeof ch.customFields === 'object' ? { ...ch.customFields } : {};
      if (uniqueKey && !custom.uniqueKey && !custom.id && !custom.unique_key) {
        custom.uniqueKey = uniqueKey;
      }
      const customFieldsStr = Object.keys(custom).length > 0 
        ? JSON.stringify(custom) 
        : null;

      // Find duplicate in DB
      const duplicate = await prisma.cardholder.findFirst({
        where: { clientId, name, designation: designation ?? null },
      });

      const cardholderPayload = {
        pressId,
        clientId,
        name,
        designation,
        photoUrl,
        customFields: customFieldsStr,
      };

      let cardholderRecord;
      if (duplicate) {
        cardholderRecord = await prisma.cardholder.update({
          where: { id: duplicate.id },
          data: {
            ...cardholderPayload,
            photoUrl: photoUrl || duplicate.photoUrl,
          },
        });
        // Mark cached asset stale if name/designation/custom changed
        if (
          name !== duplicate.name ||
          designation !== duplicate.designation ||
          customFieldsStr !== duplicate.customFields
        ) {
          await prisma.cardAsset.updateMany({
            where: { cardholderId: duplicate.id },
            data: { isStale: true },
          });
        }
      } else {
        cardholderRecord = await prisma.cardholder.create({ data: cardholderPayload });
      }

      cardholderIds.push(cardholderRecord.id);
    }

    if (cardholderIds.length === 0) {
      return NextResponse.json({ error: 'No valid cardholders imported' }, { status: 400 });
    }

    // 2. Create CardOrder & Invoice
    const validTillDate = validTill ? new Date(validTill) : null;
    const order = await prisma.cardOrder.create({
      data: {
        pressId,
        clientId,
        templateId,
        status: 'DRAFT',
        validTill: validTillDate,
        templateVersion: template.version,
      },
    });

    // Link cardholders via the join table
    await prisma.orderCardholder.createMany({
      data: cardholderIds.map((chId: number) => ({
        orderId: order.id,
        cardholderId: chId,
      })),
      skipDuplicates: true,
    });

    const cardCount = cardholderIds.length;
    const subtotal = cardCount * pricePerCard;
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

    // Create Order Activity log
    await prisma.orderActivityLog.create({
      data: {
        orderId: order.id,
        pressId,
        actorId: userId,
        actorName: 'System Batch Process',
        action: 'ORDER_CREATED',
        fromStatus: null,
        toStatus: 'DRAFT',
        note: `Batch upload processed. Created order with ${cardCount} cards. Price per card set to ₹${pricePerCard.toFixed(2)}. Matched ${matchedPhotosCount} photos.`,
      },
    });

    // 3. Trigger PDF Generation Jobs for both types: APPROVAL and PRODUCTION
    const jobOptions = {
      paperSize: 'A3' as const,
      orientation: 'PORTRAIT' as const,
      bleed: 0,
      cropMarks: true,
      foldLine: true,
    };

    // Credit Check & Lock for batch jobs
    const isDoubleSided = !!template.backImageUrl;
    const creditSettings = await getCreditSettings();
    const costPerCard = isDoubleSided ? creditSettings.costDoubleSided : creditSettings.costSingleSided;
    const productionCreditsNeeded = cardCount * costPerCard;
    const approvalCreditsNeeded = isDoubleSided ? creditSettings.costApprovalPdfDouble : creditSettings.costApprovalPdfSingle;
    const totalCreditsNeeded = productionCreditsNeeded + approvalCreditsNeeded;

    const press = await prisma.press.findUnique({ where: { id: pressId } });
    if (!press) {
      return NextResponse.json({ error: 'Press tenant not found' }, { status: 404 });
    }
    if (press.credits < totalCreditsNeeded) {
      return NextResponse.json({
        error: `Insufficient credits to queue production. Required: ${totalCreditsNeeded} (${productionCreditsNeeded} for production, ${approvalCreditsNeeded} for approval), Available: ${press.credits}`
      }, { status: 403 });
    }

    // Deduct credits for both jobs
    await prisma.press.update({
      where: { id: pressId },
      data: {
        credits: {
          decrement: totalCreditsNeeded,
        },
      },
    });

    // Create APPROVAL Job
    const plan = press.plan || 'BASIC';
    let rate = creditSettings.priceCreditBasic;
    if (plan === 'PRO') {
      rate = creditSettings.priceCreditPro;
    } else if (plan === 'ENTERPRISE') {
      rate = creditSettings.priceCreditEnterprise;
    }

    const approvalJobCount = await prisma.pdfJob.count({
      where: { orderId: order.id, pdfType: 'APPROVAL' },
    });
    const nextApprovalVersion = approvalJobCount + 1;
    const approvalJob = await prisma.pdfJob.create({
      data: {
        pressId,
        orderId: order.id,
        pdfType: 'APPROVAL',
        status: 'PENDING',
        fileName: `approval_order_${order.id}_v${nextApprovalVersion}.pdf`,
        generatedBy: userId,
        progress: 0,
        metadata: JSON.stringify(jobOptions),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
        version: nextApprovalVersion,
        label: `Approval v${nextApprovalVersion} (Local)`,
        isLocalJob: true,
        creditsLocked: approvalCreditsNeeded,
        rateApplied: rate,
        revenueGenerated: approvalCreditsNeeded * rate,
      },
    });

    // Create PRODUCTION Job
    const prodJobCount = await prisma.pdfJob.count({
      where: { orderId: order.id, pdfType: 'PRODUCTION' },
    });
    const nextProdVersion = prodJobCount + 1;
    const prodJob = await prisma.pdfJob.create({
      data: {
        pressId,
        orderId: order.id,
        pdfType: 'PRODUCTION',
        status: 'PENDING',
        fileName: `production_order_${order.id}_v${nextProdVersion}.pdf`,
        generatedBy: userId,
        progress: 0,
        metadata: JSON.stringify(jobOptions),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
        version: nextProdVersion,
        label: `Production v${nextProdVersion} (Local)`,
        isLocalJob: true,
        creditsLocked: productionCreditsNeeded,
        rateApplied: rate,
        revenueGenerated: productionCreditsNeeded * rate,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Batch upload processed, order created, and PDF generation started.',
      orderId: order.id,
      cardholderCount: cardCount,
      matchedPhotosCount,
      jobs: {
        approvalJobId: approvalJob.id,
        productionJobId: prodJob.id,
      }
    });

  } catch (error) {
    console.error('Batch process error:', error);
    return NextResponse.json({ error: 'Internal server error during batch processing' }, { status: 500 });
  }
}
