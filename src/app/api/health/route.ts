import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const headers = {
    'Cache-Control': 'no-store, max-age=0',
  };

  try {
    const { prisma } = await import('@/lib/prisma');
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json(
      { status: 'ok', database: 'connected', timestamp: new Date().toISOString() },
      { status: 200, headers }
    );
  } catch (error: unknown) {
    console.error('Health check database error:', error);
    return NextResponse.json(
      { status: 'unhealthy', database: 'disconnected', error: 'Database connection failed' },
      { status: 503, headers }
    );
  }
}
