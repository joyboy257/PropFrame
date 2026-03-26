import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { projects, photos, clips, autoEdits } from '@/lib/db/schema';
import { verifyToken } from '@/lib/db/auth';
import { eq, asc } from 'drizzle-orm';

export const runtime = 'nodejs';

function getUserId(req: NextRequest): string | null {
  const token = req.cookies.get('session_token')?.value || req.cookies.get('dev_token')?.value;
  if (!token) return null;
  const payload = verifyToken(token);
  return payload?.userId ?? null;
}

// GET /api/projects/[id] — get project with photos, clips
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, params.id))
    .limit(1);

  if (!project || project.userId !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const projectPhotos = await db
    .select()
    .from(photos)
    .where(eq(photos.projectId, params.id))
    .orderBy(asc(photos.order));

  const projectClips = await db
    .select()
    .from(clips)
    .where(eq(clips.projectId, params.id))
    .orderBy(asc(clips.createdAt));

  const projectAutoEdits = await db
    .select()
    .from(autoEdits)
    .where(eq(autoEdits.projectId, params.id))
    .orderBy(asc(autoEdits.createdAt));

  return NextResponse.json({
    project,
    photos: projectPhotos,
    clips: projectClips,
    autoEdits: projectAutoEdits,
  });
}

// PATCH /api/projects/[id] — update project name
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, params.id))
    .limit(1);

  if (!project || project.userId !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { name, status, clipCount, thumbnailUrl } = await req.json();

  const [updated] = await db
    .update(projects)
    .set({
      ...(name && { name: name.trim() }),
      ...(status && { status }),
      ...(clipCount !== undefined && { clipCount }),
      ...(thumbnailUrl !== undefined && { thumbnailUrl }),
      updatedAt: new Date(),
    })
    .where(eq(projects.id, params.id))
    .returning();

  return NextResponse.json({ project: updated });
}

// DELETE /api/projects/[id]
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, params.id))
    .limit(1);

  if (!project || project.userId !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await db.delete(projects).where(eq(projects.id, params.id));

  return NextResponse.json({ success: true });
}
