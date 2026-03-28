import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { verifyToken } from '@/lib/db/auth';
import { getSessionToken } from '@/lib/auth/cookies';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getCreditsForDollars, getCreditsForSGD } from '@/lib/credits';

/*
 * Singapore GST Policy:
 * PropFrame is currently below S$1M annual SGD revenue.
 * GST does not apply to SGD transactions.
 * When/if annual SGD revenue exceeds S$1M:
 *   1. Register for GST with IRAS
 *   2. Enable Stripe Tax in Stripe Dashboard → Tax
 *   3. In line_items[0].price_data for SGD, add:
 *        tax_behavior: 'exclusive'
 *        tax_code: 'txcd_10402000'  // Digital audio visual works
 *   4. Remove the gst_applicable: 'false' metadata from SGD sessions
 *   5. Update SPEC.md to reflect GST-inclusive pricing
 */

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const token = getSessionToken(req);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY environment variable is required');
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-02-24.acacia',
  });

  const { dollars, sgd, orgId, currency = 'USD' } = await req.json();

  // Determine amount and credits based on currency
  let amount: number;
  let credits: number;
  let currencyCode: string;
  let paymentMethods: string[];

  if (currency === 'SGD') {
    // Singapore: amount in SGD cents, PayNow supported
    if (!sgd || sgd < 1) {
      return NextResponse.json({ error: 'Invalid SGD amount' }, { status: 400 });
    }
    amount = sgd;
    credits = getCreditsForSGD(sgd);
    currencyCode = 'sgd';
    paymentMethods = ['paynow', 'card'];
  } else {
    // USD: amount in dollars, card only
    if (!dollars || dollars < 1) {
      return NextResponse.json({ error: 'Invalid USD amount' }, { status: 400 });
    }
    amount = dollars;
    credits = getCreditsForDollars(dollars);
    currencyCode = 'usd';
    paymentMethods = ['card'];
  }

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

  const unitAmountCents = currencyCode === 'sgd' ? Math.round(amount * 100) : Math.round(amount * 100);
  const successUrl = currencyCode === 'sgd'
    ? `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?success=true&credits=${credits}&currency=SGD`
    : `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?success=true&credits=${credits}`;

  // Create Checkout session
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: paymentMethods as Stripe.Checkout.Session.PaymentMethodTypes,
    line_items: [
      {
        price_data: {
          currency: currencyCode,
          product_data: {
            name: `${credits.toLocaleString()} Credits`,
            description: `Add ${credits.toLocaleString()} credits to your PropFrame account${orgId ? ' (Org Pool)' : ''}`,
          },
          unit_amount: unitAmountCents,
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: successUrl,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?cancelled=true`,
    metadata: {
      ...(currency === 'SGD' ? {
        gst_applicable: 'false',
      } : {}),
      userId: payload.userId,
      credits: credits.toString(),
      dollars: dollars?.toString() ?? '',
      sgd: sgd?.toString() ?? '',
      currency: currencyCode,
      ...(orgId && { orgId }),
    },
  });

  return NextResponse.json({ url: session.url });
}
