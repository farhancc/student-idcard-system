import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/superadmin/audit-logs?page=1&limit=50&category=SECURITY&severity=&search=
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const limit = Math.min(100, Number(searchParams.get('limit') || 50));
    const category = searchParams.get('category') || '';
    const severity = searchParams.get('severity') || '';
    const action = searchParams.get('action') || '';
    const search = searchParams.get('search') || '';

    const where: any = {};

    if (category) where.category = category;
    if (severity) where.severity = severity;
    if (action) where.action = action;
    if (search) {
      where.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { actorName: { contains: search, mode: 'insensitive' } },
        { action: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [logs, total] = await Promise.all([
      (prisma as any).systemAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      (prisma as any).systemAuditLog.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      logs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    console.error('Superadmin audit log fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
