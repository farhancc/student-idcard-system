import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const clients = await prisma.client.findMany({
      include: {
        press: true,
        orders: {
          include: {
            invoice: true,
          }
        }
      },
      orderBy: { name: 'asc' },
    });

    const clientAnalytics = clients.map(client => {
      let totalCards = 0;
      let totalRevenue = 0;
      const revenueByMonth: Record<string, number> = {};

      client.orders.forEach(order => {
        let count = 0;
        try {
          const ids = JSON.parse(order.cardholderIds || '[]');
          count = Array.isArray(ids) ? ids.length : 0;
        } catch {
          count = 0;
        }
        totalCards += count;

        if (order.invoice) {
          const amount = Number(order.invoice.totalAmount);
          totalRevenue += amount;

          const date = new Date(order.invoice.createdAt);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          revenueByMonth[monthKey] = (revenueByMonth[monthKey] || 0) + amount;
        }
      });

      return {
        id: client.id,
        name: client.name,
        pressName: client.press?.name || 'Unknown Press',
        contactName: client.contactName,
        contactEmail: client.contactEmail,
        totalCards,
        totalRevenue,
        revenueByMonth,
      };
    });

    return NextResponse.json({ success: true, clientAnalytics });
  } catch (error) {
    console.error('SuperAdmin get analytics error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
