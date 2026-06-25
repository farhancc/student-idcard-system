import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';


export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgToken: string }> }
) {
  try {
    const { orgToken } = await params;

    const share = await prisma.clientPortalShare.findUnique({
      where: { orgToken },
    });

    if (!share || !share.active) {
      return NextResponse.json({ error: 'Unauthorized or invalid token' }, { status: 404 });
    }

    const clientId = share.clientId;
    const pressId = share.pressId;

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

    const cardholders = await prisma.cardholder.findMany({
      where: { clientId, pressId },
      orderBy: { createdAt: 'desc' },
      include: {
        cardAsset: {
          select: {
            frontUrl: true,
            backUrl: true,
            templateId: true
          },
        },
      },
    });

    const cardholdersWithTemplate = cardholders.map(ch => {
      let templateName = '—';
      if (ch.enrollToken && tokenToTemplateIdMap.has(ch.enrollToken)) {
        const tId = tokenToTemplateIdMap.get(ch.enrollToken);
        templateName = templateMap.get(tId!) || '—';
      } else if (ch.cardAsset?.templateId) {
        templateName = templateMap.get(ch.cardAsset.templateId) || '—';
      }
      return {
        ...ch,
        templateName
      };
    });

    return NextResponse.json({ success: true, cardholders: cardholdersWithTemplate });
  } catch (error) {
    console.error('Portal get cardholders error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgToken: string }> }
) {
  try {
    const { orgToken } = await params;

    const share = await prisma.clientPortalShare.findUnique({
      where: { orgToken },
    });

    if (!share || !share.active) {
      return NextResponse.json({ error: 'Unauthorized or invalid token' }, { status: 404 });
    }

    const { name, designation, photoUrl, customFields, uniqueKey } = await request.json();

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Check unique key constraint if provided
    if (uniqueKey) {
      const existing = await prisma.cardholder.findFirst({
        where: { clientId: share.clientId, uniqueKey },
      });
      if (existing) {
        return NextResponse.json({ error: `Cardholder with Unique Key/Roll Number '${uniqueKey}' already exists.` }, { status: 400 });
      }
    }

    // Generate unique card serial number if needed
    const cardSerial = uniqueKey || `C-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const cardholder = await prisma.cardholder.create({
      data: {
        pressId: share.pressId,
        clientId: share.clientId,
        name,
        designation,
        photoUrl,
        customFields: typeof customFields === 'string' ? customFields : JSON.stringify(customFields || {}),
        uniqueKey,
        cardSerial,
        enrollToken: share.enrollToken,
      },
    });

    return NextResponse.json({ success: true, cardholder });
  } catch (error) {
    console.error('Portal create cardholder error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
