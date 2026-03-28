import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { clips } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  // Auth: verify CRON_SECRET
  const authHeader = req.headers.get('Authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await db.execute(sql`UPDATE clips SET status = 'queued', updated_at = NOW() WHERE status = 'processing' AND updated_at < NOW() - INTERVAL '10 minutes'`);
    const reset = (result as { rowCount?: number }).rowCount ?? 0;
    return NextResponse.json({ reset });
  } catch (err) {
    console.error('[cron/cleanup-stuck-clips]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
