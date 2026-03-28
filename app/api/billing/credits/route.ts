import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/db/auth';
import { getSessionToken } from '@/lib/auth/cookies';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const token = getSessionToken(req);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [user] = await db.select({ credits: users.credits }).from(users).where(eq(users.id, payload.userId)).limit(1);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  return NextResponse.json({ credits: user.credits });
}
