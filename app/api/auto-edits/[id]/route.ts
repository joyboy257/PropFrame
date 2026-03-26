import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { autoEdits, projects, creditTransactions } from '@/lib/db/schema';
import { verifyToken } from '@/lib/db/auth';
import { eq, and } from 'drizzle-orm';

export const runtime = 'nodejs';

function getUserId(req: NextRequest): string | null {
  const token = req.cookies.get('session_token')?.value || req.cookies.get('dev_token')?.value;
  if (!token) return null;
  const payload = verifyToken(token);
  return payload?.userId ?? null;
}

async function getAutoEditWithAuth(req: NextRequest, id: string) {
  const userId = getUserId(req);
  if (!userId) return { error: 'Unauthorized', status: 401 };

  const [autoEdit] = await db
    .select()
    .from(autoEdits)
    .where(eq(autoEdits.id, id))
    .limit(1);

  if (!autoEdit) {
    return { error: 'Not found', status: 404 };
  }

  // Get project to verify ownership
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, autoEdit.projectId), eq(projects.userId, userId)))
    .limit(1);

  if (!project) {
    return { error: 'Not found', status: 404 };
  }

  return { userId, autoEdit };
}

// GET /api/auto-edits/[id]
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const result = await getAutoEditWithAuth(req, params.id);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json({ autoEdit: result.autoEdit });
}

// PATCH /api/auto-edits/[id] — update auto-edit or trigger rendering
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const result = await getAutoEditWithAuth(req, params.id);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });

  const { autoEdit } = result;
  const body = await req.json();
  const { titleText, musicKey, clipIds, status } = body;

  // Only allow updating certain fields
  const allowedFields: Record<string, unknown> = {};
  if (titleText !== undefined) allowedFields.titleText = titleText?.trim() || null;
  if (musicKey !== undefined) allowedFields.musicKey = musicKey || null;
  if (clipIds !== undefined) allowedFields.clipIds = clipIds;
  if (status !== undefined) allowedFields.status = status;

  // When transitioning to 'rendering', deduct credits and mock-done after delay
  if (status === 'rendering' && autoEdit.status !== 'rendering') {
    // Deduct 0 more credits (already deducted 1 at creation for auto_edit)
    // For music generation cost ($2), we could deduct here, but for this PR just set to done

    // In a real impl this queues a GPU job. For this PR, immediately set to done.
    allowedFields.status = 'done';

    const [updated] = await db
      .update(autoEdits)
      .set(allowedFields as Record<string, unknown>)
      .where(eq(autoEdits.id, params.id))
      .returning();

    return NextResponse.json({ autoEdit: updated });
  }

  const [updated] = await db
    .update(autoEdits)
    .set(allowedFields as Record<string, unknown>)
    .where(eq(autoEdits.id, params.id))
    .returning();

  return NextResponse.json({ autoEdit: updated });
}

// DELETE /api/auto-edits/[id]
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const result = await getAutoEditWithAuth(req, params.id);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });

  await db.delete(autoEdits).where(eq(autoEdits.id, params.id));

  return NextResponse.json({ success: true });
}
