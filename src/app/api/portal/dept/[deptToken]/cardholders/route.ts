import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ deptToken: string }> }
) {
  try {
    const { deptToken } = await params;

    const dept = await prisma.clientDepartment.findUnique({
      where: { deptToken },
      include: { portalShare: true },
    });

    if (!dept || !dept.portalShare.active) {
      return NextResponse.json({ error: 'Unauthorized or invalid token' }, { status: 404 });
    }

    const cardholders = await prisma.cardholder.findMany({
      where: {
        clientId: dept.portalShare.clientId,
        pressId: dept.portalShare.pressId,
        enrollToken: dept.enrollToken,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        cardAsset: {
          select: { frontUrl: true, backUrl: true },
        },
      },
    });

    const template = await prisma.cardTemplate.findUnique({
      where: { id: dept.portalShare.templateId },
      select: { name: true }
    });
    const templateName = template?.name || '—';

    const cardholdersWithTemplate = cardholders.map(ch => ({
      ...ch,
      templateName
    }));

    return NextResponse.json({ success: true, cardholders: cardholdersWithTemplate });
  } catch (error) {
    console.error('Dept portal get cardholders error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ deptToken: string }> }
) {
  try {
    const { deptToken } = await params;

    const dept = await prisma.clientDepartment.findUnique({
      where: { deptToken },
      include: { portalShare: true },
    });

    if (!dept || !dept.portalShare.active) {
      return NextResponse.json({ error: 'Unauthorized or invalid token' }, { status: 404 });
    }

    const { name, designation, photoUrl, customFields, uniqueKey } = await request.json();

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    if (uniqueKey) {
      const existing = await prisma.cardholder.findFirst({
        where: { clientId: dept.portalShare.clientId, uniqueKey },
      });
      if (existing) {
        return NextResponse.json({ error: `Cardholder with Unique Key '${uniqueKey}' already exists.` }, { status: 400 });
      }
    }

    const cardSerial = uniqueKey || `C-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const cardholder = await prisma.cardholder.create({
      data: {
        pressId: dept.portalShare.pressId,
        clientId: dept.portalShare.clientId,
        name,
        designation,
        photoUrl,
        customFields: typeof customFields === 'string' ? customFields : JSON.stringify(customFields || {}),
        uniqueKey,
        cardSerial,
        enrollToken: dept.enrollToken, // associate cardholder with this department
      },
    });

    return NextResponse.json({ success: true, cardholder });
  } catch (error) {
    console.error('Dept portal create cardholder error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
