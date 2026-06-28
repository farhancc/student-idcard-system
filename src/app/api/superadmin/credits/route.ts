import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { creditUpdateSchema } from '@/lib/schemas';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = creditUpdateSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
    }

    const { pressId, amount } = result.data;

    const press = await prisma.press.findUnique({
      where: { id: pressId },
    });

    if (!press) {
      return NextResponse.json({ error: 'Press tenant not found' }, { status: 404 });
    }

    const updatedPress = await prisma.press.update({
      where: { id: pressId },
      data: {
        credits: {
          increment: amount,
        },
      },
    });



    return NextResponse.json({
      success: true,
      message: 'Credits updated successfully',
      credits: updatedPress.credits,
    });
  } catch (error) {
    console.error('SuperAdmin credits update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
