import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { clips, photos, projects, users } from '@/lib/db/schema';
import { verifyToken, deductCreditsWithOrgPool, addOrgCredits, addCredits } from '@/lib/db/auth';
import { getSessionToken } from '@/lib/auth/cookies';
import { eq, and, inArray } from 'drizzle-orm';
import { getClipCost } from '@/lib/credits';
import { enqueueClipJob } from '../../../../workers/video-render/src/queue';

export const runtime = 'nodejs';

function getUserId(req: NextRequest): string | null {
  const token = getSessionToken(req);
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

  const VALID_RESOLUTIONS = ['720p', '1080p', '4k'] as const;
  if (!VALID_RESOLUTIONS.includes(resolution)) {
    return NextResponse.json({ error: 'Invalid resolution. Must be 720p, 1080p, or 4k' }, { status: 400 });
  }

  const cost = getClipCost(resolution);

  // Get user with org context for credit pool priority
  const [user] = await db
    .select({ id: users.id, credits: users.credits, organizationId: users.organizationId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  // Check combined credits (org pool + personal)
  const { getOrgPoolCredits } = await import('@/lib/db/auth');
  const orgPool = user.organizationId ? await getOrgPoolCredits(user.organizationId) : 0;
  const totalCredits = orgPool + (user.credits ?? 0);
  if (totalCredits < cost) {
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

  // ─── Enqueue to GPU worker ───────────────────────────────────────────────
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
    // Enqueue failed — mark clip errored, no credits charged
    await db
      .update(clips)
      .set({ status: 'error', errorMessage: 'Failed to enqueue job', updatedAt: new Date() })
      .where(eq(clips.id, clip.id));
    throw enqueueError;
  }

  // ─── Deduct credits only after successful enqueue ────────────────────────
  let creditSource: 'org' | 'personal' = 'personal';
  try {
    creditSource = (await deductCreditsWithOrgPool(
      userId,
      user.organizationId,
      cost,
      'clip_generation',
      clip.id
    )).source;
  } catch (deductError) {
    // Enqueue succeeded but credit deduction failed — the clip is marked errored
    // but the BullMQ job remains in the queue as an orphaned worker.
    // Acceptable limitation: the job will sit in the queue until it times out
    // (worker maxRetries/removeOnFail policies apply). No credits were charged.
    await db
      .update(clips)
      .set({ status: 'error', errorMessage: 'Credit deduction failed after enqueue', updatedAt: new Date() })
      .where(eq(clips.id, clip.id));
    throw deductError;
  }

  // Update project clip count
  await db
    .update(projects)
    .set({ clipCount: project.clipCount + 1, updatedAt: new Date() })
    .where(eq(projects.id, project.id));

  return NextResponse.json({ clip }, { status: 201 });
}
