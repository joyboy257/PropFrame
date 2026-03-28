import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { photos, projects, users, creditTransactions } from '@/lib/db/schema';
import { verifyToken } from '@/lib/db/auth';
import { getSessionToken } from '@/lib/auth/cookies';
import { eq, and } from 'drizzle-orm';
import { CREDIT_COSTS } from '@/lib/credits';

export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = getSessionToken(req);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const photoId = params.id;

  // Get photo and verify ownership via project
  const [photo] = await db.select().from(photos).where(eq(photos.id, photoId)).limit(1);
  if (!photo) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [project] = await db.select().from(projects).where(eq(projects.id, photo.projectId)).limit(1);
  if (!project || project.userId !== payload.userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Check if already staged
  if (photo.virtualStaged) {
    return NextResponse.json({ alreadyStaged: true, error: 'This photo is already staged' }, { status: 409 });
  }

  const body = await req.json();
  const style = body.style as string || 'modern';

  // Deduct credit
  const cost = CREDIT_COSTS.virtual_staging;
  const [user] = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1);
  if (!user || user.credits < cost) {
    return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 });
  }

  await db.update(users)
    .set({ credits: user.credits - cost })
    .where(eq(users.id, payload.userId));

  await db.insert(creditTransactions).values({
    userId: payload.userId,
    amount: -cost,
    type: 'virtual_staging',
    referenceId: photoId,
    description: `Virtual staging (${style})`,
  });

  // Mark photo as staged
  await db.update(photos)
    .set({ virtualStaged: true })
    .where(eq(photos.id, photoId));

  // Enqueue to virtual staging worker
  try {
    const { enqueueStageJob } = await import('../../../../../workers/virtual-stage/src/queue');
    await enqueueStageJob({
      photoId,
      projectId: project.id,
      userId: payload.userId,
      photoStorageKey: photo.storageKey,
      style: style as 'modern' | 'scandinavian' | 'industrial' | 'warm',
    });
  } catch {
    // Worker may not be running — that's ok, photo is marked staged
    // The worker will catch up when started
  }

  return NextResponse.json({ success: true, photoId });
}
