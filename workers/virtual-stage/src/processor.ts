import type { VirtualStageJob } from './types.js';
import { getSignedDownloadUrl, uploadToR2 } from './r2.js';
import { stageRoom } from './staging.js';
import { markVirtualStageSuccess, markVirtualStageFailed } from './db.js';
import Replicate from 'replicate';

export async function processStageJob(job: VirtualStageJob): Promise<void> {
  const { photoId, userId, photoStorageKey } = job;

  console.log(JSON.stringify({
    job: 'virtual-stage',
    photoId,
    status: 'started',
  }));

  try {
    // 1. Get signed download URL for the original photo (for AI processing)
    const photoUrl = await getSignedDownloadUrl(photoStorageKey, 1800);

    // 2. Generate mask using RMBG-1.4 segmentation model
    const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN || '' });

    const maskOutput = await replicate.run('briaai/RMBG-1.4', {
      input: {
        model: 'RMBG-1.4',
        image: photoUrl,
      },
    }) as unknown as { image: string } | string;

    const maskUrl = typeof maskOutput === 'string' ? maskOutput : (maskOutput as { image: string }).image;

    // 3. Call Flux Fill Dev for virtual staging (inpainting)
    const { resultUrl } = await stageRoom(photoUrl, maskUrl);

    // 4. Download the staged result
    const stagedResponse = await fetch(resultUrl);
    if (!stagedResponse.ok) {
      throw new Error(`Failed to download staged result from ${resultUrl}: ${stagedResponse.status}`);
    }
    const stagedBuffer = Buffer.from(await stagedResponse.arrayBuffer());

    // 5. Upload result to R2: staged/{photoId}/{timestamp}.png
    const timestamp = Date.now();
    const stagedStorageKey = `staged/${photoId}/${timestamp}.png`;
    const stagedPublicUrl = await uploadToR2(stagedStorageKey, stagedBuffer, 'image/png');

    // 6. Update DB: set virtualStaged = true, store staged R2 key in publicUrl
    await markVirtualStageSuccess(photoId, stagedStorageKey);

    console.log(JSON.stringify({
      job: 'virtual-stage',
      photoId,
      status: 'done',
      resultUrl: stagedPublicUrl,
    }));
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';

    console.log(JSON.stringify({
      job: 'virtual-stage',
      photoId,
      status: 'error',
      error: errorMessage,
    }));

    // On error: set virtualStageStatus = 'failed'
    await markVirtualStageFailed(photoId);

    throw err;
  }
}
