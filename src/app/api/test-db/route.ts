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

    let publicTemplateCount = -1;
    let publicTemplates: any[] = [];
    let isLatestColExists = false;
    try {
      userCount = await prisma.pressUser.count();
      pressCount = await prisma.press.count();

      // Check if is_latest column exists
      const colCheck: any[] = await prisma.$queryRaw`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'card_templates' AND column_name = 'is_latest'
      `;
      isLatestColExists = colCheck.length > 0;

      // Count & sample public templates
      publicTemplateCount = await prisma.cardTemplate.count({ where: { isPublic: true } });
      const samples = await prisma.cardTemplate.findMany({
        where: { isPublic: true },
        select: { id: true, name: true, pressId: true, isModerated: true, price: true },
        take: 10,
      });
      publicTemplates = samples;
    } catch (e: any) {
      queryError = e.message || String(e);
    }

    return NextResponse.json({
      success: true,
      message: 'Database query executed successfully',
      tableNames,
      userCount,
      pressCount,
      isLatestColExists,
      publicTemplateCount,
      publicTemplates,
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
