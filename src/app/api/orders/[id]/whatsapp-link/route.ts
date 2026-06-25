import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
    const orderId = Number(id);

    // 1. Fetch order with client details
    const order = await prisma.cardOrder.findFirst({
      where: { id: orderId, pressId },
      include: { client: true },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const clientPhone = order.client.contactPhone;
    if (!clientPhone) {
      return NextResponse.json({
        error: 'Client does not have a contact phone number configured. Please add it first.',
      }, { status: 400 });
    }

    // Sanitize phone number (strip whitespace, dashes, plus sign)
    const sanitizedPhone = clientPhone.replace(/\D/g, '');

    // 2. Fetch latest completed approval PDF job
    const job = await prisma.pdfJob.findFirst({
      where: { orderId, pressId, pdfType: 'APPROVAL', status: 'COMPLETED' },
      orderBy: { generatedAt: 'desc' },
    });

    if (!job) {
      return NextResponse.json({
        error: 'No completed Approval PDF found for this order. Please generate the Approval PDF first.',
      }, { status: 400 });
    }

    // 3. Construct the message text
    // Build public origin from request header
    const origin = request.headers.get('origin') || 'http://localhost:3000';
    const downloadUrl = `${origin}/api/jobs/${job.id}/download`;

    const text = `Hello ${order.client.contactName || 'there'},\n\nWe have prepared the ID card layout approval proof sheets for your review. Please download and approve the PDF document here:\n\n${downloadUrl}\n\nThank you!\n- Printed via ID Card Press System`;
    const encodedText = encodeURIComponent(text);

    const whatsappUrl = `https://wa.me/${sanitizedPhone}?text=${encodedText}`;

    return NextResponse.json({
      success: true,
      whatsappUrl,
      clientPhone,
    });
  } catch (error) {
    console.error('Construct WhatsApp share link error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
