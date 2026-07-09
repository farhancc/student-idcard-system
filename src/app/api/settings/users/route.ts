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
    const { name, email, password, role } = await request.json();

    if (!name || !email || !password || !role) {
      return NextResponse.json({ error: 'All fields (name, email, password, role) are required' }, { status: 400 });
    }

    if (role !== 'OPERATOR' && role !== 'DESIGNER' && role !== 'OWNER') {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

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
