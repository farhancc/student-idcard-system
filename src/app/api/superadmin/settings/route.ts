import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCreditSettings } from '@/lib/system-settings';

export async function GET() {
  try {
    const settings = await getCreditSettings();
    return NextResponse.json({ success: true, settings });
  } catch (error: any) {
    console.error('Failed to get system settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const {
      costSingleSided,
      costDoubleSided,
      costSingleSidedFull,
      costDoubleSidedFull,
      costApprovalPdfSingle,
      costApprovalPdfDouble,
      priceCreditBasic,
      priceCreditPro,
      priceCreditEnterprise,
      marketplaceListingFee,
    } = await request.json();

    if (
      costSingleSided === undefined ||
      costDoubleSided === undefined ||
      costSingleSidedFull === undefined ||
      costDoubleSidedFull === undefined ||
      costApprovalPdfSingle === undefined ||
      costApprovalPdfDouble === undefined ||
      priceCreditBasic === undefined ||
      priceCreditPro === undefined ||
      priceCreditEnterprise === undefined
    ) {
      return NextResponse.json({ error: 'Missing required configuration keys' }, { status: 400 });
    }

    const payload = [
      { key: 'credit_cost_single_sided', value: String(Number(costSingleSided)) },
      { key: 'credit_cost_double_sided', value: String(Number(costDoubleSided)) },
      { key: 'credit_cost_single_sided_full', value: String(Number(costSingleSidedFull)) },
      { key: 'credit_cost_double_sided_full', value: String(Number(costDoubleSidedFull)) },
      { key: 'credit_cost_approval_pdf_single', value: String(Number(costApprovalPdfSingle)) },
      { key: 'credit_cost_approval_pdf_double', value: String(Number(costApprovalPdfDouble)) },
      { key: 'price_credit_basic', value: String(Number(priceCreditBasic)) },
      { key: 'price_credit_pro', value: String(Number(priceCreditPro)) },
      { key: 'price_credit_enterprise', value: String(Number(priceCreditEnterprise)) },
      { key: 'marketplace_listing_fee', value: String(Math.max(0, Number(marketplaceListingFee ?? 0))) },
    ];

    // Perform upserts in a transaction
    await prisma.$transaction(
      payload.map(p =>
        prisma.systemSetting.upsert({
          where: { key: p.key },
          update: { value: p.value },
          create: { key: p.key, value: p.value },
        })
      )
    );

    // Write a system audit log
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    await prisma.systemAuditLog.create({
      data: {
        actorType: 'SUPER_ADMIN',
        actorName: 'Super Admin',
        action: 'CREDIT_COSTS_UPDATED',
        category: 'SYSTEM',
        description: `Updated credit costs & plan pricing. Credit prices: Basic = Rs. ${priceCreditBasic}, Pro = Rs. ${priceCreditPro}, Enterprise = Rs. ${priceCreditEnterprise}`,
        ipAddress: ip,
        severity: 'INFO',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'System settings updated successfully',
      settings: {
        costSingleSided: Number(costSingleSided),
        costDoubleSided: Number(costDoubleSided),
        costSingleSidedFull: Number(costSingleSidedFull),
        costDoubleSidedFull: Number(costDoubleSidedFull),
        costApprovalPdfSingle: Number(costApprovalPdfSingle),
        costApprovalPdfDouble: Number(costApprovalPdfDouble),
        priceCreditBasic: Number(priceCreditBasic),
        priceCreditPro: Number(priceCreditPro),
        priceCreditEnterprise: Number(priceCreditEnterprise),
      },
    });
  } catch (error: any) {
    console.error('Failed to update system settings:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
