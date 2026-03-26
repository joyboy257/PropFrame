import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { clips, photos, projects } from '@/lib/db/schema';
import { verifyToken } from '@/lib/db/auth';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';

function getUserId(req: NextRequest): string | null {
  const token = req.cookies.get('session_token')?.value || req.cookies.get('dev_token')?.value;
  if (!token) return null;
  const payload = verifyToken(token);
  return payload?.userId ?? null;
}

// GET /api/clips/[id]
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [clip] = await db.select().from(clips).where(eq(clips.id, params.id)).limit(1);
  if (!clip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Verify ownership via project
  const [project] = await db.select().from(projects).where(eq(projects.id, clip.projectId)).limit(1);
  if (!project || project.userId !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const [photo] = await db.select().from(photos).where(eq(photos.id, clip.photoId)).limit(1);

  return NextResponse.json({ clip, photo });
}
