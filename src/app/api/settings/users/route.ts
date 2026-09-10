import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const pressIdStr = request.headers.get('x-press-id');
    if (!pressIdStr) {
      return NextResponse.json({ error: 'Missing Press ID' }, { status: 401 });
    }
    const pressId = Number(pressIdStr);

    const users = await prisma.pressUser.findMany({
      where: { pressId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ success: true, users });
  } catch (error) {
    console.error('List staff users error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const pressIdStr = request.headers.get('x-press-id');
    const userRole = request.headers.get('x-user-role');
    
    if (!pressIdStr) {
      return NextResponse.json({ error: 'Missing Press ID' }, { status: 401 });
    }
    
    // Only OWNER can add staff users
    if (userRole !== 'OWNER') {
      return NextResponse.json({ error: 'Forbidden: Only the Press Owner can manage staff users' }, { status: 403 });
    }

    const pressId = Number(pressIdStr);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { createUserSchema } = await import('@/lib/schemas');
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return NextResponse.json(
        { error: issue?.message || 'Invalid input' },
        { status: 400 }
      );
    }

    const { name, email, password, role } = parsed.data;


    // Check if email already registered globally in press users
    const existingUser = await prisma.pressUser.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.pressUser.create({
      data: {
        pressId,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        passwordHash,
        role,
        active: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        createdAt: true,
      }
    });

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error('Create staff user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
