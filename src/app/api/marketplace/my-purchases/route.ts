import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireActor } from '@/lib/authz';

// GET /api/marketplace/my-purchases — list templates this press has purchased
export async function GET(request: Request) {
  try {
    const auth = requireActor(request);
    if ('response' in auth) return auth.response;
    const { pressId } = auth.actor;

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
  } catch (error: unknown) {
    console.error('List purchases error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
