import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { photos, projects, users, creditTransactions } from '@/lib/db/schema';
import { verifyToken } from '@/lib/db/auth';
import { getSessionToken } from '@/lib/auth/cookies';
import { eq } from 'drizzle-orm';
import { CREDIT_COSTS } from '@/lib/credits';

export const runtime = 'nodejs';

const SKY_STYLES = ['blue-sky', 'golden-hour', 'twilight', 'custom'] as const;
type SkyStyle = typeof SKY_STYLES[number];

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const headerToken = req.headers.get('x-token');
  const cookieToken = getSessionToken(req);
  const token = headerToken || cookieToken;
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

  // Validate request body
  const body = await req.json();
  const skyStyle = body.skyStyle as SkyStyle;
  const customSkyUrl = body.customSkyUrl as string | undefined;

  // Validate skyStyle
  if (!skyStyle || !SKY_STYLES.includes(skyStyle)) {
    return NextResponse.json({ error: 'Invalid skyStyle. Must be one of: blue-sky, golden-hour, twilight, custom' }, { status: 400 });
  }

  // Validate customSkyUrl if skyStyle is custom
  if (skyStyle === 'custom' && !customSkyUrl) {
    return NextResponse.json({ error: 'customSkyUrl required when skyStyle is custom' }, { status: 400 });
  }

  const cost = CREDIT_COSTS.sky_replacement;

  // Enqueue job, deduct credits, and mark photo in a single transaction
  // SELECT FOR UPDATE prevents concurrent requests for the same photo from
  // both passing the skyReplaced check and double-deducting
  try {
    await db.transaction(async (tx) => {
      // Lock the photo row and check skyReplaced status
      const [lockedPhoto] = await tx.select()
        .from(photos)
        .where(eq(photos.id, photoId))
        .for('update')
        .limit(1);

      if (lockedPhoto.skyReplaced) {
        throw new Error('ALREADY_SKY_REPLACED');
      }

      // Check user credits
      const [user] = await tx.select().from(users).where(eq(users.id, payload.userId)).limit(1);
      if (!user || user.credits < cost) {
        throw new Error('INSUFFICIENT_CREDITS');
      }

      // Enqueue BullMQ job — if this fails, transaction rolls back and no credits are charged
      const { enqueueSkyReplaceJob } = await import('../../../../../workers/sky-replace/src/queue');
      await enqueueSkyReplaceJob({
        photoId,
        userId: payload.userId,
        originalStorageKey: photo.storageKey,
        originalPublicUrl: photo.publicUrl ?? '',
        skyStyle,
        customSkyUrl,
      });

      // Deduct credits and record transaction
      await tx.update(users)
        .set({ credits: user.credits - cost })
        .where(eq(users.id, payload.userId));

      await tx.insert(creditTransactions).values({
        userId: payload.userId,
        amount: -cost,
        type: 'sky_replacement',
        referenceId: photoId,
        description: `Sky replacement (${skyStyle})`,
      });

      // Mark photo as sky-replaced
      await tx.update(photos)
        .set({ skyReplaced: true })
        .where(eq(photos.id, photoId));
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'ALREADY_SKY_REPLACED') {
      return NextResponse.json({ error: 'Photo already sky-replaced. Use the original photo.' }, { status: 409 });
    }
    if (message === 'INSUFFICIENT_CREDITS') {
      return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 });
    }
    // Enqueue failure or other error — transaction rolled back, no credits charged
    console.error('Sky replacement failed:', err);
    return NextResponse.json({ error: 'Failed to queue sky replacement' }, { status: 500 });
  }

  console.log('Sky replacement queued:', { photoId, userId: payload.userId, skyStyle });

  return NextResponse.json({
    photo: {
      id: photoId,
      skyReplaced: true,
      publicUrl: photo.publicUrl,
    }
  }, { status: 202 });
}