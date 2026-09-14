import { NextResponse } from 'next/server';
import { requireActor } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { clientSchema } from '@/lib/schemas';

export async function GET(request: Request) {
  try {
    const auth = requireActor(request);
    if ('response' in auth) return auth.response;
    const { pressId } = auth.actor;

    const { searchParams } = new URL(request.url);
    const limitStr = searchParams.get('limit') || searchParams.get('take');
    const offsetStr = searchParams.get('offset') || searchParams.get('skip');
    const limit = limitStr ? Number(limitStr) : undefined;
    const offset = offsetStr ? Number(offsetStr) : undefined;

    const [total, clients] = await Promise.all([
      prisma.client.count({ where: { pressId } }),
      prisma.client.findMany({
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
        ...(limit !== undefined ? { take: limit } : {}),
        ...(offset !== undefined ? { skip: offset } : {}),
      }),
    ]);

    return NextResponse.json({
      success: true,
      clients,
      data: clients,
      total,
      limit: limit ?? clients.length,
      offset: offset ?? 0,
    });
  } catch (error) {
    console.error('Get clients error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = requireActor(request);
    if ('response' in auth) return auth.response;
    const { pressId } = auth.actor;

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
