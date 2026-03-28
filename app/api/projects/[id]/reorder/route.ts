import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { photos, projects } from '@/lib/db/schema';
import { verifyToken } from '@/lib/db/auth';
import { getSessionToken } from '@/lib/auth/cookies';
import { and, eq, inArray } from 'drizzle-orm';

export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = getSessionToken(req);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const projectId = params.id;
  const { photoIds } = await req.json();

  if (!Array.isArray(photoIds)) {
    return NextResponse.json({ error: 'photoIds array required' }, { status: 400 });
  }

  // Verify project ownership
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project || project.userId !== payload.userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Verify all photos belong to this project
  const validPhotos = await db
    .select({ id: photos.id })
    .from(photos)
    .where(
      and(
        eq(photos.projectId, projectId),
        inArray(photos.id, photoIds)
      )
    )
    .execute();

  if (validPhotos.length !== photoIds.length) {
    return NextResponse.json({ error: 'Invalid photo IDs' }, { status: 400 });
  }

  // Update order for each photo
  await Promise.all(
    photoIds.map((photoId, index) =>
      db
        .update(photos)
        .set({ order: index })
        .where(eq(photos.id, photoId))
    )
  );

  return NextResponse.json({ success: true });
}
