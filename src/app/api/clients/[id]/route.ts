import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { updateClientSchema } from '@/lib/schemas';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const pressIdStr = request.headers.get('x-press-id');
    if (!pressIdStr) {
      return NextResponse.json({ error: 'Missing Press ID' }, { status: 400 });
    }
    const pressId = Number(pressIdStr);
    const { id } = await params;
    const clientId = Number(id);

    const client = await prisma.client.findFirst({
      where: { id: clientId, pressId },
    });

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, client });
  } catch (error) {
    console.error('Get client error:', error);
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
      return NextResponse.json({ error: 'Missing Press ID' }, { status: 400 });
    }
    const pressId = Number(pressIdStr);
    const { id } = await params;
    const clientId = Number(id);

    const body = await request.json();
    const result = updateClientSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
    }

    const { name, type, contactName, contactPhone, contactEmail, address } = result.data;

    const client = await prisma.client.findFirst({
      where: { id: clientId, pressId },
    });

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const updatedClient = await prisma.client.update({
      where: { id: clientId },
      data: {
        name: name !== undefined ? name : client.name,
        type: type !== undefined ? type : client.type,
        contactName: contactName !== undefined ? contactName : client.contactName,
        contactPhone: contactPhone !== undefined ? contactPhone : client.contactPhone,
        contactEmail: contactEmail !== undefined ? contactEmail : client.contactEmail,
        address: address !== undefined ? address : client.address,
      },
    });

    return NextResponse.json({ success: true, client: updatedClient });
  } catch (error) {
    console.error('Update client error:', error);
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
      return NextResponse.json({ error: 'Missing Press ID' }, { status: 400 });
    }
    const pressId = Number(pressIdStr);
    const { id } = await params;
    const clientId = Number(id);

    const client = await prisma.client.findFirst({
      where: { id: clientId, pressId },
    });

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Database cascade will handle cardholders, orders, assets, serials, and pdf jobs.
    // If you were deleting physical files from S3/Vercel Blob, you would fetch and delete them here.
    await prisma.client.delete({
      where: { id: clientId },
    });

    return NextResponse.json({
      success: true,
      message: 'Client and all associated data deleted successfully',
    });
  } catch (error) {
    console.error('Delete client error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
