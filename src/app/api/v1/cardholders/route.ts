import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createCardholderSchema } from '@/lib/schemas';
import { authenticateApiKey } from '@/lib/api-key-auth';
import { clampLimit } from '@/lib/pagination';

export async function GET(request: Request) {
  try {
    const auth = await authenticateApiKey(request);
    if ('response' in auth) return auth.response;
    const { pressId } = auth;

    const { searchParams } = new URL(request.url);
    const clientIdParam = searchParams.get('clientId');
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = clampLimit(searchParams.get('limit'), 50, 100);

    const whereClause: { pressId: number; clientId?: number } = { pressId };
    if (clientIdParam) {
      const clientId = Number(clientIdParam);
      if (isNaN(clientId)) {
        return NextResponse.json({ error: 'Invalid clientId query parameter' }, { status: 400 });
      }
      whereClause.clientId = clientId;
    }

    const [cardholders, total] = await Promise.all([
      prisma.cardholder.findMany({
        where: whereClause,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { id: 'desc' },
      }),
      prisma.cardholder.count({ where: whereClause }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return NextResponse.json({
      success: true,
      cardholders,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    });
  } catch (error) {
    console.error('REST get cardholders error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await authenticateApiKey(request);
    if ('response' in auth) return auth.response;
    const { pressId } = auth;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const result = createCardholderSchema.safeParse(body);
    if (!result.success) {
      const messages = result.error.issues.map(i => i.message).join('; ');
      return NextResponse.json({ error: messages || 'Invalid input' }, { status: 400 });
    }

    const { clientId, name, designation, photoUrl, customFields, uniqueKey, ignoreDuplicate } = result.data;

    // Verify client belongs to this press
    const client = await prisma.client.findFirst({
      where: { id: Number(clientId), pressId },
    });
    if (!client) {
      return NextResponse.json({ error: 'Client not found or access denied' }, { status: 404 });
    }

    // Fold uniqueKey into customFields if provided
    const custom = customFields || {};
    if (uniqueKey && !custom.uniqueKey && !custom.id && !custom.unique_key) {
      custom.uniqueKey = uniqueKey;
    }

    // Check duplicate
    if (!ignoreDuplicate) {
      const duplicate = await prisma.cardholder.findFirst({
        where: { clientId: Number(clientId), name, designation: designation ?? null },
      });
      if (duplicate) {
        return NextResponse.json({
          duplicate: true,
          error: `Cardholder "${name}" with designation "${designation || ''}" already exists.`,
          message: `Cardholder "${name}" with designation "${designation || ''}" already exists.`,
          cardholder: duplicate,
        }, { status: 409 });
      }
    }

    // Create
    const cardholder = await prisma.cardholder.create({
      data: {
        pressId,
        clientId: Number(clientId),
        name,
        designation,
        photoUrl,
        customFields: Object.keys(custom).length > 0 ? JSON.stringify(custom) : null,
      },
    });

    return NextResponse.json({ success: true, cardholder });
  } catch (error) {
    console.error('REST create cardholder error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
