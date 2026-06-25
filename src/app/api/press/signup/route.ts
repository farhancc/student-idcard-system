import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { pressName, ownerName, email, password, phone, city } = await request.json();

    if (!pressName || !ownerName || !email || !password || !phone) {
      return NextResponse.json(
        { error: 'Press Name, Owner Name, Email, Mobile Number, and Password are required' },
        { status: 400 }
      );
    }

    // Check if email already exists in press users
    const existingUser = await prisma.pressUser.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 400 }
      );
    }

    // Set trial expiration to 14 days from now
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    const passwordHash = await hashPassword(password);

    // Create Press and Owner user in a single transaction
    const result = await prisma.$transaction(async (tx) => {
      const press = await tx.press.create({
        data: {
          name: pressName,
          email,
          phone,
          city,
          plan: 'BASIC',
          isActive: true,
          credits: 200,
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
      message: 'Press registered successfully',
      pressId: result.press.id,
      userId: result.user.id,
    });
  } catch (error: any) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Internal server error during registration' },
      { status: 500 }
    );
  }
}
