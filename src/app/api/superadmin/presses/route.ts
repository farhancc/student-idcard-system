import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';

export async function POST(request: Request) {
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

    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

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
          trialEndsAt,
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
  try {
    const presses = await prisma.press.findMany({
      include: {
        _count: {
          select: {
            users: true,
            clients: true,
            orders: true,
            jobs: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, presses });
  } catch (error) {
    console.error('SuperAdmin get presses error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
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
