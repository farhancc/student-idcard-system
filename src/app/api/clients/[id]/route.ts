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

    // 1. Fetch all assets linked to this client before database deletion
    const cardholders = await prisma.cardholder.findMany({
      where: { clientId },
      select: { photoUrl: true }
    });

    const templates = await prisma.cardTemplate.findMany({
      where: { clientId },
      select: { frontImageUrl: true, backImageUrl: true, frontOriginalUrl: true, backOriginalUrl: true }
    });

    const pdfJobs = await prisma.pdfJob.findMany({
      where: { order: { clientId } },
      select: { downloadUrl: true }
    });

    // 2. Extract and delete Cloudinary assets if configured
    if (isCloudinaryConfigured) {
      const resourcesToDelete: { publicId: string; resourceType: 'image' | 'raw' }[] = [];

      cardholders.forEach(ch => {
        const res = getCloudinaryResource(ch.photoUrl);
        if (res) resourcesToDelete.push(res);
      });

      templates.forEach(t => {
        const r1 = getCloudinaryResource(t.frontImageUrl);
        if (r1) resourcesToDelete.push(r1);
        const r2 = getCloudinaryResource(t.backImageUrl);
        if (r2) resourcesToDelete.push(r2);
        const r3 = getCloudinaryResource(t.frontOriginalUrl);
        if (r3) resourcesToDelete.push(r3);
        const r4 = getCloudinaryResource(t.backOriginalUrl);
        if (r4) resourcesToDelete.push(r4);
      });

      pdfJobs.forEach(job => {
        const res = getCloudinaryResource(job.downloadUrl);
        if (res) resourcesToDelete.push(res);
      });

      // Deduplicate resources to prevent multiple API hits for the same file
      const uniqueResources = Array.from(new Set(resourcesToDelete.map(r => JSON.stringify(r))))
        .map(str => JSON.parse(str) as { publicId: string; resourceType: 'image' | 'raw' });

      // Run deletions in parallel, ignoring individual failures
      await Promise.all(
        uniqueResources.map(async (res) => {
          try {
            await cloudinary.uploader.destroy(res.publicId, { resource_type: res.resourceType });
          } catch (err) {
            console.error(`Failed to delete Cloudinary resource: ${res.publicId}`, err);
          }
        })
      );
    }

    // 3. Database cascade will handle cardholders, orders, assets, serials, and pdf jobs.
    await prisma.client.delete({
      where: { id: clientId },
    });

    return NextResponse.json({
      success: true,
      message: 'Client and all associated database records and Cloudinary assets deleted permanently',
    });
  } catch (error) {
    console.error('Delete client error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
