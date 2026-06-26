import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
  };

  try {
    // Dynamically import prisma to avoid module-level engine load failures
    const { prisma } = await import('@/lib/prisma');
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json(
      { status: 'ok', timestamp: new Date().toISOString(), database: 'connected', uptime: process.uptime() },
      { headers: corsHeaders },
    );
  } catch (error) {
    console.error('Health check database error:', error);
    // Still return 200 so Electron knows the server is reachable even if DB is slow
    return NextResponse.json(
      { status: 'degraded', timestamp: new Date().toISOString(), database: 'disconnected', error: error instanceof Error ? error.message : 'Unknown' },
      { status: 200, headers: corsHeaders },
    );
  }
}



