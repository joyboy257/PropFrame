import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { clips, photos, projects, users } from '@/lib/db/schema';
import { verifyToken, deductCredits, addCredits } from '@/lib/db/auth';
import { eq, and, inArray } from 'drizzle-orm';
import { getClipCost } from '@/lib/credits';
import { enqueueClipJob } from '../../../../workers/video-render/src/queue';

export const runtime = 'nodejs';

function getUserId(req: NextRequest): string | null {
  const token=req.cookies.get('session_token')?.value || req.cookies.get('dev_token')?.value;
  if (!token) return null;
  const payload = verifyToken(token);
  return payload?.userId ?? null;
}

// POST /api/clips/generate — queue clip generation
export async function POST(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { photoId, motionStyle, customPrompt, resolution = '720p' } = await req.json();

  if (!photoId) {
    return NextResponse.json({ error: 'photoId is required' }, { status: 400 });
  }

  // Verify photo belongs to user's project
  const [photo] = await db.select().from(photos).where(eq(photos.id, photoId)).limit(1);
  if (!photo) return NextResponse.json({ error: 'Photo not found' }, { status: 404 });

  const [project] = await db.select().from(projects).where(eq(projects.id, photo.projectId)).limit(1);
  if (!project || project.userId !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const cost = getClipCost(resolution as '720p' | '1080p' | '4k');

  // Check user credits
  const [user] = await db.select({ credits: users.credits }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user || user.credits < cost) {
    return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 });
  }

  // ─── Idempotency: check for existing pending clip ──────────────────────────
  const [existingClip] = await db
    .select()
    .from(clips)
    .where(
      and(
        eq(clips.photoId, photoId),
        eq(clips.motionStyle, motionStyle || 'push-in'),
        inArray(clips.status, ['queued', 'processing'])
      )
    )
    .limit(1);

  if (existingClip) {
    return NextResponse.json({ clip: existingClip }, { status: 200 });
  }

  // ─── Create clip record ───────────────────────────────────────────────────
  const [clip] = await db.insert(clips).values({
    projectId: project.id,
    photoId,
    motionStyle: motionStyle || 'push-in',
    customPrompt: customPrompt || null,
    resolution: resolution || '720p',
    status: 'queued',
    cost,
  }).returning();

  // ─── Enqueue to GPU worker (with credit refund on failure) ────────────────
  try {
    await enqueueClipJob({
      clipId: clip.id,
      projectId: project.id,
      photoId: clip.photoId,
      photoStorageKey: photo.storageKey,
      motionStyle: clip.motionStyle as 'push-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'custom',
      customPrompt: clip.customPrompt,
      resolution: clip.resolution as '720p' | '1080p' | '4k',
      userId,
    });
  } catch (enqueueError) {
    // Refund credits on enqueue failure
    await addCredits(userId, cost, 'clip_generation', clip.id);
    // Mark clip as failed
    await db
      .update(clips)
      .set({ status: 'error', errorMessage: 'Failed to enqueue job', updatedAt: new Date() })
      .where(eq(clips.id, clip.id));
    throw enqueueError;
  }

  // ─── Deduct credits only after successful enqueue ────────────────────────
  await deductCredits(userId, cost, 'clip_generation', clip.id);

  // Update project clip count
  await db
    .update(projects)
    .set({ clipCount: project.clipCount + 1, updatedAt: new Date() })
    .where(eq(projects.id, project.id));

  return NextResponse.json({ clip }, { status: 201 });
}
