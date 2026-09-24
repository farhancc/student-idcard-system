import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { calculateInvoice } from '@/lib/invoice';

/**
 * POST /api/orders/batch-import
 *
 * Records a completed Batch Import compile as a real order + invoice, for
 * billing/reporting parity with the Cardholders-tab flow — WITHOUT creating
 * any Cardholder/OrderCardholder rows. Batch Import is deliberately local-only
 * (see BatchCompilePanel.tsx): the roster never leaves the operator's
 * machine, so this order has no linked cardholders, only the card count the
 * client already paid credits for via batch-credits-hold/settle.
 *
 * A dedicated route rather than reusing POST /api/orders: that route derives
 * `cardCount` from `cardholderIds.length` and requires a non-empty array
 * (src/lib/schemas.ts createOrderSchema), and is also reachable from the
 * external client-portal (orgToken) surface — neither fits a roster-less,
 * dashboard-only record.
 */

const schema = z.object({
  clientId: z.union([z.number(), z.string().transform(Number)]),
  templateId: z.union([z.number(), z.string().transform(Number)]),
  cardCount: z.union([z.number(), z.string().transform(Number)]),
  pricePerCard: z.union([z.number(), z.string().transform(Number)]).optional(),
  pdfType: z.enum(['PRODUCTION', 'APPROVAL', 'INDIVIDUAL']),
});

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400 });
    }

    const auth = requireRole(request, ['OWNER', 'OPERATOR']);
    if ('response' in auth) return auth.response;
    const { pressId, userId, name: actorName } = auth.actor;

    const validation = schema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request parameters', details: validation.error.format() },
        { status: 400 },
      );
    }
    const { clientId, templateId, cardCount, pricePerCard, pdfType } = validation.data;

    if (!Number.isFinite(cardCount) || cardCount < 1) {
      return NextResponse.json({ error: 'cardCount must be a positive integer' }, { status: 400 });
    }

    const client = await prisma.client.findFirst({ where: { id: clientId, pressId } });
    const template = await prisma.cardTemplate.findFirst({
      where: { id: templateId, OR: [{ pressId }, { pressId: null }] },
    });
    if (!client || !template) {
      return NextResponse.json({ error: 'Client or Template not found' }, { status: 404 });
    }

    const priceSetting = pricePerCard === undefined
      ? await prisma.systemSetting.findUnique({ where: { key: 'default_price_per_card' } })
      : null;
    const taxSetting = await prisma.systemSetting.findUnique({ where: { key: 'default_tax_percent' } });
    const unitPrice = pricePerCard ?? (priceSetting && !isNaN(Number(priceSetting.value)) ? Number(priceSetting.value) : 50.0);
    const taxPercent = taxSetting && !isNaN(Number(taxSetting.value)) ? Number(taxSetting.value) : 18.0;

    const calc = calculateInvoice(unitPrice, Math.ceil(cardCount), taxPercent);

    // Matches the status a regularly-created order would be in immediately
    // after this same compile: production-complete transitions PRODUCTION
    // orders to PRINTING; an APPROVAL compile never gets an automatic
    // transition, so it stays at the DRAFT it would have been created with.
    const status = pdfType === 'PRODUCTION' ? 'PRINTING' : 'DRAFT';

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.cardOrder.create({
        data: {
          pressId,
          clientId,
          templateId,
          status,
          templateVersion: template.version,
        },
      });

      const invoice = await tx.orderInvoice.create({
        data: {
          orderId: order.id,
          pressId,
          pricePerCard: calc.pricePerCard,
          cardCount: calc.cardCount,
          subtotal: calc.subtotal,
          taxPercent: calc.taxPercent,
          taxAmount: calc.taxAmount,
          totalAmount: calc.totalAmount,
          paymentStatus: 'UNPAID',
          paidAmount: 0.0,
        },
      });

      await tx.orderActivityLog.create({
        data: {
          orderId: order.id,
          pressId,
          actorId: userId,
          actorName,
          action: 'ORDER_CREATED',
          fromStatus: null,
          toStatus: status,
          note: `Batch Import (${pdfType}): recorded ${calc.cardCount} card(s) at ₹${calc.pricePerCard.toFixed(2)}/card. Cardholder data was not persisted — the batch was compiled and saved on the operator's machine only.`,
        },
      });

      return { order, invoice };
    });

    return NextResponse.json({
      success: true,
      message: 'Order and invoice recorded for this batch',
      order: result.order,
      invoice: result.invoice,
    });
  } catch (e: any) {
    console.error('Batch import order/invoice error:', e);
    return NextResponse.json({ error: e.message || 'Failed to record order and invoice' }, { status: 500 });
  }
}
