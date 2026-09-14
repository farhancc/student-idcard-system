import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireActor } from '@/lib/authz';

export async function GET(request: Request) {
  try {
    const auth = requireActor(request);
    if ('response' in auth) return auth.response;
    const { pressId } = auth.actor;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // ── Core Metrics ───────────────────────────────────────────────────────────

    // Cards generated this month (from completed production jobs' cardholders)
    const productionJobsThisMonth = await prisma.pdfJob.findMany({
      where: { pressId, pdfType: 'PRODUCTION', status: 'COMPLETED', completedAt: { gte: startOfMonth } },
      include: { order: { include: { _count: { select: { cardholders: true } } } } },
    });
    const cardsGenerated = productionJobsThisMonth.reduce((acc: number, job: any) => {
      return acc + (job.order?._count?.cardholders || 0);
    }, 0);

    // Cards last month
    const productionJobsLastMonth = await prisma.pdfJob.findMany({
      where: { pressId, pdfType: 'PRODUCTION', status: 'COMPLETED', completedAt: { gte: startOfLastMonth, lt: startOfMonth } },
      include: { order: { include: { _count: { select: { cardholders: true } } } } },
    });
    const cardsLastMonth = productionJobsLastMonth.reduce((acc: number, job: any) => {
      return acc + (job.order?._count?.cardholders || 0);
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
      select: { credits: true, promoCredits: true, plan: true },
    });

    const lockedJobs = await prisma.pdfJob.aggregate({
      where: {
        pressId,
        isLocalJob: true,
        status: { in: ['PENDING', 'PROCESSING'] },
      },
      _sum: {
        creditsLocked: true,
      },
    });
    const lockedCredits = lockedJobs._sum.creditsLocked || 0;

    // Revenue this month (from invoices)
    const invoicesThisMonth = await prisma.orderInvoice.findMany({
      where: { pressId, createdAt: { gte: startOfMonth } },
      select: { totalAmount: true, paymentStatus: true },
    });
    const revenueThisMonth = invoicesThisMonth
      .filter((i: any) => i.paymentStatus === 'PAID')
      .reduce((acc: number, i: any) => acc + Number(i.totalAmount), 0);
    const pendingRevenue = invoicesThisMonth
      .filter((i: any) => i.paymentStatus !== 'PAID')
      .reduce((acc: number, i: any) => acc + Number(i.totalAmount), 0);

    // Storage estimate
    const cardAssetsCount = await prisma.cardAsset.count({ where: { pressId } });
    const completedPdfCount = await prisma.pdfJob.count({ where: { pressId, status: 'COMPLETED' } });
    const calculatedStorageBytes = (cardAssetsCount * 300000) + (completedPdfCount * 1500000);
    const storageUsedGb = Number((calculatedStorageBytes / (1024 * 1024 * 1024)).toFixed(3));

    // ── Breakdowns (using groupBy for batch counts) ───────────────────────────

    const pdfTypeGroups = await prisma.pdfJob.groupBy({
      by: ['pdfType'],
      where: { pressId },
      _count: { _all: true },
    });
    const byType: Record<string, number> = { PRODUCTION: 0, APPROVAL: 0, INDIVIDUAL: 0, INVOICE: 0 };
    pdfTypeGroups.forEach(g => { if (g.pdfType) byType[g.pdfType] = g._count._all; });

    const statusGroups = await prisma.pdfJob.groupBy({
      by: ['status'],
      where: { pressId },
      _count: { _all: true },
    });
    const byStatus: Record<string, number> = { COMPLETED: 0, FAILED: 0, PENDING: 0, PROCESSING: 0 };
    statusGroups.forEach(g => { if (g.status) byStatus[g.status] = g._count._all; });

    // ── Top Clients ────────────────────────────────────────────────────────────

    const clients = await prisma.client.findMany({
      where: { pressId },
      take: 100,
      include: { _count: { select: { cardholders: true } } },
    });
    const topClients = clients
      .map((c: any) => ({ id: c.id, name: c.name, cardCount: c._count.cardholders }))
      .sort((a: any, b: any) => b.cardCount - a.cardCount)
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
      include: {
        client: { select: { name: true } },
        template: { select: { name: true } },
        _count: { select: { cardholders: true } }
      },
    });

    // ── Monthly production and financial trend (single 6-month range query) ───

    const sixMonthsAgoStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    
    const [allJobs6Months, allInvoices6Months] = await Promise.all([
      prisma.pdfJob.findMany({
        where: {
          pressId,
          pdfType: 'PRODUCTION',
          status: 'COMPLETED',
          completedAt: { gte: sixMonthsAgoStart },
        },
        take: 100,
        include: { order: { include: { _count: { select: { cardholders: true } } } } },
      }),
      prisma.orderInvoice.findMany({
        where: {
          pressId,
          createdAt: { gte: sixMonthsAgoStart },
        },
        take: 100,
        select: { createdAt: true, totalAmount: true, paidAmount: true },
      }),
    ]);

    const monthlyTrend: { month: string; cards: number }[] = [];
    const financialTrend: { month: string; invoiced: number; paid: number; pending: number; cards: number }[] = [];

    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);

      const monthJobs = allJobs6Months.filter(
        j => j.completedAt && j.completedAt >= start && j.completedAt < end
      );
      const cards = monthJobs.reduce((acc: number, job: any) => {
        return acc + (job.order?._count?.cardholders || 0);
      }, 0);

      monthlyTrend.push({
        month: start.toLocaleString('default', { month: 'short' }),
        cards,
      });

      const monthInvoices = allInvoices6Months.filter(
        inv => inv.createdAt >= start && inv.createdAt < end
      );
      const invoiced = monthInvoices.reduce((acc: number, inv: any) => acc + Number(inv.totalAmount || 0), 0);
      const paid = monthInvoices.reduce((acc: number, inv: any) => acc + Number(inv.paidAmount || 0), 0);
      const pending = Math.max(0, invoiced - paid);

      financialTrend.push({
        month: start.toLocaleString('default', { month: 'long', year: 'numeric' }),
        invoiced,
        paid,
        pending,
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
        credits: (press?.credits ?? 0) + (press?.promoCredits ?? 0),
        lockedCredits,
        plan: press?.plan ?? 'FREE',
      },
      breakdowns: { byType, byStatus },
      topClients,
      recentJobs: recentJobs.map((j: any) => ({
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
      recentOrders: recentOrders.map((o: any) => ({
        id: o.id,
        clientName: o.client.name,
        templateName: o.template.name,
        status: o.status,
        createdAt: o.createdAt,
        cardCount: o._count.cardholders,
      })),
      monthlyTrend,
      financialTrend,
    });
  } catch (error) {
    console.error('Fetch analytics summary error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
