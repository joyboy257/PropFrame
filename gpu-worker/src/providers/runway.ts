/**
 * RunwayML Gen-3 API provider.
 *
 * Docs: https://docs.runwayml.com/
 * Console: https://account.runwayml.com/
 *
 * Set RUNWAY_API_KEY in your .env to your API key from the Runway console.
 * Free tier: 125 credits — enough to build and test the full integration.
 */

import { VideoProvider, VideoGenerateOpts, JobStatus } from './index.js';
import { logger } from '../logger.js';

const BASE_URL = 'https://api.runwayml.com/v1';

export class RunwayProvider implements VideoProvider {
  readonly name = 'runway';
  readonly isSelfHosted = false;

  private apiKey: string;

  constructor() {
    this.apiKey = process.env.RUNWAY_API_KEY ?? '';
    if (!this.apiKey) {
      throw new Error('RUNWAY_API_KEY is not set');
    }
  }

  private headers() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Submit a video generation job.
   * Returns immediately with a jobId for polling.
   *
   * Endpoint confirmed: POST https://api.runwayml.com/v1/image_to_video
   * (Exact Gen-3 endpoint subject to change — verify in Runway console.)
   */
  async generate(opts: VideoGenerateOpts): Promise<{ jobId: string; estimatedTime?: number }> {
    const { imageUrl, prompt, duration = 5 } = opts;

    // Clamp to Runway's max of 10 seconds
    const clampedDuration = Math.min(duration, 10);

    // TODO: confirm exact endpoint from Runway console
    // Known from research: Gen-3 image_to_video endpoint
    const endpoint = `${BASE_URL}/image_to_video`;

    logger.info(`[Runway] Submitting job — prompt: "${prompt}", duration: ${clampedDuration}s`);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        // Runway accepts a URL to the source image
        image_url: imageUrl,
        prompt,
        // Gen-3 supports duration parameter
        duration: clampedDuration,
        // Model defaults to latest Gen-3
        model: 'gen3a_turbo', // or 'gen3a' for higher quality (slower)
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Runway generate failed (${response.status}): ${body}`);
    }

    // Runway returns { id: string, status: string, ... }
    const data = await response.json() as { id: string; estimated_completion_time?: number };

    logger.info(`[Runway] Job queued — id: ${data.id}`);

    return {
      jobId: data.id,
      estimatedTime: data.estimated_completion_time,
    };
  }

  /**
   * Poll job status.
   * Endpoint: GET https://api.runwayml.com/v1/jobs/:id
   */
  async poll(jobId: string): Promise<JobStatus> {
    const endpoint = `${BASE_URL}/jobs/${jobId}`;

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: this.headers(),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Runway poll failed (${response.status}): ${body}`);
    }

    // Runway job statuses: 'pending' | 'running' | 'succeeded' | 'failed'
    const data = await response.json() as { status: string };

    const status: JobStatus =
      data.status === 'succeeded'  ? 'done'      :
      data.status === 'failed'     ? 'error'     :
      data.status === 'running'   ? 'processing' :
                                     'pending';

    return status;
  }

  /**
   * Download completed video.
   * After 'done' status, fetch the output URL and download.
   * Endpoint: GET https://api.runwayml.com/v1/jobs/:id
   */
  async download(jobId: string): Promise<Buffer> {
    const endpoint = `${BASE_URL}/jobs/${jobId}`;

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: this.headers(),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Runway download metadata failed (${response.status}): ${body}`);
    }

    // Runway job response includes { artifacts: [{ type: "video", url: "..." }] }
    const data = await response.json() as {
      status: string;
      artifacts?: Array<{ type: string; url: string }>;
    };

    if (data.status !== 'succeeded') {
      throw new Error(`Runway job not complete: ${data.status}`);
    }

    const videoArtifact = data.artifacts?.find(a => a.type === 'video');
    if (!videoArtifact?.url) {
      throw new Error('Runway job succeeded but no video artifact found');
    }

    // Download the actual video file
    const videoResponse = await fetch(videoArtifact.url);
    if (!videoResponse.ok) {
      throw new Error(`Failed to download Runway video (${videoResponse.status})`);
    }

    const arrayBuffer = await videoResponse.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
