import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

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
    const { id: clientIdStr } = await params;
    const clientId = Number(clientIdStr);

    const shares = await prisma.clientPortalShare.findMany({
      where: { pressId, clientId },
      orderBy: { createdAt: 'desc' },
    });

    const sharesWithCount = await Promise.all(
      shares.map(async (share) => {
        const depts = await prisma.clientDepartment.findMany({
          where: { portalShareId: share.id },
          select: { enrollToken: true },
        });
        const tokens = [share.enrollToken, ...depts.map(d => d.enrollToken)];
        const count = await prisma.cardholder.count({
          where: { enrollToken: { in: tokens } },
        });

        const latestApprovalJob = await prisma.pdfJob.findFirst({
          where: {
            order: {
              clientId: share.clientId,
              templateId: share.templateId,
            },
            pdfType: 'APPROVAL',
            status: 'COMPLETED',
          },
          orderBy: { id: 'desc' },
          select: { id: true, isLocalJob: true },
        });

        const latestProductionJob = await prisma.pdfJob.findFirst({
          where: {
            order: {
              clientId: share.clientId,
              templateId: share.templateId,
            },
            pdfType: 'PRODUCTION',
            status: 'COMPLETED',
          },
          orderBy: { id: 'desc' },
          select: { id: true, isLocalJob: true },
        });

        return {
          ...share,
          enrolledCount: count,
          latestApprovalJob,
          latestProductionJob,
        };
      })
    );

    // Also get list of templates for selection in UI
    const templates = await prisma.cardTemplate.findMany({
      where: { pressId, isLatest: true },
      select: { id: true, name: true, frontImageUrl: true },
    });

    return NextResponse.json({ success: true, shares: sharesWithCount, templates });
  } catch (error) {
    console.error('Get client shares error:', error);
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
    const { id: clientIdStr } = await params;
    const clientId = Number(clientIdStr);

    const { templateId } = await request.json();
    if (!templateId) {
      return NextResponse.json({ error: 'Template ID is required' }, { status: 400 });
    }

    // Generate unique tokens: Organisation Head and general enrollment
    const orgToken   = crypto.randomUUID();
    const enrollToken = crypto.randomUUID();

    const share = await prisma.clientPortalShare.create({
      data: {
        pressId,
        clientId,
        templateId: Number(templateId),
        orgToken,
        enrollToken,
      },
    });

    return NextResponse.json({ success: true, share });
  } catch (error) {
    console.error('Create client share error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
