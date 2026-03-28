import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { autoEdits, clips, projects, creditTransactions, users } from '@/lib/db/schema';
import { verifyToken } from '@/lib/db/auth';
import { getSessionToken } from '@/lib/auth/cookies';
import { eq, and, inArray, sql } from 'drizzle-orm';

export const runtime = 'nodejs';

function getUserId(req: NextRequest): string | null {
  const token = getSessionToken(req);
  if (!token) return null;
  const payload = verifyToken(token);
  return payload?.userId ?? null;
}

// POST /api/auto-edits — create a new auto-edit (draft)
export async function POST(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { projectId, clipIds, titleText, musicKey } = await req.json();

  if (!projectId) {
    return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
  }

  if (!Array.isArray(clipIds) || clipIds.length === 0) {
    return NextResponse.json({ error: 'clipIds must be a non-empty array' }, { status: 400 });
  }

  // Verify project ownership
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // Verify all clipIds belong to this project (and thus to the user)
  const projectClips = await db
    .select({ id: clips.id })
    .from(clips)
    .where(and(eq(clips.projectId, projectId), inArray(clips.id, clipIds)));

  const validClipIds = new Set(projectClips.map(c => c.id));
  const allValid = clipIds.every(id => validClipIds.has(id));

  if (!allValid || projectClips.length !== clipIds.length) {
    return NextResponse.json({ error: 'One or more clipIds are invalid or do not belong to this project' }, { status: 400 });
  }

  // Idempotency: check for existing pending auto-edit for this project
  const [existing] = await db
    .select()
    .from(autoEdits)
    .where(
      and(
        eq(autoEdits.projectId, projectId),
        eq(autoEdits.status, 'queued')
      )
    )
    .limit(1);

  if (existing) {
    return NextResponse.json({ autoEdit: existing }, { status: 200 });
  }

  // Deduct 1 credit for auto_edit
  const result = await db.execute(sql`UPDATE users SET credits = credits - 1 WHERE id = ${userId} AND credits >= 1`);
  if (result.rowCount === 0) {
    return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 });
  }

  // Record the transaction
  await db.insert(creditTransactions).values({
    userId,
    amount: -1,
    type: 'auto_edit',
    referenceId: null,
    description: 'Auto-edit assembly',
  });

  // Create the auto-edit
  const [newAutoEdit] = await db
    .insert(autoEdits)
    .values({
      projectId,
      clipIds,
      titleText: titleText?.trim() || null,
      musicKey: musicKey || null,
      status: 'draft',
      cost: 1,
    })
    .returning();

  return NextResponse.json({ autoEdit: newAutoEdit }, { status: 201 });
}
