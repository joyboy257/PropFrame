import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { organizationInvitations } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  // Auth: verify CRON_SECRET
  const authHeader = req.headers.get('Authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await db.execute(sql`UPDATE organization_invitations SET status = 'expired' WHERE status = 'pending' AND expires_at < NOW()`);
    const updated = (result as { rowCount?: number }).rowCount ?? 0;
    return NextResponse.json({ updated });
  } catch (err) {
    console.error('[cron/cleanup-invitations]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
