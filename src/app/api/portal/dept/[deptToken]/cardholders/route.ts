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

    const { name, designation, photoUrl, customFields } = await request.json();

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Validate Number fields against template min/max caps
    const template = dept.portalShare.templateId ? await prisma.cardTemplate.findUnique({ where: { id: dept.portalShare.templateId } }) : null;
    if (template) {
      try {
        const front = JSON.parse(template.frontFields || '[]');
        const back = JSON.parse(template.backFields || '[]');
        const allFields: any[] = [...front, ...back];
        const fieldsObj = typeof customFields === 'string' ? JSON.parse(customFields) : (customFields || {});

        for (const f of allFields) {
          if (f.field && f.type === 'number') {
            const rawVal = fieldsObj[f.field];
            if (rawVal !== undefined && rawVal !== null && String(rawVal).trim() !== '') {
              const numVal = Number(rawVal);
              const label = f.label || f.field;
              if (isNaN(numVal)) {
                return NextResponse.json({ error: `${label} must be a valid number` }, { status: 400 });
              }
              if (f.min !== undefined && f.min !== null && numVal < f.min) {
                return NextResponse.json({ error: `${label} must be at least ${f.min}` }, { status: 400 });
              }
              if (f.max !== undefined && f.max !== null && numVal > f.max) {
                return NextResponse.json({ error: `${label} cannot exceed ${f.max}` }, { status: 400 });
              }
            }
          }
        }
      } catch (err) {
        console.error('Failed to parse template fields:', err);
      }
    }

    const cardSerial = `C-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const cardholder = await prisma.cardholder.create({
      data: {
        pressId: dept.portalShare.pressId,
        clientId: dept.portalShare.clientId,
        name,
        designation,
        photoUrl,
        customFields: typeof customFields === 'string' ? customFields : JSON.stringify(customFields || {}),
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
