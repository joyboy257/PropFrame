import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { creditTransactions, users } from '@/lib/db/schema';
import { verifyToken } from '@/lib/db/auth';
import { eq, sql, and, gte } from 'drizzle-orm';

export const runtime = 'nodejs';

const PLAN_LIMITS: Record<string, number> = {
  starter: 20,
  pro: 100,
  scale: 500,
};

function getUserId(req: NextRequest): string | null {
  const token = req.cookies.get('session_token')?.value || req.cookies.get('dev_token')?.value;
  if (!token) return null;
  const payload = verifyToken(token);
  return payload?.userId ?? null;
}

// GET /api/billing/usage — clips generated this calendar month
export async function GET(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [user] = await db
    .select({ plan: users.plan })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const plan = user?.plan ?? 'starter';
  const limit = PLAN_LIMITS[plan] ?? 20;

  const result = await db
    .select({ total: sql<number>`COALESCE(SUM(ABS(${creditTransactions.amount})), 0)` })
    .from(creditTransactions)
    .where(
      and(
        eq(creditTransactions.userId, userId),
        eq(creditTransactions.type, 'clip_generation'),
        gte(creditTransactions.createdAt, monthStart),
      )
    );

  const used = Number(result[0]?.total ?? 0);

  return NextResponse.json({ used, limit, plan });
}
