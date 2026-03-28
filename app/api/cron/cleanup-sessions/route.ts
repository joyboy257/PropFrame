import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sessions } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  // Auth: verify CRON_SECRET
  const authHeader = req.headers.get('Authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await db.execute(sql`DELETE FROM sessions WHERE expires_at < NOW()`);
    const deleted = (result as { rowCount?: number }).rowCount ?? 0;
    return NextResponse.json({ deleted });
  } catch (err) {
    console.error('[cron/cleanup-sessions]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
