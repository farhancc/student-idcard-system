import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export async function GET() {
  try {
    const presses = await prisma.press.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        city: true,
      },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json({ success: true, presses });
  } catch (error) {
    console.error('Fetch presses error:', error);
    return NextResponse.json({ error: 'Failed to fetch presses' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { pressId, name, type, contactName, contactPhone, contactEmail, address } = await request.json();

    if (!pressId || !name || !type) {
      return NextResponse.json({ error: 'Press, Organization Name, and Type are required' }, { status: 400 });
    }

    const press = await prisma.press.findUnique({
      where: { id: Number(pressId) },
    });

    if (!press) {
      return NextResponse.json({ error: 'Selected Printing Press not found' }, { status: 404 });
    }

    // Create the Client
    const client = await prisma.client.create({
      data: {
        pressId: Number(pressId),
        name,
        type,
        contactName,
        contactPhone,
        contactEmail,
        address,
      },
    });

    // Find first template of the press
    let template = await prisma.cardTemplate.findFirst({
      where: { pressId: Number(pressId), isLatest: true },
    });

    if (!template) {
      template = await prisma.cardTemplate.findFirst({
        where: { pressId: Number(pressId) },
      });
    }

    let templateId = template?.id;

    if (!templateId) {
      // Create a default layout/template if none exists
      const newTemplate = await prisma.cardTemplate.create({
        data: {
          pressId: Number(pressId),
          name: 'Default ID Template',
          cardWidth: 1011,
          cardHeight: 638,
          frontImageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1000',
          frontFields: '[]',
          backFields: '[]',
          version: 1,
          isLatest: true,
        },
      });
      templateId = newTemplate.id;
    }

    // Generate tokens
    const orgToken = crypto.randomUUID();
    const enrollToken = crypto.randomUUID();

    // Create Client Portal Share link
    const share = await prisma.clientPortalShare.create({
      data: {
        pressId: Number(pressId),
        clientId: client.id,
        templateId,
        orgToken,
        enrollToken,
      },
    });

    return NextResponse.json({
      success: true,
      orgToken,
      clientId: client.id,
    });
  } catch (error: any) {
    console.error('Client signup error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
