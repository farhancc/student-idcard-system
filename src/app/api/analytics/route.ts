import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const pressIdStr = request.headers.get('x-press-id');
    if (!pressIdStr) {
      return NextResponse.json({ error: 'Missing Press ID' }, { status: 400 });
    }
    const pressId = Number(pressIdStr);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // ── Core Metrics ───────────────────────────────────────────────────────────

    // Cards generated this month (from completed production jobs' cardholderIds)
    const productionJobsThisMonth = await prisma.pdfJob.findMany({
      where: { pressId, pdfType: 'PRODUCTION', status: 'COMPLETED', completedAt: { gte: startOfMonth } },
      include: { order: { select: { cardholderIds: true } } },
    });
    const cardsGenerated = productionJobsThisMonth.reduce((acc: number, job: any) => {
      try { return acc + (JSON.parse(job.order?.cardholderIds || '[]') as number[]).length; } catch { return acc; }
    }, 0);

    // Cards last month
    const productionJobsLastMonth = await prisma.pdfJob.findMany({
      where: { pressId, pdfType: 'PRODUCTION', status: 'COMPLETED', completedAt: { gte: startOfLastMonth, lt: startOfMonth } },
      include: { order: { select: { cardholderIds: true } } },
    });
    const cardsLastMonth = productionJobsLastMonth.reduce((acc: number, job: any) => {
      try { return acc + (JSON.parse(job.order?.cardholderIds || '[]') as number[]).length; } catch { return acc; }
    }, 0);

    // PDFs generated this month
    const pdfsGenerated = await prisma.pdfJob.count({
      where: { pressId, generatedAt: { gte: startOfMonth }, status: 'COMPLETED' },
    });

    // Active clients
    const clientsCount = await prisma.client.count({ where: { pressId } });

    // Total orders this month
    const ordersThisMonth = await prisma.cardOrder.count({
      where: { pressId, createdAt: { gte: startOfMonth } },
    });

    // Total cardholders
    const totalCardholders = await prisma.cardholder.count({ where: { pressId } });

    // Active pending/processing jobs
    const pendingJobs = await prisma.pdfJob.count({
      where: { pressId, status: { in: ['PENDING', 'PROCESSING'] } },
    });

    // Press credits
    const press = await prisma.press.findUnique({
      where: { id: pressId },
      select: { credits: true, plan: true },
    });

    // Revenue this month (from invoices)
    const invoicesThisMonth = await prisma.orderInvoice.findMany({
      where: { pressId, createdAt: { gte: startOfMonth } },
      select: { totalAmount: true, paymentStatus: true },
    });
    const revenueThisMonth = invoicesThisMonth
      .filter(i => i.paymentStatus === 'PAID')
      .reduce((acc: number, i: any) => acc + Number(i.totalAmount), 0);
    const pendingRevenue = invoicesThisMonth
      .filter(i => i.paymentStatus !== 'PAID')
      .reduce((acc: number, i: any) => acc + Number(i.totalAmount), 0);

    // Storage estimate
    const cardAssetsCount = await prisma.cardAsset.count({ where: { pressId } });
    const completedPdfCount = await prisma.pdfJob.count({ where: { pressId, status: 'COMPLETED' } });
    const calculatedStorageBytes = (cardAssetsCount * 300000) + (completedPdfCount * 1500000);
    const storageUsedGb = Number((calculatedStorageBytes / (1024 * 1024 * 1024)).toFixed(3));

    // ── Breakdowns ─────────────────────────────────────────────────────────────

    const pdfTypes = ['PRODUCTION', 'APPROVAL', 'INDIVIDUAL', 'INVOICE'];
    const byType: Record<string, number> = {};
    for (const type of pdfTypes) {
      byType[type] = await prisma.pdfJob.count({ where: { pressId, pdfType: type } });
    }

    const statuses = ['COMPLETED', 'FAILED', 'PENDING', 'PROCESSING'];
    const byStatus: Record<string, number> = {};
    for (const status of statuses) {
      byStatus[status] = await prisma.pdfJob.count({ where: { pressId, status } });
    }

    // ── Top Clients ────────────────────────────────────────────────────────────

    const clients = await prisma.client.findMany({
      where: { pressId },
      include: { _count: { select: { cardholders: true } } },
    });
    const topClients = clients
      .map(c => ({ id: c.id, name: c.name, cardCount: c._count.cardholders }))
      .sort((a, b) => b.cardCount - a.cardCount)
      .slice(0, 5);

    // ── Recent Activity ────────────────────────────────────────────────────────

    const recentJobs = await prisma.pdfJob.findMany({
      where: { pressId },
      orderBy: { generatedAt: 'desc' },
      take: 8,
      include: { order: { include: { client: { select: { name: true } } } } },
    });

    const recentOrders = await prisma.cardOrder.findMany({
      where: { pressId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { client: { select: { name: true } }, template: { select: { name: true } } },
    });

    // ── Monthly production trend (last 6 months) ──────────────────────────────

    const monthlyTrend: { month: string; cards: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const jobs = await prisma.pdfJob.findMany({
        where: { pressId, pdfType: 'PRODUCTION', status: 'COMPLETED', completedAt: { gte: start, lt: end } },
        include: { order: { select: { cardholderIds: true } } },
      });
      const cards = jobs.reduce((acc: number, job: any) => {
        try { return acc + (JSON.parse(job.order?.cardholderIds || '[]') as number[]).length; } catch { return acc; }
      }, 0);
      monthlyTrend.push({
        month: start.toLocaleString('default', { month: 'short' }),
        cards,
      });
    }

    return NextResponse.json({
      success: true,
      summary: {
        cardsGenerated,
        cardsLastMonth,
        pdfsGenerated,
        clientsServed: clientsCount,
        ordersThisMonth,
        totalCardholders,
        pendingJobs,
        storageUsedGb,
        storageLimitGb: 5.0,
        revenueThisMonth,
        pendingRevenue,
        credits: press?.credits ?? 0,
        lockedCredits: 0,
        plan: press?.plan ?? 'FREE',
      },
      breakdowns: { byType, byStatus },
      topClients,
      recentJobs: recentJobs.map(j => ({
        id: j.id,
        pdfType: j.pdfType,
        status: j.status,
        fileName: j.fileName,
        progress: j.progress,
        isLocalJob: j.isLocalJob,
        generatedAt: j.generatedAt,
        clientName: j.order?.client?.name || '—',
        orderId: j.orderId,
      })),
      recentOrders: recentOrders.map(o => ({
        id: o.id,
        clientName: o.client.name,
        templateName: o.template.name,
        status: o.status,
        createdAt: o.createdAt,
        cardCount: JSON.parse(o.cardholderIds || '[]').length,
      })),
      monthlyTrend,
    });
  } catch (error) {
    console.error('Fetch analytics summary error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
