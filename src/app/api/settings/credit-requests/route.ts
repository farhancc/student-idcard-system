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
  } catch (error: any) {
    console.error('List credit requests error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
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
    
    const body = await request.json();
    const amount = Number(body.amount);

    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 });
    }

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
  } catch (error: any) {
    console.error('Create credit request error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
