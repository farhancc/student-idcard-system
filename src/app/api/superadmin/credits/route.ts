import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { pressId, amount } = await request.json();

    if (!pressId || amount === undefined || isNaN(Number(amount))) {
      return NextResponse.json({ error: 'Press ID and valid amount are required' }, { status: 400 });
    }

    const press = await prisma.press.findUnique({
      where: { id: Number(pressId) },
    });

    if (!press) {
      return NextResponse.json({ error: 'Press tenant not found' }, { status: 404 });
    }

    const updatedPress = await prisma.press.update({
      where: { id: Number(pressId) },
      data: {
        credits: {
          increment: Number(amount),
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
