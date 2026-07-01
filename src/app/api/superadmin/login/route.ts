import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword, signSuperAdminToken } from '@/lib/auth';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export async function POST(request: Request) {
  // ── Rate limiting: 10 attempts per 15 minutes per IP ─────────────────────
  const ip = getClientIp(request);
  const rl = await rateLimit(`admin_login:${ip}`, 10, 15 * 60 * 1000);
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
    const { email, password } = await request.json();


    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and Password are required' },
        { status: 400 }
      );
    }

    const admin = await prisma.superAdmin.findUnique({
      where: { email },
    });

    if (!admin) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    const isMatch = await verifyPassword(password, admin.passwordHash);
    if (!isMatch) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Generate Super Admin JWT
    const token = await signSuperAdminToken({
      adminId: admin.id,
      email: admin.email,
      name: admin.name,
      isSuperAdmin: true,
    });

    const response = NextResponse.json({
      success: true,
      message: 'Logged in as Super Admin successfully',
      name: admin.name,
    });

    // Set cookie
    response.cookies.set({
      name: 'super_auth_token',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 12, // 12 hours
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Superadmin login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
