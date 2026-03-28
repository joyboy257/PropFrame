import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { autoEdits, projects } from '@/lib/db/schema';
import { verifyToken } from '@/lib/db/auth';
import { getSessionToken } from '@/lib/auth/cookies';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export const runtime = 'nodejs';

function getUserId(req: NextRequest): string | null {
  const token = getSessionToken(req);
  if (!token) return null;
  const payload = verifyToken(token);
  return payload?.userId ?? null;
}

// POST /api/auto-edits/[id]/share — generate or retrieve a shareable public link (7d expiry)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [autoEdit] = await db
    .select()
    .from(autoEdits)
    .where(eq(autoEdits.id, params.id))
    .limit(1);

  if (!autoEdit) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Verify ownership via project
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, autoEdit.projectId), eq(projects.userId, userId)))
    .limit(1);

  if (!project) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // If already has a valid share token, return it
  if (autoEdit.shareToken && autoEdit.shareExpiresAt && autoEdit.shareExpiresAt > new Date()) {
    return NextResponse.json({
      shareUrl: `/share/${autoEdit.shareToken}`,
      expiresAt: autoEdit.shareExpiresAt,
    });
  }

  // Generate new share token (7 day expiry)
  const shareToken = nanoid(24);
  const shareExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const [updated] = await db
    .update(autoEdits)
    .set({ shareToken, shareExpiresAt })
    .where(eq(autoEdits.id, params.id))
    .returning();

  return NextResponse.json({
    shareUrl: `/share/${shareToken}`,
    expiresAt: shareExpiresAt,
  });
}
