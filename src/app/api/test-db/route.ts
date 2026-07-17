import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const userCount = await prisma.pressUser.count();
    const pressCount = await prisma.press.count();
    return NextResponse.json({
      success: true,
      message: 'Database query executed successfully',
      userCount,
      pressCount,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: 'Database query failed',
      error: error.message || String(error),
      stack: error.stack,
    }, { status: 500 });
  }
}
