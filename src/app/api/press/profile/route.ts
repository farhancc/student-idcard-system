import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const press = await prisma.press.findUnique({
      where: { id: session.pressId },
    });

    if (!press) {
      return NextResponse.json({ error: 'Press not found' }, { status: 404 });
    }

    const lockedJobs = await prisma.pdfJob.aggregate({
      where: {
        pressId: press.id,
        isLocalJob: true,
        status: { in: ['PENDING', 'PROCESSING'] },
      },
      _sum: {
        creditsLocked: true,
      },
    });
    const lockedCredits = lockedJobs._sum.creditsLocked || 0;

    return NextResponse.json({
      success: true,
      user: {
        id: session.userId,
        name: session.name,
        email: session.email,
        role: session.role,
      },
      press: {
        id: press.id,
        name: press.name,
        email: press.email,
        phone: press.phone,
        city: press.city,
        plan: press.plan,
        credits: press.credits,
        lockedCredits,
        trialEndsAt: press.trialEndsAt,
        isActive: press.isActive,
      },
    });
  } catch (error) {
    console.error('Fetch profile error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, phone, city, ownerName } = await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Press name is required' }, { status: 400 });
    }
    if (!ownerName || !ownerName.trim()) {
      return NextResponse.json({ error: 'Owner name is required' }, { status: 400 });
    }

    // Update in transaction
    const result = await prisma.$transaction(async (tx) => {
      const updatedPress = await tx.press.update({
        where: { id: session.pressId },
        data: {
          name: name.trim(),
          phone: phone ? phone.trim() : null,
          city: city ? city.trim() : null,
        },
      });

      const updatedUser = await tx.pressUser.update({
        where: { id: session.userId },
        data: {
          name: ownerName.trim(),
        },
      });

      return { press: updatedPress, user: updatedUser };
    });

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      press: result.press,
      user: result.user,
    });
  } catch (error: any) {
    console.error('Update profile error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
