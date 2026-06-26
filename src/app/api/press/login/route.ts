import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword, signUserToken } from '@/lib/auth';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { loginSchema } from '@/lib/schemas';

export async function POST(request: Request) {
  // ── Rate limiting: 10 attempts per 15 minutes per IP ─────────────────────
  const ip = getClientIp(request);
  const rl = rateLimit(`login:${ip}`, 10, 15 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many login attempts. Please wait before trying again.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) },
      }
    );
  }

  try {
    // ── Input validation ────────────────────────────────────────────────────
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Invalid input';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { email, password } = parsed.data;

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
      maxAge: 60 * 60 * 24 * 30, // 30 days
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
