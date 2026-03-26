import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db } from '@/lib/db';
import { users, creditTransactions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
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
    const dollars = session.metadata?.dollars || '0';

    if (userId && credits > 0) {
      // Credit the user
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (user) {
        await db.update(users).set({ credits: user.credits + credits }).where(eq(users.id, userId));
        await db.insert(creditTransactions).values({
          userId,
          amount: credits,
          type: 'purchase',
          description: `Stripe checkout ($${dollars})`,
        });
      }
    }
  }

  return NextResponse.json({ received: true });
}
