import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { clientSchema } from '@/lib/schemas';

export async function GET(request: Request) {
  try {
    const pressIdStr = request.headers.get('x-press-id');
    if (!pressIdStr) {
      return NextResponse.json({ error: 'Missing Press ID' }, { status: 400 });
    }
    const pressId = Number(pressIdStr);

    const clients = await prisma.client.findMany({
      where: { pressId },
      include: {
        _count: {
          select: {
            cardholders: true,
            orders: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ success: true, clients });
  } catch (error) {
    console.error('Get clients error:', error);
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

    const body = await request.json();
    const result = clientSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
    }

    const { name, type, contactName, contactPhone, contactEmail, address } = result.data;

    const client = await prisma.client.create({
      data: {
        pressId,
        name,
        type,
        contactName,
        contactPhone,
        contactEmail,
        address,
      },
    });

    return NextResponse.json({ success: true, client });
  } catch (error) {
    console.error('Create client error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
