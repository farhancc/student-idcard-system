import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const pressIdStr = request.headers.get('x-press-id');
    if (!pressIdStr) {
      return NextResponse.json({ error: 'Missing Press ID' }, { status: 401 });
    }
    const pressId = Number(pressIdStr);

    const requests = await prisma.creditRequest.findMany({
      where: { pressId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, requests });
  } catch (error) {
    console.error('List credit requests error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const pressIdStr = request.headers.get('x-press-id');
    if (!pressIdStr) {
      return NextResponse.json({ error: 'Missing Press ID' }, { status: 401 });
    }
    const pressId = Number(pressIdStr);
    
    const body = await request.json();
    const amount = Number(body.amount);
    const reason = body.reason?.trim() || null;

    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 });
    }

    const creditRequest = await prisma.creditRequest.create({
      data: {
        pressId,
        amount: Math.floor(amount),
        reason,
        status: 'PENDING',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Credit request submitted successfully',
      request: creditRequest,
    });
  } catch (error) {
    console.error('Create credit request error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
