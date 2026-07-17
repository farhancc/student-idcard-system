import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Query table names in the database
    const tables: any = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    const tableNames = tables.map((t: any) => t.table_name);

    // 2. Query press user count if table exists
    let userCount = -1;
    let pressCount = -1;
    let queryError = null;

    try {
      userCount = await prisma.pressUser.count();
      pressCount = await prisma.press.count();
    } catch (e: any) {
      queryError = e.message || String(e);
    }

    return NextResponse.json({
      success: true,
      message: 'Database query executed successfully',
      tableNames,
      userCount,
      pressCount,
      queryError,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: 'Database diagnostic query failed',
      error: error.message || String(error),
      stack: error.stack,
    }, { status: 500 });
  }
}
