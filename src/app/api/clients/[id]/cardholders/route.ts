import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const pressIdStr = request.headers.get('x-press-id');
    if (!pressIdStr) {
      return NextResponse.json({ error: 'Missing Press ID' }, { status: 400 });
    }
    const pressId = Number(pressIdStr);
    const { id } = await params;
    const clientId = Number(id);

    // Verify client belongs to this press
    const client = await prisma.client.findFirst({
      where: { id: clientId, pressId },
    });

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const cardholders = await prisma.cardholder.findMany({
      where: { clientId },
      orderBy: { name: 'asc' },
      include: {
        cardAsset: {
          select: { templateId: true }
        }
      }
    });

    const templates = await prisma.cardTemplate.findMany({
      where: {
        OR: [
          { clientId },
          { clientId: null }
        ],
        pressId
      },
      select: { id: true, name: true }
    });
    const templateMap = new Map(templates.map(t => [t.id, t.name]));

    const shares = await prisma.clientPortalShare.findMany({
      where: { clientId, pressId },
      select: { enrollToken: true, templateId: true }
    });
    const depts = await prisma.clientDepartment.findMany({
      where: { portalShare: { clientId, pressId } },
      select: { enrollToken: true, portalShare: { select: { templateId: true } } }
    });
    const tokenToTemplateIdMap = new Map<string, number>();
    for (const s of shares) {
      if (s.enrollToken) tokenToTemplateIdMap.set(s.enrollToken, s.templateId);
    }
    for (const d of depts) {
      if (d.enrollToken) tokenToTemplateIdMap.set(d.enrollToken, d.portalShare.templateId);
    }

    const cardholdersWithTemplate = cardholders.map(ch => {
      let templateName = '—';
      let resolvedTemplateId: number | null = null;
      if (ch.enrollToken && tokenToTemplateIdMap.has(ch.enrollToken)) {
        const tId = tokenToTemplateIdMap.get(ch.enrollToken)!;
        resolvedTemplateId = tId;
        templateName = templateMap.get(tId) || '—';
      } else if (ch.cardAsset?.templateId) {
        resolvedTemplateId = ch.cardAsset.templateId;
        templateName = templateMap.get(ch.cardAsset.templateId) || '—';
      }
      return {
        ...ch,
        templateName,
        resolvedTemplateId,
      };
    });

    return NextResponse.json({ success: true, cardholders: cardholdersWithTemplate });
  } catch (error) {
    console.error('Get cardholders error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const pressIdStr = request.headers.get('x-press-id');
    if (!pressIdStr) {
      return NextResponse.json({ error: 'Missing Press ID' }, { status: 400 });
    }
    const pressId = Number(pressIdStr);
    const { id } = await params;
    const clientId = Number(id);

    const { name, designation, photoUrl, customFields, uniqueKey, ignoreDuplicate } = await request.json();

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Verify client
    const client = await prisma.client.findFirst({
      where: { id: clientId, pressId },
    });

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Duplicate check: uniqueKey (like rollNumber, empId) or name + designation
    if (!ignoreDuplicate) {
      let duplicate = null;
      if (uniqueKey) {
        duplicate = await prisma.cardholder.findFirst({
          where: { clientId, uniqueKey },
        });
      } else {
        duplicate = await prisma.cardholder.findFirst({
          where: { clientId, name, designation: designation ?? null },
        });
      }

      if (duplicate) {
        return NextResponse.json({
          duplicate: true,
          message: `Cardholder "${name}" with designation "${designation || ''}" already exists.`,
          cardholder: duplicate,
        }, { status: 409 });
      }
    }

    const cardholder = await prisma.cardholder.create({
      data: {
        pressId,
        clientId,
        name,
        designation,
        photoUrl,
        customFields: customFields ? JSON.stringify(customFields) : null,
        uniqueKey,
        active: true,
      },
    });

    return NextResponse.json({ success: true, cardholder });
  } catch (error: any) {
    console.error('Create cardholder error:', error);
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Cardholder with this unique key already exists.' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
