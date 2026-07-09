import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCreditSettings } from '@/lib/system-settings';

export async function GET() {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    // ── Helper: build empty 6-month keys ──────────────────────────
    const buildMonthKeys = (): string[] => {
      const keys: string[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      }
      return keys;
    };
    const monthKeys = buildMonthKeys();
    const emptyMonths = (): Record<string, number> =>
      Object.fromEntries(monthKeys.map((k) => [k, 0]));

    // Fetch credit settings for plan rate calculations
    const creditSettings = await getCreditSettings();
    const rateMap: Record<string, number> = {
      BASIC: creditSettings.priceCreditBasic,
      PRO: creditSettings.priceCreditPro,
      ENTERPRISE: creditSettings.priceCreditEnterprise,
    };

    // ── Platform-wide KPIs (parallel) ────────────────────────────
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
      creditAgg,
      recentLogs,
      recentCreditRequests,
      allTimeCreditsByPress,
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
      prisma.press.aggregate({ _sum: { credits: true } }),
      (prisma as any).systemAuditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true, action: true, category: true, severity: true,
          createdAt: true, description: true, actorName: true,
        },
      }),
      prisma.creditRequest.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { press: { select: { name: true, credits: true } } },
      }),
      prisma.pdfJob.groupBy({
        by: ['pressId'],
        where: { creditsLocked: { gt: 0 } },
        _sum: { creditsLocked: true },
      }),
    ]);

    // Create a map for all-time credit usage per press
    const allTimeCreditsMap = new Map<number, number>(
      allTimeCreditsByPress.map(item => [item.pressId, item._sum.creditsLocked ?? 0])
    );

    // ── All PdfJobs with creditsLocked > 0 in last 6 months (credit usage trend) ──
    const recentJobs = await prisma.pdfJob.findMany({
      where: { creditsLocked: { gt: 0 }, generatedAt: { gte: sixMonthsAgo } },
      select: { pressId: true, creditsLocked: true, generatedAt: true },
    });

    // ── All OrderCardholders in last 6 months (cards per press) ──
    const recentOrderCards = await prisma.orderCardholder.findMany({
      where: { addedAt: { gte: sixMonthsAgo } },
      select: {
        addedAt: true,
        order: { select: { pressId: true } },
      },
    });

    // ── All presses (for per-press breakdown) ─────────────────────
    const allPresses = await prisma.press.findMany({
      select: { id: true, name: true, plan: true, isActive: true, credits: true },
    });

    // ── Build per-press stats ─────────────────────────────────────
    interface PressStat {
      id: number;
      name: string;
      plan: string;
      isActive: boolean;
      currentCredits: number;
      creditsUsed: number;
      cards: number;
      revenue: number;
      monthlyCredits: Record<string, number>;
      monthlyCards: Record<string, number>;
      monthlyRevenue: Record<string, number>;
    }

    const pressMap: Map<number, PressStat> = new Map(
      allPresses.map((p) => [
        p.id,
        {
          id: p.id,
          name: p.name,
          plan: p.plan,
          isActive: p.isActive,
          currentCredits: p.credits,
          creditsUsed: allTimeCreditsMap.get(p.id) || 0, // All-time credits used
          cards: 0,
          revenue: 0, // calculated from creditsUsed * rate
          monthlyCredits: emptyMonths(),
          monthlyCards: emptyMonths(),
          monthlyRevenue: emptyMonths(), // calculated from monthlyCredits * rate
        },
      ])
    );

    // Monthly credits used (last 6 months)
    recentJobs.forEach((job) => {
      const stat = pressMap.get(job.pressId);
      if (!stat) return;
      const d = new Date(job.generatedAt);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (k in stat.monthlyCredits) stat.monthlyCredits[k] += job.creditsLocked;
    });

    // Cards per press (last 6 months)
    recentOrderCards.forEach((oc) => {
      const pressId = oc.order?.pressId;
      if (!pressId) return;
      const stat = pressMap.get(pressId);
      if (!stat) return;
      stat.cards += 1;
      const d = new Date(oc.addedAt);
      const kFixed = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (kFixed in stat.monthlyCards) stat.monthlyCards[kFixed] += 1;
    });

    // Calculate calculated revenue (all-time + monthly) using settings rate map
    pressMap.forEach((stat) => {
      const rate = rateMap[stat.plan] || rateMap.BASIC;
      stat.revenue = stat.creditsUsed * rate;
      Object.keys(stat.monthlyCredits).forEach((k) => {
        stat.monthlyRevenue[k] = stat.monthlyCredits[k] * rate;
      });
    });

    const pressStats = Array.from(pressMap.values());

    // Top 5 by cards
    const topPresses = [...pressStats]
      .sort((a, b) => b.cards - a.cards)
      .slice(0, 5);

    // ── Platform monthly aggregates (all presses combined) ────────
    const platformMonthlyRevenue = emptyMonths();
    const platformMonthlyCards = emptyMonths();
    const platformMonthlyCredits = emptyMonths();

    recentOrderCards.forEach((oc) => {
      const d = new Date(oc.addedAt);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (k in platformMonthlyCards) platformMonthlyCards[k] += 1;
    });
    recentJobs.forEach((job) => {
      const d = new Date(job.generatedAt);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (k in platformMonthlyCredits) platformMonthlyCredits[k] += job.creditsLocked;
    });

    // Calculate platform monthly revenue based on rates of individual presses that used them
    pressStats.forEach((p) => {
      Object.keys(p.monthlyRevenue).forEach((k) => {
        platformMonthlyRevenue[k] += p.monthlyRevenue[k];
      });
    });

    // Total platform-wide calculated revenue
    const totalRevenue = pressStats.reduce((s, p) => s + p.revenue, 0);

    // Total credits used across system (sum of creditsLocked on all jobs ever)
    const allTimeJobs = await prisma.pdfJob.aggregate({ _sum: { creditsLocked: true } });
    const totalCreditsUsed = allTimeJobs._sum.creditsLocked ?? 0;
    const totalCreditsInSystem = creditAgg._sum.credits ?? 0;

    return NextResponse.json({
      success: true,
      kpis: {
        totalPresses, activePresses,
        suspendedPresses: totalPresses - activePresses,
        totalClients, totalOrders, totalJobs, totalUsers,
        totalTemplates, totalFonts, pendingCreditRequests,
        totalRevenue, totalCardholders,
        totalCreditsInSystem, totalCreditsUsed,
        newPressesThisMonth, newOrdersThisMonth,
      },
      monthKeys,
      monthlyRevenue: platformMonthlyRevenue,
      monthlyCards: platformMonthlyCards,
      monthlyCredits: platformMonthlyCredits,
      topPresses,
      pressStats,       // full per-press breakdown
      recentLogs,
      recentCreditRequests,
    });
  } catch (error) {
    console.error('SuperAdmin dashboard stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
