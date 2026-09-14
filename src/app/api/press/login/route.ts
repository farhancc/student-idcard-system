import { NextResponse } from 'next/server';
import { prisma, withSystemContext } from '@/lib/prisma';
import { verifyPassword, signUserToken } from '@/lib/auth';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { loginSchema } from '@/lib/schemas';
import { writeAuditLog, AuditActions } from '@/lib/audit-log';

export async function POST(request: Request) {
  // ── Rate limiting: 10 attempts per 15 minutes per IP ─────────────────────
  const ip = getClientIp(request);
  const rl = await rateLimit(`login:${ip}`, 10, 15 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many login attempts. Please wait before trying again.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) },
      }
    );
  }

  return withSystemContext(async () => {
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

    // Per-account limit as well as per-IP: where no trusted proxy header is
    // available getClientIp() returns a shared bucket, and an attacker who can
    // spoof one would otherwise get unlimited attempts against a known account.
    const emailRl = await rateLimit(`login:email:${email.toLowerCase()}`, 10, 15 * 60 * 1000);
    if (!emailRl.allowed) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please wait before trying again.' },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil(emailRl.retryAfterMs / 1000)) },
        }
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
      void writeAuditLog({
        pressId: user.pressId,
        actorId: user.id,
        actorType: 'PRESS_USER',
        actorName: user.name,
        action: AuditActions.LOGIN_FAILED,
        category: 'SECURITY',
        description: `Failed login for ${email}`,
        ipAddress: ip,
        userAgent: request.headers.get('user-agent'),
        severity: 'WARN',
      });
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    void writeAuditLog({
      pressId: user.pressId,
      actorId: user.id,
      actorType: 'PRESS_USER',
      actorName: user.name,
      action: AuditActions.LOGIN_SUCCESS,
      category: 'SECURITY',
      description: `${user.name} signed in`,
      ipAddress: ip,
      userAgent: request.headers.get('user-agent'),
    });

    // Update last signed in timestamp
    try {
      await prisma.pressUser.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
    } catch (err) {
      console.warn('Could not update lastLoginAt for user:', err);
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
      maxAge: 60 * 60 * 24, // 24 hours — matches JWT expiration
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
  });
}
