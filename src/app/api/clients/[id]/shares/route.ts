import { NextResponse } from 'next/server';
import { requireActor } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireActor(request);
    if ('response' in auth) return auth.response;
    const { pressId } = auth.actor;
    const { id: clientIdStr } = await params;
    const clientId = Number(clientIdStr);

    const shares = await prisma.clientPortalShare.findMany({
      where: { pressId, clientId },
      include: {
        departments: {
          select: { enrollToken: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Collect all tokens across all shares
    const allTokens: string[] = [];
    const shareTokensMap = new Map<number, string[]>();
    const templateIds = new Set<number>();

    for (const share of shares) {
      const tokens = [share.enrollToken, ...share.departments.map(d => d.enrollToken)].filter(Boolean);
      shareTokensMap.set(share.id, tokens);
      allTokens.push(...tokens);
      templateIds.add(share.templateId);
    }

    // Batch query 1: Cardholder counts grouped by enrollToken
    const cardholderCounts = allTokens.length > 0
      ? await prisma.cardholder.groupBy({
          by: ['enrollToken'],
          where: { enrollToken: { in: allTokens } },
          _count: { _all: true },
        })
      : [];
    const countMap = new Map(cardholderCounts.map(c => [c.enrollToken, c._count._all]));

    // Batch query 2: Latest completed pdfJobs for client and templates
    const completedJobs = templateIds.size > 0
      ? await prisma.pdfJob.findMany({
          where: {
            order: {
              clientId,
              templateId: { in: Array.from(templateIds) },
            },
            status: 'COMPLETED',
          },
          orderBy: { id: 'desc' },
          select: {
            id: true,
            isLocalJob: true,
            pdfType: true,
            order: { select: { templateId: true } },
          },
        })
      : [];

    const approvalJobMap = new Map<number, { id: number; isLocalJob: boolean }>();
    const productionJobMap = new Map<number, { id: number; isLocalJob: boolean }>();

    for (const job of completedJobs) {
      const tId = job.order.templateId;
      if (job.pdfType === 'APPROVAL' && !approvalJobMap.has(tId)) {
        approvalJobMap.set(tId, { id: job.id, isLocalJob: job.isLocalJob });
      } else if (job.pdfType === 'PRODUCTION' && !productionJobMap.has(tId)) {
        productionJobMap.set(tId, { id: job.id, isLocalJob: job.isLocalJob });
      }
    }

    const sharesWithCount = shares.map((share) => {
      const tokens = shareTokensMap.get(share.id) || [];
      const enrolledCount = tokens.reduce((sum, tok) => sum + (countMap.get(tok) || 0), 0);
      const latestApprovalJob = approvalJobMap.get(share.templateId) || null;
      const latestProductionJob = productionJobMap.get(share.templateId) || null;

      // Remove internal departments from response object to maintain exact API contract
      const { departments: _d, ...shareData } = share;
      return {
        ...shareData,
        enrolledCount,
        latestApprovalJob,
        latestProductionJob,
      };
    });

    // Templates for UI: Strictly show client-assigned templates (via join table or direct column)
    const clientAssignments = await prisma.templateClientAssignment.findMany({
      where: { clientId },
      select: { templateId: true },
    });
    const assignedIds = clientAssignments.map(a => a.templateId);

    const templates = await prisma.cardTemplate.findMany({
      where: {
        isLatest: true,
        OR: [{ pressId: null }, { pressId }],
        AND: [
          {
            OR: [
              { id: { in: assignedIds } },
              { clientId: clientId }
            ]
          }
        ]
      },
      select: { id: true, name: true, frontImageUrl: true, clientId: true },
    });

    const hasClientAssignments = clientAssignments.length > 0 || templates.some(t => t.clientId === clientId);

    return NextResponse.json({
      success: true,
      shares: sharesWithCount,
      templates,
      hasClientAssignments,
    });
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
    const auth = requireActor(request);
    if ('response' in auth) return auth.response;
    const { pressId } = auth.actor;
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
