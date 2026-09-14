import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { requireSuperAdmin } from '@/lib/authz';

export async function POST(request: Request) {
  const auth = await requireSuperAdmin();
  if ('response' in auth) return auth.response;

  try {
    const { pressName, ownerName, email, password, phone, city, plan, credits } = await request.json();

    if (!pressName || !ownerName || !email || !password) {
      return NextResponse.json(
        { error: 'Press Name, Owner Name, Email, and Password are required' },
        { status: 400 }
      );
    }

    const existingUser = await prisma.pressUser.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(password);

    const result = await prisma.$transaction(async (tx) => {
      const press = await tx.press.create({
        data: {
          name: pressName,
          email,
          phone,
          city,
          plan: plan || 'BASIC',
          isActive: true,
          credits: credits !== undefined ? Number(credits) : 0,
          trialEndsAt: null,
        },
      });

      const user = await tx.pressUser.create({
        data: {
          pressId: press.id,
          name: ownerName,
          email,
          passwordHash,
          role: 'OWNER',
          active: true,
        },
      });

      return { press, user };
    });

    return NextResponse.json({
      success: true,
      message: 'Press onboarded successfully',
      press: {
        ...result.press,
        _count: {
          users: 1,
          clients: 0,
          orders: 0,
          jobs: 0
        }
      }
    });
  } catch (error) {
    console.error('SuperAdmin onboard press error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


export async function GET() {
  const auth = await requireSuperAdmin();
  if ('response' in auth) return auth.response;

  try {
    let presses;
    try {
      presses = await prisma.press.findMany({
        include: {
          users: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              active: true,
              lastLoginAt: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'asc' },
          },
          _count: {
            select: {
              users: true,
              clients: true,
              orders: true,
              jobs: true,
            },
          },
          clients: {
            select: {
              id: true,
              name: true,
              type: true,
              contactName: true,
              contactEmail: true,
              contactPhone: true,
              createdAt: true,
              orders: {
                select: {
                  id: true,
                  status: true,
                  createdAt: true,
                  invoice: { select: { totalAmount: true } },
                  _count: { select: { cardholders: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (innerError) {
      console.warn('Query with lastLoginAt failed, falling back to basic user fields:', innerError);
      presses = await prisma.press.findMany({
        include: {
          users: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              active: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'asc' },
          },
          _count: {
            select: {
              users: true,
              clients: true,
              orders: true,
              jobs: true,
            },
          },
          clients: {
            select: {
              id: true,
              name: true,
              type: true,
              contactName: true,
              contactEmail: true,
              contactPhone: true,
              createdAt: true,
              orders: {
                select: {
                  id: true,
                  status: true,
                  createdAt: true,
                  invoice: { select: { totalAmount: true } },
                  _count: { select: { cardholders: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    const pressIds = presses.map(p => p.id);

    // Batch counts with 4 groupBy queries instead of 4×N subqueries
    const [userCounts, clientCounts, orderCounts, jobCounts] = pressIds.length > 0 ? await Promise.all([
      prisma.pressUser.groupBy({ by: ['pressId'], where: { pressId: { in: pressIds } }, _count: { _all: true } }),
      prisma.client.groupBy({ by: ['pressId'], where: { pressId: { in: pressIds } }, _count: { _all: true } }),
      prisma.cardOrder.groupBy({ by: ['pressId'], where: { pressId: { in: pressIds } }, _count: { _all: true } }),
      prisma.pdfJob.groupBy({ by: ['pressId'], where: { pressId: { in: pressIds } }, _count: { _all: true } }),
    ]) : [[], [], [], []];

    const userCountMap = new Map(userCounts.map(u => [u.pressId, u._count._all]));
    const clientCountMap = new Map(clientCounts.map(c => [c.pressId, c._count._all]));
    const orderCountMap = new Map(orderCounts.map(o => [o.pressId, o._count._all]));
    const jobCountMap = new Map(jobCounts.map(j => [j.pressId, j._count._all]));

    // Aggregate per-press stats
    const pressesWithStats = presses.map(press => {
      let totalCardsPrinted = 0;
      let totalRevenue = 0;

      const clients = press.clients.map(client => {
        let clientCards = 0;
        let clientRevenue = 0;

        client.orders.forEach(order => {
          const cards = order._count?.cardholders || 0;
          clientCards += cards;
          totalCardsPrinted += cards;

          const amount = order.invoice ? Number(order.invoice.totalAmount) : 0;
          clientRevenue += amount;
          totalRevenue += amount;
        });

        return {
          id: client.id,
          name: client.name,
          type: client.type,
          contactName: client.contactName,
          contactEmail: client.contactEmail,
          contactPhone: client.contactPhone,
          createdAt: client.createdAt,
          totalOrders: client.orders.length,
          totalCards: clientCards,
          totalRevenue: clientRevenue,
        };
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { clients: _c, ...pressBase } = press as any;
      return {
        ...pressBase,
        _count: {
          users: userCountMap.get(press.id) || pressBase._count?.users || 0,
          clients: clientCountMap.get(press.id) || pressBase._count?.clients || 0,
          orders: orderCountMap.get(press.id) || pressBase._count?.orders || 0,
          jobs: jobCountMap.get(press.id) || pressBase._count?.jobs || 0,
        },
        totalCardsPrinted,
        totalRevenue,
        clients,
      };
    });

    return NextResponse.json({ success: true, presses: pressesWithStats });
  } catch (error) {
    console.error('SuperAdmin get presses error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const auth = await requireSuperAdmin();
  if ('response' in auth) return auth.response;

  try {
    const { pressId, plan, isActive, resetPassword, email } = await request.json();

    if (!pressId) {
      return NextResponse.json({ error: 'Press ID is required' }, { status: 400 });
    }

    const press = await prisma.press.findUnique({
      where: { id: Number(pressId) },
    });

    if (!press) {
      return NextResponse.json({ error: 'Press not found' }, { status: 404 });
    }

    // Update plan or active status
    const updateData: any = {};
    if (plan !== undefined) updateData.plan = plan;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updatedPress = await prisma.press.update({
      where: { id: Number(pressId) },
      data: updateData,
    });

    // Reset password if requested (resets OWNER password)
    if (resetPassword && email) {
      const owner = await prisma.pressUser.findFirst({
        where: { pressId: Number(pressId), role: 'OWNER' },
      });

      if (owner) {
        const passwordHash = await hashPassword(resetPassword);
        await prisma.pressUser.update({
          where: { id: owner.id },
          data: { passwordHash },
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Press updated successfully',
      press: updatedPress,
    });
  } catch (error) {
    console.error('SuperAdmin update press error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
