import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const requests = await prisma.creditRequest.findMany({
      include: {
        press: {
          select: {
            id: true,
            name: true,
            email: true,
            credits: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, requests });
  } catch (error) {
    console.error('List superadmin credit requests error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const requestId = Number(body.requestId);
    const status = body.status; // 'APPROVED' | 'REJECTED'
    const adminNotes = body.adminNotes?.trim() || null;

    if (!requestId || !status || (status !== 'APPROVED' && status !== 'REJECTED')) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch and lock the credit request
      const dbRequests = await tx.$queryRaw<any[]>`
        SELECT id, press_id AS "pressId", amount, status
        FROM "credit_requests"
        WHERE id = ${requestId}
        FOR UPDATE
      `;
      const dbRequest = dbRequests[0];

      if (!dbRequest) {
        throw new Error('Credit request not found');
      }

      if (dbRequest.status !== 'PENDING') {
        throw new Error('This request has already been processed');
      }

      const pressId = dbRequest.pressId;

      // 2. Fetch/Lock the associated press if approved
      if (status === 'APPROVED') {
        await tx.$queryRaw`
          SELECT id FROM "press" WHERE id = ${pressId} FOR UPDATE
        `;

        // Update press credits
        await tx.press.update({
          where: { id: pressId },
          data: {
            credits: {
              increment: dbRequest.amount,
            },
          },
        });
      }

      // 3. Update the request status
      const updatedRequest = await tx.creditRequest.update({
        where: { id: requestId },
        data: {
          status,
          adminNotes,
        },
        include: {
          press: {
            select: {
              id: true,
              name: true,
              email: true,
              credits: true,
            },
          },
        },
      });

      return updatedRequest;
    });

    return NextResponse.json({
      success: true,
      message: `Credit request was successfully ${status.toLowerCase()}`,
      request: result,
    });
  } catch (error: any) {
    console.error('Process credit request error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
