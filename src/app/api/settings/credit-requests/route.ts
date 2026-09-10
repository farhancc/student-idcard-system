import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const pressIdStr = request.headers.get('x-press-id');
    if (!pressIdStr || pressIdStr === 'undefined' || pressIdStr === 'null') {
      return NextResponse.json({ error: 'Missing or invalid Press ID context' }, { status: 401 });
    }
    const pressId = Number(pressIdStr);
    if (isNaN(pressId)) {
      return NextResponse.json({ error: 'Invalid Press ID context' }, { status: 401 });
    }

    const requests = await prisma.creditRequest.findMany({
      where: { pressId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, requests });
  } catch (error: unknown) {
    console.error('List credit requests error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const pressIdStr = request.headers.get('x-press-id');
    if (!pressIdStr || pressIdStr === 'undefined' || pressIdStr === 'null') {
      return NextResponse.json({ error: 'Missing or invalid Press ID context' }, { status: 401 });
    }
    const pressId = Number(pressIdStr);
    if (isNaN(pressId)) {
      return NextResponse.json({ error: 'Invalid Press ID context' }, { status: 401 });
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { creditRequestSchema } = await import('@/lib/schemas');
    const parsed = creditRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 });
    }

    const { amount } = parsed.data;


    const creditRequest = await prisma.creditRequest.create({
      data: {
        pressId,
        amount: Math.floor(amount),
        status: 'PENDING',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Credit request submitted successfully',
      request: creditRequest,
    });
  } catch (error: unknown) {
    console.error('Create credit request error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
