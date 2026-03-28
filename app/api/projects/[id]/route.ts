import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { projects, photos, clips, autoEdits } from '@/lib/db/schema';
import { verifyToken } from '@/lib/db/auth';
import { getSessionToken } from '@/lib/auth/cookies';
import { eq, asc } from 'drizzle-orm';
import { deleteObject } from '@/lib/storage/r2';

export const runtime = 'nodejs';

function getUserId(req: NextRequest): string | null {
  const token = getSessionToken(req);
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

  const { name, status, clipCount, thumbnailUrl, cdcNumber } = await req.json();

  // Validate cdcNumber against CEA format: R + 6 digits + uppercase letter, max 50 chars
  if (cdcNumber !== undefined && cdcNumber !== null) {
    if (typeof cdcNumber !== 'string' || cdcNumber.length > 50 || !/^R\d{6}[A-Z]$/.test(cdcNumber)) {
      return NextResponse.json(
        { error: 'Invalid cdcNumber format. Must match CEA format: R followed by 6 digits and an uppercase letter (e.g., R012345B), max 50 characters.' },
        { status: 400 }
      );
    }
  }

  const [updated] = await db
    .update(projects)
    .set({
      ...(name && { name: name.trim() }),
      ...(status && { status }),
      ...(clipCount !== undefined && { clipCount }),
      ...(thumbnailUrl !== undefined && { thumbnailUrl }),
      ...(cdcNumber !== undefined && { cdcNumber }),
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

  // Fetch all related records to clean up R2 objects
  const projectPhotos = await db.select().from(photos).where(eq(photos.projectId, params.id));
  const projectClips = await db.select().from(clips).where(eq(clips.projectId, params.id));
  const projectAutoEdits = await db.select().from(autoEdits).where(eq(autoEdits.projectId, params.id));

  // Collect all R2 storage keys to delete
  const keysToDelete: string[] = [];

  for (const photo of projectPhotos) {
    keysToDelete.push(photo.storageKey);
    if (photo.skyStorageKey) keysToDelete.push(photo.skyStorageKey);
  }

  for (const clip of projectClips) {
    if (clip.storageKey) keysToDelete.push(clip.storageKey);
  }

  for (const autoEdit of projectAutoEdits) {
    if (autoEdit.storageKey) keysToDelete.push(autoEdit.storageKey);
  }

  // Delete R2 objects without blocking DB deletion
  if (keysToDelete.length > 0) {
    await Promise.allSettled(
      keysToDelete.map((key) =>
        deleteObject(key).catch((err) => {
          console.error(`[R2 cleanup] Failed to delete object: ${key}`, err);
        })
      )
    );
  }

  // DB cascade will handle photos, clips, and autoEdits deletion
  await db.delete(projects).where(eq(projects.id, params.id));

  return NextResponse.json({ success: true });
}
