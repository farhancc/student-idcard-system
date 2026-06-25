import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const pressIdStr = request.headers.get('x-press-id');
    if (!pressIdStr) {
      return NextResponse.json({ error: 'Missing Press ID' }, { status: 401 });
    }
    const pressId = Number(pressIdStr);

    const vendors = await prisma.printVendor.findMany({
      where: { pressId },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ success: true, vendors });
  } catch (error) {
    console.error('List print vendors error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const pressIdStr = request.headers.get('x-press-id');
    if (!pressIdStr) {
      return NextResponse.json({ error: 'Missing Press ID' }, { status: 401 });
    }
    const pressId = Number(pressIdStr);
    const { name, phone, email, city, notes } = await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Vendor name is required' }, { status: 400 });
    }

    const vendor = await prisma.printVendor.create({
      data: {
        pressId,
        name: name.trim(),
        phone,
        email,
        city,
        notes,
      },
    });

    return NextResponse.json({ success: true, vendor });
  } catch (error) {
    console.error('Create print vendor error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
