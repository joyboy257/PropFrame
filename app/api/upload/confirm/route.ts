import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { photos, projects } from '@/lib/db/schema';
import { verifyToken } from '@/lib/db/auth';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value || req.cookies.get('dev_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { projectId, storageKey, filename, width, height, order = 0 } = await req.json();

  if (!projectId || !storageKey || !filename) {
    return NextResponse.json({ error: 'projectId, storageKey, filename required' }, { status: 400 });
  }

  // Verify project ownership
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project || project.userId !== payload.userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const [photo] = await db.insert(photos).values({
    projectId,
    storageKey,
    filename,
    width: width || null,
    height: height || null,
    order,
    publicUrl: `/api/files/${encodeURIComponent(storageKey)}`,
  }).returning();

  return NextResponse.json({ photo }, { status: 201 });
}
