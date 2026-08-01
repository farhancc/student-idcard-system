import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { templateSchema } from '@/lib/schemas';

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
      include: {
        clientAssignments: {
          select: { clientId: true },
        },
      },
    });

    const globalTemplates = await prisma.cardTemplate.findMany({
      where: { pressId: null, isLatest: true },
      orderBy: { name: 'asc' },
      include: {
        clientAssignments: {
          select: { clientId: true },
        },
      },
    });

    // Flatten clientIds for convenience
    const mapTemplates = (list: any[]) =>
      list.map((t) => ({
        ...t,
        clientIds: t.clientAssignments.map((a: any) => a.clientId),
      }));

    return NextResponse.json({ success: true, templates: mapTemplates(templates), globalTemplates: mapTemplates(globalTemplates) });
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

    const body = await request.json();
    const result = templateSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
    }

    const {
      name, cardWidth, cardHeight,
      frontImageUrl, backImageUrl, frontOriginalUrl, backOriginalUrl,
      frontFields, backFields, clientId,
      category, sides, clientIds,
    } = result.data;

    if (!clientIds || clientIds.length === 0) {
      return NextResponse.json({ error: 'Please assign this template to at least one client before saving.' }, { status: 400 });
    }

    // Check if a template with this name already exists for this press
    const existing = await prisma.cardTemplate.findFirst({
      where: {
        pressId,
        isLatest: true,
        name: {
          equals: name.trim(),
          mode: 'insensitive',
        },
      },
    });
    if (existing) {
      return NextResponse.json({ error: `A template with the name "${name.trim()}" already exists` }, { status: 400 });
    }

    const template = await prisma.cardTemplate.create({
      data: {
        pressId,
        clientId: clientId ? Number(clientId) : null,
        name,
        cardWidth: cardWidth ? Number(cardWidth) : 673,
        cardHeight: cardHeight ? Number(cardHeight) : 1039,
        frontImageUrl,
        backImageUrl,
        frontOriginalUrl: frontOriginalUrl || null,
        backOriginalUrl: backOriginalUrl || null,
        frontFields: frontFields || '[]',
        backFields: backFields || '[]',
        category: category || 'OTHER',
        sides: sides || 1,
        version: 1,
        isLatest: true,
      },
    });

    // Sync client assignments (multi-client)
    if (clientIds && clientIds.length > 0) {
      await prisma.templateClientAssignment.createMany({
        data: clientIds.map((cid) => ({ templateId: template.id, clientId: cid })),
        skipDuplicates: true,
      });
    }

    return NextResponse.json({ success: true, template: { ...template, clientIds: clientIds || [] } });
  } catch (error) {
    console.error('Create template error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
