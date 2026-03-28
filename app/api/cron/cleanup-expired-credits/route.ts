import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { creditTransactions } from '@/lib/db/schema';
import { eq, lt, isNull, and, sql } from 'drizzle-orm';

export const runtime = 'nodejs';

// Disabled in non-production environments for safety
const ENABLED = process.env.NODE_ENV === 'production';

/**
 * POST /api/cron/cleanup-expired-credits
 * Called by a cron job (e.g., Vercel Cron) to clean up expired credit debits.
 * This does NOT delete records — it marks expired debits so they don't count toward available credits.
 * In practice, we just leave them in the table and the query filter handles it.
 * This endpoint is a no-op that logs the cleanup status.
 */
export async function POST(req: NextRequest) {
  if (!ENABLED) {
    return NextResponse.json({ status: 'skipped', reason: 'Not production environment' });
  }

  // Verify cron secret if configured
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const now = new Date();

  // Find expired debit transactions (amount < 0 AND expiresAt IS NOT NULL AND expiresAt < now)
  const expiredDebits = await db
    .select({
      userId: creditTransactions.userId,
      id: creditTransactions.id,
      amount: creditTransactions.amount,
      expiresAt: creditTransactions.expiresAt,
    })
    .from(creditTransactions)
    .where(
      and(
        lt(creditTransactions.amount, 0), // debit
        isNull(creditTransactions.expiresAt).not(), // has expiry
        lt(creditTransactions.expiresAt, now) // expired
      )
    );

  // For each expired debit, we don't delete — we just log it.
  // The expiresAt filter in deductCredits already excludes these from balance calculations.
  // The purpose of this cron is record-keeping/logging.

  console.log(`[cleanup-expired-credits] Checked at ${now.toISOString()}. Found ${expiredDebits.length} expired debits to exclude from balance calculations.`);

  return NextResponse.json({
    status: 'ok',
    checkedAt: now.toISOString(),
    expiredDebitsFound: expiredDebits.length,
    note: 'Expired debits are excluded via expiresAt filter in deductCredits query — no records deleted',
  });
}
