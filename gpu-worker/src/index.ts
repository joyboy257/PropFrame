import 'dotenv/config';
import { db } from './db.js';
import { clips, photos, projects } from './schema.js';
import { eq, and, inArray } from 'drizzle-orm';
import { processClipJob } from './clipProcessor.js';
import { getR2Object, uploadToR2, getPhotoUrl } from './r2.js';
import { logger } from './logger.js';

const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS ?? '3000', 10);

async function pollAndProcess() {
  try {
    // Fetch queued clips, oldest first, up to a batch limit
    const queued = await db
      .select()
      .from(clips)
      .where(eq(clips.status, 'queued'))
      .orderBy(clips.createdAt)
      .limit(10);

    if (queued.length === 0) return;

    logger.info(`Polled ${queued.length} queued clip(s)`);

    for (const clip of queued) {
      await processOneClip(clip);
    }
  } catch (err) {
    logger.error('Poll error', err);
  }
}

async function processOneClip(clip: typeof clips.$inferSelect) {
  const log = logger.child({ clipId: clip.id, photoId: clip.photoId });

  try {
    // Mark as processing
    await db
      .update(clips)
      .set({ status: 'processing', updatedAt: new Date() })
      .where(eq(clips.id, clip.id));

    log.info('Starting clip generation');

    // ── 1. Fetch photo from R2 ────────────────────────────────────────
    const [photo] = await db
      .select()
      .from(photos)
      .where(eq(photos.id, clip.photoId));

    if (!photo) {
      throw new Error(`Photo ${clip.photoId} not found`);
    }

    const photoBuffer = await getR2Object(photo.storageKey);
    const photoUrl = getPhotoUrl(photo.storageKey);
    log.info(`Downloaded photo (${(photoBuffer.length / 1024).toFixed(1)} KB)`);

    // ── 2. Run AI video generation ───────────────────────────────────
    const outputBuffer = await processClipJob({
      clipId: clip.id,
      photoBuffer,
      photoFilename: photo.filename,
      photoUrl,
      motionStyle: clip.motionStyle,
      resolution: clip.resolution,
      duration: parseFloat(String(clip.duration)),
      customPrompt: clip.customPrompt ?? undefined,
    });

    log.info(`Generated video (${(outputBuffer.length / 1024).toFixed(1)} KB)`);

    // ── 3. Upload result to R2 ────────────────────────────────────────
    const clipKey = `clip/${clip.projectId}/${clip.id}.mp4`;
    await uploadToR2(clipKey, outputBuffer, 'video/mp4');

    const publicUrl = process.env.R2_PUBLIC_URL
      ? `${process.env.R2_PUBLIC_URL}/${clipKey}`
      : clipKey;

    // ── 4. Update clip record ────────────────────────────────────────
    await db
      .update(clips)
      .set({
        status: 'done',
        storageKey: clipKey,
        publicUrl,
        updatedAt: new Date(),
      })
      .where(eq(clips.id, clip.id));

    // ── 5. Update project clip_count ─────────────────────────────────
    const projectClips = await db
      .select()
      .from(clips)
      .where(and(eq(clips.projectId, clip.projectId), eq(clips.status, 'done')));

    const newCount = projectClips.length;

    await db
      .update(projects)
      .set({ clipCount: newCount, status: newCount > 0 ? 'complete' : 'active', updatedAt: new Date() })
      .where(eq(projects.id, clip.projectId));

    log.info(`Clip done → ${publicUrl}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error(`Clip failed: ${message}`);

    await db
      .update(clips)
      .set({ status: 'error', errorMessage: message, updatedAt: new Date() })
      .where(eq(clips.id, clip.id));
  }
}

// ── Main loop ──────────────────────────────────────────────────────
async function main() {
  logger.info('PropFrame GPU Worker starting');
  logger.info(`Poll interval: ${POLL_INTERVAL_MS}ms`);

  // Prime the DB connection
  try {
    await db.select().from(clips).limit(1);
    logger.info('Database connection: OK');
  } catch (err) {
    logger.error('Database connection failed', err);
    process.exit(1);
  }

  setInterval(pollAndProcess, POLL_INTERVAL_MS);
  pollAndProcess(); // run immediately on start
}

main().catch((err) => {
  logger.error('Worker fatal error', err);
  process.exit(1);
});
