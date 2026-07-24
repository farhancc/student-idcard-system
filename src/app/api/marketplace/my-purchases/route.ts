import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/marketplace/my-purchases — list templates this press has purchased
export async function GET(request: Request) {
  try {
    const pressIdStr = request.headers.get('x-press-id');
    if (!pressIdStr) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const pressId = Number(pressIdStr);

    const purchases = await prisma.templatePurchase.findMany({
      where: { buyerPressId: pressId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        templateId: true,
        templateName: true,
        creditsSpent: true,
        clonedTemplateId: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ purchases });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
