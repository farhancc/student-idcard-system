import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { templateSchema } from '@/lib/schemas';

export async function GET() {
  try {
    const templates = await prisma.cardTemplate.findMany({
      where: { pressId: null, isLatest: true },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ success: true, templates });
  } catch (error) {
    console.error('Superadmin get templates error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = templateSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
    }

    const { name, cardWidth, cardHeight, frontImageUrl, backImageUrl, frontOriginalUrl, backOriginalUrl, frontFields, backFields } = result.data;

    const template = await prisma.cardTemplate.create({
      data: {
        pressId: null, // Global template
        clientId: null,
        name,
        cardWidth: cardWidth ? Number(cardWidth) : 673,
        cardHeight: cardHeight ? Number(cardHeight) : 1039,
        frontImageUrl,
        backImageUrl,
        frontOriginalUrl: frontOriginalUrl || null,
        backOriginalUrl: backOriginalUrl || null,
        frontFields: frontFields || '[]',
        backFields: backFields || '[]',
        version: 1,
        isLatest: true,
      },
    });

    return NextResponse.json({ success: true, template });
  } catch (error) {
    console.error('Superadmin create template error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
