import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSession, verifyToken } from '@/lib/auth';
import { revokeToken } from '@/lib/token-blocklist';

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get('press_auth_token')?.value;

  if (token) {
    const payload = await verifyToken(token);
    if (payload?.jti) {
      await revokeToken(payload.jti);
    }
  }

  const response = NextResponse.json({
    success: true,
    message: 'Logged out successfully',
  });

  // Clear cookie by setting expiration in the past
  response.cookies.set({
    name: 'press_auth_token',
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });

  return response;
}
