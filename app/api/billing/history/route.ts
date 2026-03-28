import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/db/auth';
import { getSessionToken } from '@/lib/auth/cookies';
import { db } from '@/lib/db';
import { creditTransactions } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const token = getSessionToken(req);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const transactions = await db
    .select()
    .from(creditTransactions)
    .where(eq(creditTransactions.userId, payload.userId))
    .orderBy(desc(creditTransactions.createdAt))
    .limit(50);

  return NextResponse.json({ transactions });
}
