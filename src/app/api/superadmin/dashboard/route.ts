import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // ── Platform-wide KPIs (all parallel) ──────────────────────────
    const [
      totalPresses,
      activePresses,
      totalClients,
      totalOrders,
      totalJobs,
      totalUsers,
      totalTemplates,
      totalFonts,
      pendingCreditRequests,
      newPressesThisMonth,
      newOrdersThisMonth,
      totalCardholders,
      recentLogs,
      recentCreditRequests,
      creditAgg,
      invoices,
    ] = await Promise.all([
      prisma.press.count(),
      prisma.press.count({ where: { isActive: true } }),
      prisma.client.count(),
      prisma.cardOrder.count(),
      prisma.pdfJob.count(),
      prisma.pressUser.count(),
      prisma.cardTemplate.count(),
      prisma.pressFont.count(),
      prisma.creditRequest.count({ where: { status: 'PENDING' } }),
      prisma.press.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.cardOrder.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.cardholder.count(),
      (prisma as any).systemAuditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true,
          action: true,
          category: true,
          severity: true,
          createdAt: true,
          description: true,
          actorName: true,
        },
      }),
      prisma.creditRequest.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { press: { select: { name: true, credits: true } } },
      }),
      prisma.press.aggregate({ _sum: { credits: true } }),
      prisma.orderInvoice.findMany({
        select: { totalAmount: true, createdAt: true },
      }),
    ]);

    // ── Revenue aggregation ─────────────────────────────────────────
    const totalRevenue = invoices.reduce(
      (sum: number, inv: { totalAmount: any }) => sum + Number(inv.totalAmount),
      0
    );

    // Revenue by month (last 6 months)
    const monthlyRevenue: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyRevenue[key] = 0;
    }
    invoices.forEach((inv: { totalAmount: any; createdAt: Date }) => {
      const d = new Date(inv.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (key in monthlyRevenue) {
        monthlyRevenue[key] += Number(inv.totalAmount);
      }
    });

    // ── Monthly cardholders (last 6 months) ────────────────────────
    const monthlyCards: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyCards[key] = 0;
    }
    // Fetch cardholders in the last 6-month window
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const recentCardholders = await prisma.cardholder.findMany({
      where: { createdAt: { gte: sixMonthsAgo } },
      select: { createdAt: true },
    });
    recentCardholders.forEach((ch: { createdAt: Date }) => {
      const d = new Date(ch.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (key in monthlyCards) {
        monthlyCards[key] = (monthlyCards[key] || 0) + 1;
      }
    });

    // ── Top 5 presses by cards printed ────────────────────────────
    const allPresses = await prisma.press.findMany({
      include: {
        clients: {
          include: {
            orders: {
              include: {
                _count: { select: { cardholders: true } },
                invoice: { select: { totalAmount: true } },
              },
            },
          },
        },
      },
    });

    const topPresses = allPresses
      .map((p) => {
        let cards = 0;
        let revenue = 0;
        p.clients.forEach((c: any) =>
          c.orders.forEach((o: any) => {
            cards += o._count?.cardholders || 0;
            revenue += Number(o.invoice?.totalAmount || 0);
          })
        );
        return {
          id: p.id,
          name: p.name,
          plan: p.plan,
          isActive: p.isActive,
          credits: p.credits,
          cards,
          revenue,
        };
      })
      .sort((a, b) => b.cards - a.cards)
      .slice(0, 5);

    const totalCreditsInSystem = creditAgg._sum.credits ?? 0;

    return NextResponse.json({
      success: true,
      kpis: {
        totalPresses,
        activePresses,
        suspendedPresses: totalPresses - activePresses,
        totalClients,
        totalOrders,
        totalJobs,
        totalUsers,
        totalTemplates,
        totalFonts,
        pendingCreditRequests,
        totalRevenue,
        totalCardholders,
        totalCreditsInSystem,
        newPressesThisMonth,
        newOrdersThisMonth,
      },
      monthlyRevenue,
      monthlyCards,
      topPresses,
      recentLogs,
      recentCreditRequests,
    });
  } catch (error) {
    console.error('SuperAdmin dashboard stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
