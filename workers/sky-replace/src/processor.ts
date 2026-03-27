import type { SkyReplaceJob, SkyStyle } from './types.js';
import { getSignedDownloadUrl, uploadToR2, downloadFromR2 } from './r2.js';
import { updatePhotoSkyDone, updatePhotoSkyError, refundCredits } from './db.js';
import sharp from 'sharp';
import Replicate from 'replicate';

// Sky preset image URLs (public domain / Creative Commons)
const SKY_PRESETS: Record<Exclude<SkyStyle, 'custom'>, string> = {
  'blue-sky': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1920&q=80',
  'golden-hour': 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80',
  'twilight': 'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?w=1920&q=80',
};

export async function processSkyReplaceJob(job: SkyReplaceJob): Promise<void> {
  const { photoId, userId, skyStyle, customSkyUrl, originalStorageKey } = job;

  console.log(JSON.stringify({
    job: 'sky-replace',
    photoId,
    status: 'started',
    skyStyle,
  }));

  try {
    // 1. Download original photo from R2
    const originalBuffer = await downloadFromR2(originalStorageKey);
    const originalMeta = await sharp(originalBuffer).metadata();

    // 2. Get signed URL for AI processing
    const photoUrl = await getSignedDownloadUrl(originalStorageKey, 1800);

    // 3. Determine sky image URL
    const skyImageUrl = skyStyle === 'custom' && customSkyUrl
      ? customSkyUrl
      : SKY_PRESETS[skyStyle];

    // 4. Use AI segmentation model to create sky mask
    // Using RMBG-1.4 to isolate sky, then composite with sharp
    const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN || '' });

    // Run RMBG-1.4 segmentation model to get sky mask
    const maskOutput = await replicate.run('briaai/RMBG-1.4', {
      input: {
        model: 'RMBG-1.4',
        image: photoUrl,
      },
    }) as unknown as { image: string } | string;

    const maskUrl = typeof maskOutput === 'string' ? maskOutput : (maskOutput as { image: string }).image;

    // Download the mask
    const maskResponse = await fetch(maskUrl);
    if (!maskResponse.ok) {
      throw new Error(`Failed to download mask from ${maskUrl}: ${maskResponse.status}`);
    }
    const maskBuffer = Buffer.from(await maskResponse.arrayBuffer());

    // 5. Download sky image
    const skyResponse = await fetch(skyImageUrl);
    if (!skyResponse.ok) {
      throw new Error(`Failed to download sky image from ${skyImageUrl}: ${skyResponse.status}`);
    }
    const skyBuffer = Buffer.from(await skyResponse.arrayBuffer());

    // 6. Composite sky onto original using sharp
    const resultBuffer = await compositeSkyWithMask(
      originalBuffer,
      maskBuffer,
      skyBuffer,
      originalMeta?.width ?? 1920,
      originalMeta?.height ?? 1080
    );

    // 7. Upload result to R2
    const timestamp = Date.now();
    const skyStorageKey = `sky/${userId}/${photoId}/sky-${timestamp}.jpg`;
    const skyPublicUrl = await uploadToR2(skyStorageKey, resultBuffer, 'image/jpeg');

    // 8. Update photo record in DB
    await updatePhotoSkyDone(photoId, skyStorageKey, skyPublicUrl);

    console.log(JSON.stringify({
      job: 'sky-replace',
      photoId,
      status: 'done',
      resultUrl: skyPublicUrl,
    }));
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';

    console.log(JSON.stringify({
      job: 'sky-replace',
      photoId,
      status: 'error',
      error: errorMessage,
    }));

    // On error: reset photo skyReplaced flag and refund credits
    await updatePhotoSkyError(photoId);
    await refundCredits(userId, photoId);

    throw err;
  }
}

async function compositeSkyWithMask(
  originalBuffer: Buffer,
  maskBuffer: Buffer,
  skyBuffer: Buffer,
  width: number,
  height: number
): Promise<Buffer> {
  // Convert mask to grayscale and threshold to create binary mask
  const maskImage = sharp(maskBuffer)
    .resize(width, height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 1 } })
    .grayscale()
    .normalize();

  // Ensure sky image is the right size
  const skyImage = sharp(skyBuffer)
    .resize(width, height, { fit: 'cover' });

  // Create the composite
  const result = await sharp(originalBuffer)
    .composite([
      {
        input: await skyImage.toBuffer(),
        blend: 'dest-over',
        mask: await maskImage.toBuffer(),
      },
    ])
    .toBuffer();

  return result;
}
