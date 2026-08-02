import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/superadmin/retention
 * Returns comprehensive customer retention metrics for the SuperAdmin dashboard:
 *  - Monthly cohort retention (presses by join month vs still-active months later)
 *  - Per-press engagement: last login, last order, total orders, churn risk score
 *  - Platform-wide stats: active/inactive presses, avg order frequency, returning clients
 *  - Monthly new vs churned presses (30-day inactivity = churned)
 *  - Order frequency distribution
 */
export async function GET() {
  try {
    const now = new Date();

    // ── 1. Fetch all presses with full activity data ──────────────────────────
    const presses = await prisma.press.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        plan: true,
        isActive: true,
        createdAt: true,
        users: {
          select: { lastLoginAt: true },
          orderBy: { lastLoginAt: 'desc' },
          take: 1,
        },
        orders: {
          select: { createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: { clients: true, orders: true, jobs: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // ── 2. Per-press engagement & churn risk ─────────────────────────────────
    const CHURN_DAYS = 30; // no order / login in 30 days = at-risk
    const CHURNED_DAYS = 90; // no activity in 90 days = churned

    const pressMetrics = presses.map(p => {
      const lastLoginAt = p.users[0]?.lastLoginAt ?? null;
      const lastOrderAt = p.orders[0]?.createdAt ?? null;

      // Last activity = most recent of login or order
      const lastActivityAt = (() => {
        if (!lastLoginAt && !lastOrderAt) return null;
        if (!lastLoginAt) return lastOrderAt;
        if (!lastOrderAt) return lastLoginAt;
        return lastLoginAt > lastOrderAt ? lastLoginAt : lastOrderAt;
      })();

      const daysSinceActivity = lastActivityAt
        ? Math.floor((now.getTime() - new Date(lastActivityAt).getTime()) / 86400000)
        : null;

      const daysSinceJoined = Math.floor(
        (now.getTime() - new Date(p.createdAt).getTime()) / 86400000
      );

      // Churn risk score 0-100
      let churnRisk = 0;
      if (daysSinceActivity === null) {
        churnRisk = daysSinceJoined > 7 ? 100 : 40; // Never logged in
      } else if (daysSinceActivity >= CHURNED_DAYS) {
        churnRisk = 100;
      } else if (daysSinceActivity >= CHURN_DAYS) {
        churnRisk = Math.round(60 + (daysSinceActivity - CHURN_DAYS) / (CHURNED_DAYS - CHURN_DAYS) * 40);
      } else {
        churnRisk = Math.round((daysSinceActivity / CHURN_DAYS) * 60);
      }

      const status: 'active' | 'at_risk' | 'churned' =
        churnRisk >= 80 ? 'churned' :
        churnRisk >= 40 ? 'at_risk' :
        'active';

      // Order frequency (orders per month since joining, floored to 1 month)
      const monthsActive = Math.max(1, daysSinceJoined / 30);
      const ordersPerMonth = parseFloat((p._count.orders / monthsActive).toFixed(2));

      return {
        id: p.id,
        name: p.name,
        email: p.email,
        plan: p.plan,
        isActive: p.isActive,
        createdAt: p.createdAt,
        lastLoginAt,
        lastOrderAt,
        lastActivityAt,
        daysSinceActivity,
        daysSinceJoined,
        totalOrders: p._count.orders,
        totalClients: p._count.clients,
        totalJobs: p._count.jobs,
        ordersPerMonth,
        churnRisk,
        status,
      };
    });

    // ── 3. Platform-wide summary ─────────────────────────────────────────────
    const totalPresses = pressMetrics.length;
    const activePresses = pressMetrics.filter(p => p.status === 'active').length;
    const atRiskPresses = pressMetrics.filter(p => p.status === 'at_risk').length;
    const churnedPresses = pressMetrics.filter(p => p.status === 'churned').length;

    const avgOrdersPerMonth = totalPresses > 0
      ? parseFloat((pressMetrics.reduce((s, p) => s + p.ordersPerMonth, 0) / totalPresses).toFixed(2))
      : 0;

    const retentionRate = totalPresses > 0
      ? parseFloat(((activePresses / totalPresses) * 100).toFixed(1))
      : 0;

    // ── 4. Monthly new presses & cohort data (last 12 months) ────────────────
    const monthlyData: Record<string, {
      month: string;
      newPresses: number;
      activeCount: number;
      atRiskCount: number;
      churnedCount: number;
      orders: number;
    }> = {};

    // Build 12-month buckets
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
      monthlyData[key] = { month: label, newPresses: 0, activeCount: 0, atRiskCount: 0, churnedCount: 0, orders: 0 };
    }

    pressMetrics.forEach(p => {
      const key = `${new Date(p.createdAt).getFullYear()}-${String(new Date(p.createdAt).getMonth() + 1).padStart(2, '0')}`;
      if (monthlyData[key]) {
        monthlyData[key].newPresses++;
        if (p.status === 'active') monthlyData[key].activeCount++;
        else if (p.status === 'at_risk') monthlyData[key].atRiskCount++;
        else monthlyData[key].churnedCount++;
        monthlyData[key].orders += p.totalOrders;
      }
    });

    // ── 5. Monthly orders across all presses (last 12 months) ───────────────
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const recentOrders = await prisma.cardOrder.findMany({
      where: { createdAt: { gte: twelveMonthsAgo } },
      select: { createdAt: true, pressId: true },
    });

    const monthlyOrders: Record<string, number> = {};
    recentOrders.forEach(o => {
      const key = `${new Date(o.createdAt).getFullYear()}-${String(new Date(o.createdAt).getMonth() + 1).padStart(2, '0')}`;
      monthlyOrders[key] = (monthlyOrders[key] || 0) + 1;
    });

    const monthlyTimeline = Object.entries(monthlyData).map(([key, val]) => ({
      ...val,
      orders: monthlyOrders[key] || 0,
    }));

    // ── 6. Order frequency distribution ──────────────────────────────────────
    const freqBuckets = { '0 orders': 0, '1-3': 0, '4-10': 0, '11-30': 0, '30+': 0 };
    pressMetrics.forEach(p => {
      const n = p.totalOrders;
      if (n === 0) freqBuckets['0 orders']++;
      else if (n <= 3) freqBuckets['1-3']++;
      else if (n <= 10) freqBuckets['4-10']++;
      else if (n <= 30) freqBuckets['11-30']++;
      else freqBuckets['30+']++;
    });

    // ── 7. Plan distribution with retention ──────────────────────────────────
    const planStats: Record<string, { total: number; active: number; atRisk: number; churned: number }> = {};
    pressMetrics.forEach(p => {
      if (!planStats[p.plan]) planStats[p.plan] = { total: 0, active: 0, atRisk: 0, churned: 0 };
      planStats[p.plan].total++;
      if (p.status === 'active') planStats[p.plan].active++;
      else if (p.status === 'at_risk') planStats[p.plan].atRisk++;
      else planStats[p.plan].churned++;
    });

    // ── 8. Top retained & top at-risk presses ────────────────────────────────
    const sortedByRisk = [...pressMetrics].sort((a, b) => b.churnRisk - a.churnRisk);
    const topAtRisk = sortedByRisk.slice(0, 10);
    const topRetained = [...pressMetrics]
      .filter(p => p.totalOrders > 0)
      .sort((a, b) => b.ordersPerMonth - a.ordersPerMonth)
      .slice(0, 10);

    return NextResponse.json({
      success: true,
      summary: {
        totalPresses,
        activePresses,
        atRiskPresses,
        churnedPresses,
        retentionRate,
        avgOrdersPerMonth,
      },
      pressMetrics,
      monthlyTimeline,
      freqDistribution: Object.entries(freqBuckets).map(([label, count]) => ({ label, count })),
      planStats: Object.entries(planStats).map(([plan, stats]) => ({ plan, ...stats })),
      topAtRisk,
      topRetained,
    });
  } catch (error: any) {
    console.error('Retention analytics error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
