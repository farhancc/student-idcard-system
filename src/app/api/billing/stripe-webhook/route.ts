import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy_key_for_build_purposes_only', {
  // Use default API version configured in the SDK
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    let event: Stripe.Event;

    if (webhookSecret && signature) {
      try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      } catch (err: any) {
        console.error(`Webhook signature verification failed: ${err.message}`);
        return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 });
      }
    } else {
      // In production, signature verification is mandatory
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Webhook signature is required in production' }, { status: 400 });
      }
      // Development fallback
      event = JSON.parse(body);
    }

    const eventType = event.type;
    console.log(`Stripe Webhook Event Received: ${eventType}`);

    const handleUpgrade = async (customerEmail: string, stripeCustomerId: string, stripeSubId: string, plan: string) => {
      let press = await prisma.press.findFirst({
        where: {
          OR: [
            { stripeCustomerId },
            { email: customerEmail || undefined },
          ],
        },
      });

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
}
