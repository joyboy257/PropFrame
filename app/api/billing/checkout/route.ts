import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { verifyToken } from '@/lib/db/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { dollarsToCredits } from '@/lib/credits';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value || req.cookies.get('dev_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
    apiVersion: '2025-02-24.acacia',
  });

  const { dollars } = await req.json();
  if (!dollars || dollars < 1) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
  }

  const credits = dollarsToCredits(dollars);

  // Get or create Stripe customer
  const [user] = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { userId: user.id },
    });
    customerId = customer.id;
    await db.update(users).set({ stripeCustomerId: customerId }).where(eq(users.id, user.id));
  }

  // Create Checkout session
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${credits.toLocaleString()} Credits`,
            description: `Add ${credits.toLocaleString()} credits to your FrameForge account`,
          },
          unit_amount: Math.round(dollars * 100), // cents
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/ai/billing?success=true&credits=${credits}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/ai/billing?cancelled=true`,
    metadata: {
      userId: payload.userId,
      credits: credits.toString(),
      dollars: dollars.toString(),
    },
  });

  return NextResponse.json({ url: session.url });
}
