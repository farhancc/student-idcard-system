import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export async function GET(request: Request) {
  try {
    const pressIdStr = request.headers.get('x-press-id');
    if (!pressIdStr) {
      return NextResponse.json({ error: 'Missing Press ID' }, { status: 401 });
    }
    const pressId = Number(pressIdStr);

    const keys = await prisma.pressApiKey.findMany({
      where: { pressId },
      select: {
        id: true,
        label: true,
        lastUsed: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, keys });
  } catch (error) {
    console.error('List API keys error:', error);
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
    const { label } = await request.json();

    if (!label || !label.trim()) {
      return NextResponse.json({ error: 'Label is required' }, { status: 400 });
    }

    // Generate random key
    const rawKey = `press_live_${crypto.randomBytes(24).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const keyRecord = await prisma.pressApiKey.create({
      data: {
        pressId,
        label: label.trim(),
        keyHash,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'API key generated successfully. Copy the key now as it will not be shown again.',
      apiKey: rawKey,
      key: {
        id: keyRecord.id,
        label: keyRecord.label,
        createdAt: keyRecord.createdAt,
      },
    });
  } catch (error) {
    console.error('Generate API key error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
