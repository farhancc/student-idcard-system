import { NextResponse } from 'next/server';
import { prisma, withSystemContext } from '@/lib/prisma';
import Stripe from 'stripe';

let _stripe: Stripe | null = null;
function getStripe(): Stripe | null {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return _stripe;
}

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: Request) {
  return withSystemContext(async () => {
    try {
    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json(
        { error: 'Stripe is not configured. Set STRIPE_SECRET_KEY.' },
        { status: 503 }
      );
    }

    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    let event: Stripe.Event;

    if (webhookSecret) {
      if (!signature) {
        return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
      }
      try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      } catch (err: any) {
        console.error(`Webhook signature verification failed: ${err.message}`);
        return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 });
      }
    } else {
      if (process.env.NODE_ENV !== 'development') {
        return NextResponse.json(
          { error: 'STRIPE_WEBHOOK_SECRET is required in non-development environments' },
          { status: 400 }
        );
      }
      // Local development fallback only
      event = JSON.parse(body);
    }

    const eventType = event.type;
    console.log(`Stripe Webhook Event Received: ${eventType}`);

    const handleUpgrade = async (customerEmail: string, stripeCustomerId: string, stripeSubId: string, plan: string) => {
      const matchers: { stripeCustomerId?: string; email?: string }[] = [];
      if (stripeCustomerId) matchers.push({ stripeCustomerId });
      if (customerEmail) matchers.push({ email: customerEmail });
      if (matchers.length === 0) {
        console.error('Stripe webhook: no usable identifier on event; ignoring');
        return;
      }
      const press = await prisma.press.findFirst({ where: { OR: matchers } });

      if (press) {
        await prisma.press.update({
          where: { id: press.id },
          data: {
            plan: plan,
            isActive: true,
            stripeCustomerId,
            stripeSubId,
            trialEndsAt: null, // Trial completed, active paid plan
          },
        });
        console.log(`Press ${press.name} upgraded to plan ${plan} via Stripe webhook`);
      } else {
        console.warn(`No press matched for email: ${customerEmail} or stripeCustomerId: ${stripeCustomerId}`);
      }
    };

    switch (eventType) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerEmail = session.customer_details?.email || session.customer_email || '';
        const stripeCustomerId = session.customer as string;
        const stripeSubId = session.subscription as string;
        const planMetadata = session.metadata?.plan || 'PRO'; // Default to PRO

        await handleUpgrade(customerEmail, stripeCustomerId, stripeSubId, planMetadata);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerEmail = invoice.customer_email || '';
        const stripeCustomerId = invoice.customer as string;
        const stripeSubId = (invoice as any).subscription as string;
        
        let planMetadata = 'PRO';
        if (stripeSubId) {
          try {
            const subscription = await stripe.subscriptions.retrieve(stripeSubId);
            planMetadata = subscription.metadata?.plan || 'PRO';
          } catch (err) {
            console.error(`Failed to retrieve subscription ${stripeSubId} for metadata:`, err);
          }
        }

        await handleUpgrade(customerEmail, stripeCustomerId, stripeSubId, planMetadata);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const stripeCustomerId = subscription.customer as string;
        const stripeSubId = subscription.id;
        const status = subscription.status; // active, past_due, canceled, trialing

        const press = await prisma.press.findFirst({
          where: { stripeSubId },
        });

        if (press) {
          const isActive = status === 'active' || status === 'trialing';
          const planMetadata = subscription.metadata?.plan || press.plan;

          await prisma.press.update({
            where: { id: press.id },
            data: {
              isActive,
              plan: planMetadata,
            },
          });
          console.log(`Press ${press.name} subscription status updated to ${status}`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const stripeSubId = subscription.id;

        const press = await prisma.press.findFirst({
          where: { stripeSubId },
        });

        if (press) {
          // Downgrade to BASIC plan or mark suspended
          await prisma.press.update({
            where: { id: press.id },
            data: {
              plan: 'BASIC',
              isActive: true, // revert to basic limit or suspend
            },
          });
          console.log(`Press ${press.name} subscription canceled. Downgraded to BASIC.`);
        }
        break;
      }

      default:
        console.log(`Unhandled Stripe event type: ${eventType}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook processing error:', error);
    return NextResponse.json({ error: 'Webhook handler error' }, { status: 400 });
  }
  });
}
