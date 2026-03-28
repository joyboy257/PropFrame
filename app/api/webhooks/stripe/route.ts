import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db } from '@/lib/db';
import { users, creditTransactions, organizationCredits } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY environment variable is required');
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-02-24.acacia',
  });

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
  const body = await req.text();
  const signature = req.headers.get('stripe-signature') || '';

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;
    const credits = parseInt(session.metadata?.credits || '0', 10);
    const dollars = session.metadata?.dollars || '';
    const sgd = session.metadata?.sgd || '';
    const currency = session.metadata?.currency || 'usd';
    const orgId = session.metadata?.orgId;

    if (!userId || credits <= 0) {
      return NextResponse.json({ received: true });
    }

    const amountStr = currency === 'sgd' ? `S$${sgd}` : `$${dollars}`;

    if (orgId) {
      // Org credit pool purchase
      const [orgCredit] = await db
        .select()
        .from(organizationCredits)
        .where(eq(organizationCredits.orgId, orgId))
        .limit(1);

      if (orgCredit) {
        await db
          .update(organizationCredits)
          .set({ amount: orgCredit.amount + credits, updatedAt: new Date() })
          .where(eq(organizationCredits.orgId, orgId));
      } else {
        await db.insert(organizationCredits).values({
          orgId,
          amount: credits,
        });
      }

      // Idempotency check
      const [existingOrg] = await db
        .select({ id: creditTransactions.id })
        .from(creditTransactions)
        .where(eq(creditTransactions.stripeEventId, event.id))
        .limit(1);
      if (existingOrg) {
        return NextResponse.json({ received: true, duplicate: true });
      }

      await db.insert(creditTransactions).values({
        userId,
        organizationId: orgId,
        amount: credits,
        type: 'org_topup',
        description: `Org pool top-up via Stripe (${amountStr})`,
        stripeEventId: event.id,
      });
    } else {
      // Personal credit purchase
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (user) {
        await db
          .update(users)
          .set({ credits: user.credits + credits })
          .where(eq(users.id, userId));

        // Idempotency check
        const [existingUser] = await db
          .select({ id: creditTransactions.id })
          .from(creditTransactions)
          .where(eq(creditTransactions.stripeEventId, event.id))
          .limit(1);
        if (existingUser) {
          return NextResponse.json({ received: true, duplicate: true });
        }

        await db.insert(creditTransactions).values({
          userId,
          amount: credits,
          type: 'purchase',
          description: `Stripe checkout (${amountStr})`,
          stripeEventId: event.id,
        });
      }
    }
  }

  return NextResponse.json({ received: true });
}
