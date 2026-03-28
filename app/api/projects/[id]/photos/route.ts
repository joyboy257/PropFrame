import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { photos, projects } from '@/lib/db/schema';
import { verifyToken } from '@/lib/db/auth';
import { getSessionToken } from '@/lib/auth/cookies';
import { eq, and } from 'drizzle-orm';
import { deleteObject } from '@/lib/storage/r2';

export const runtime = 'nodejs';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = getSessionToken(req);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const projectId = params.id;

  // Verify project ownership
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project || project.userId !== payload.userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Fetch all photos to clean up R2 objects
  const projectPhotos = await db.select().from(photos).where(eq(photos.projectId, projectId));

  // Delete R2 objects without blocking DB deletion
  const keysToDelete: string[] = [];
  for (const photo of projectPhotos) {
    keysToDelete.push(photo.storageKey);
    if (photo.skyStorageKey) keysToDelete.push(photo.skyStorageKey);
  }

  if (keysToDelete.length > 0) {
    await Promise.allSettled(
      keysToDelete.map((key) =>
        deleteObject(key).catch((err) => {
          console.error(`[R2 cleanup] Failed to delete object: ${key}`, err);
        })
      )
    );
  }

  await db.delete(photos).where(eq(photos.projectId, projectId));

  return NextResponse.json({ success: true });
}
