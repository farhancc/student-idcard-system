import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword, signUserToken } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and Password are required' },
        { status: 400 }
      );
    }

    const user = await prisma.pressUser.findUnique({
      where: { email },
      include: { press: true },
    });

    if (!user || !user.active) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    if (!user.press.isActive) {
      return NextResponse.json(
        { error: 'Press account is suspended. Contact support.' },
        { status: 403 }
      );
    }

    const isMatch = await verifyPassword(password, user.passwordHash);
    if (!isMatch) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Generate JWT
    const token = await signUserToken({
      userId: user.id,
      pressId: user.pressId,
      email: user.email,
      role: user.role as 'OWNER' | 'OPERATOR' | 'DESIGNER',
      name: user.name,
    });

    const response = NextResponse.json({
      success: true,
      message: 'Logged in successfully',
      role: user.role,
      pressName: user.press.name,
    });

    // Set cookie
    response.cookies.set({
      name: 'press_auth_token',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error during login' },
      { status: 500 }
    );
  }
}
