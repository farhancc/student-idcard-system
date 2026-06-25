import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const pressIdStr = request.headers.get('x-press-id');
    if (!pressIdStr) {
      return NextResponse.json({ error: 'Missing Press ID' }, { status: 400 });
    }
    const pressId = Number(pressIdStr);

    const templates = await prisma.cardTemplate.findMany({
      where: { pressId, isLatest: true },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ success: true, templates });
  } catch (error) {
    console.error('Get templates error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const pressIdStr = request.headers.get('x-press-id');
    if (!pressIdStr) {
      return NextResponse.json({ error: 'Missing Press ID' }, { status: 400 });
    }
    const pressId = Number(pressIdStr);

    const { name, cardWidth, cardHeight, frontImageUrl, backImageUrl, frontFields, backFields, clientId } = await request.json();

    if (!name || !frontImageUrl) {
      return NextResponse.json({ error: 'Template name and Front Image URL are required' }, { status: 400 });
    }

    const template = await prisma.cardTemplate.create({
      data: {
        pressId,
        clientId: clientId ? Number(clientId) : null,
        name,
        cardWidth: cardWidth ? Number(cardWidth) : 1011,
        cardHeight: cardHeight ? Number(cardHeight) : 638,
        frontImageUrl,
        backImageUrl,
        frontFields: frontFields || '[]',
        backFields: backFields || '[]',
        version: 1,
        isLatest: true,
      },
    });

    return NextResponse.json({ success: true, template });
  } catch (error) {
    console.error('Create template error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
