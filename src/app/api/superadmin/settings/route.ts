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
    const { costSingleSided, costDoubleSided, costApprovalPdf } = await request.json();

    if (
      costSingleSided === undefined ||
      costDoubleSided === undefined ||
      costApprovalPdf === undefined
    ) {
      return NextResponse.json({ error: 'Missing required configuration keys' }, { status: 400 });
    }

    const payload = [
      { key: 'credit_cost_single_sided', value: String(Number(costSingleSided)) },
      { key: 'credit_cost_double_sided', value: String(Number(costDoubleSided)) },
      { key: 'credit_cost_approval_pdf', value: String(Number(costApprovalPdf)) },
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
        description: `Updated credit costs: Single-sided = ${costSingleSided}, Double-sided = ${costDoubleSided}, Approval PDF = ${costApprovalPdf}`,
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
        costApprovalPdf: Number(costApprovalPdf),
      },
    });
  } catch (error: any) {
    console.error('Failed to update system settings:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
