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

    const { amount, reason } = await request.json();

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'Valid amount is required' }, { status: 400 });
    }

    // Use a transaction to safely check and decrement credits
    const updatedPress = await prisma.$transaction(async (tx) => {
      const presses = await tx.$queryRaw<any[]>`
        SELECT id, credits FROM "press" WHERE id = ${pressId} FOR UPDATE
      `;
      const press = presses[0];

      if (!press) {
        throw new Error('Press tenant not found');
      }

      if (press.credits < amount) {
        throw new Error(`Insufficient credits. Required: ${amount}, Available: ${press.credits}`);
      }

      return tx.press.update({
        where: { id: pressId },
        data: {
          credits: {
            decrement: amount,
          },
        },
      });
    });

    return NextResponse.json({
      success: true,
      creditsBalance: updatedPress.credits,
    });
  } catch (error: any) {
    console.error('Deduct credits error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 400 });
  }
}
