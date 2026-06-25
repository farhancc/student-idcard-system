import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const pressIdStr = request.headers.get('x-press-id');
    if (!pressIdStr) {
      return NextResponse.json({ error: 'Missing Press ID' }, { status: 401 });
    }
    const pressId = Number(pressIdStr);
    const { id } = await params;
    const vendorId = Number(id);

    const vendor = await prisma.printVendor.findFirst({
      where: { id: vendorId, pressId },
    });

    if (!vendor) {
      return NextResponse.json({ error: 'Print vendor not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, vendor });
  } catch (error) {
    console.error('Get print vendor error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const pressIdStr = request.headers.get('x-press-id');
    if (!pressIdStr) {
      return NextResponse.json({ error: 'Missing Press ID' }, { status: 401 });
    }
    const pressId = Number(pressIdStr);
    const { id } = await params;
    const vendorId = Number(id);

    const vendor = await prisma.printVendor.findFirst({
      where: { id: vendorId, pressId },
    });

    if (!vendor) {
      return NextResponse.json({ error: 'Print vendor not found' }, { status: 404 });
    }

    const { name, phone, email, city, notes } = await request.json();

    const updated = await prisma.printVendor.update({
      where: { id: vendorId },
      data: {
        name: name !== undefined ? name.trim() : vendor.name,
        phone: phone !== undefined ? phone : vendor.phone,
        email: email !== undefined ? email : vendor.email,
        city: city !== undefined ? city : vendor.city,
        notes: notes !== undefined ? notes : vendor.notes,
      },
    });

    return NextResponse.json({ success: true, vendor: updated });
  } catch (error) {
    console.error('Update print vendor error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const pressIdStr = request.headers.get('x-press-id');
    if (!pressIdStr) {
      return NextResponse.json({ error: 'Missing Press ID' }, { status: 401 });
    }
    const pressId = Number(pressIdStr);
    const { id } = await params;
    const vendorId = Number(id);

    const vendor = await prisma.printVendor.findFirst({
      where: { id: vendorId, pressId },
    });

    if (!vendor) {
      return NextResponse.json({ error: 'Print vendor not found' }, { status: 404 });
    }

    await prisma.printVendor.delete({
      where: { id: vendorId },
    });

    return NextResponse.json({ success: true, message: 'Print vendor deleted successfully' });
  } catch (error) {
    console.error('Delete print vendor error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
