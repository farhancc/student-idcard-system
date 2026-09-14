import { NextResponse } from 'next/server';
import { requireActor } from '@/lib/authz';
import { prisma, basePrisma } from '@/lib/prisma';
import { updateClientSchema } from '@/lib/schemas';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireActor(request);
    if ('response' in auth) return auth.response;
    const { pressId } = auth.actor;
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
    const auth = requireActor(request);
    if ('response' in auth) return auth.response;
    const { pressId } = auth.actor;
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

import { v2 as cloudinary } from 'cloudinary';

const isCloudinaryConfigured =
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET;

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

function getCloudinaryResource(url: string | null): { publicId: string; resourceType: 'image' | 'raw' } | null {
  if (!url || !url.includes('cloudinary.com')) return null;
  try {
    let uploadMarker = '/upload/';
    let markerIndex = url.indexOf(uploadMarker);
    let resourceType: 'image' | 'raw' = 'image';
    if (markerIndex === -1) {
      uploadMarker = '/raw/upload/';
      markerIndex = url.indexOf(uploadMarker);
      resourceType = 'raw';
    }
    if (markerIndex === -1) return null;

    let path = url.substring(markerIndex + uploadMarker.length);
    const versionMatch = path.match(/^v\d+\//);
    if (versionMatch) {
      path = path.substring(versionMatch[0].length);
    }
    const dotIndex = path.lastIndexOf('.');
    if (dotIndex !== -1) {
      path = path.substring(0, dotIndex);
    }
    return {
      publicId: decodeURIComponent(path),
      resourceType
    };
  } catch (e) {
    console.error('Error parsing Cloudinary URL:', url, e);
    return null;
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireActor(request);
    if ('response' in auth) return auth.response;
    const { pressId } = auth.actor;
    const { id } = await params;
    const clientId = Number(id);

    const client = await prisma.client.findFirst({
      where: { id: clientId, pressId, deletedAt: null },
    });

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const now = new Date();

    // Soft-delete: mark client, its cardholders, and its orders as deleted.
    // Financial records (invoices), delivery records, and audit logs are preserved.
    await basePrisma.$transaction([
      basePrisma.client.update({
        where: { id: clientId },
        data: { deletedAt: now },
      }),
      basePrisma.cardholder.updateMany({
        where: { clientId, deletedAt: null },
        data: { deletedAt: now, active: false },
      }),
      basePrisma.cardOrder.updateMany({
        where: { clientId, pressId, deletedAt: null },
        data: { deletedAt: now },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: 'Client archived successfully. Financial records and order history are preserved.',
    });
  } catch (error) {
    console.error('Archive client error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
