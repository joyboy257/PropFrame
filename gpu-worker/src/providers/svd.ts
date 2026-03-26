/**
 * Stable Video Diffusion (SVD) provider.
 *
 * SVD is self-hosted on Modal.com — a Python GPU runtime.
 * The worker (Node.js) calls the Modal endpoint over HTTP.
 *
 * Setup:
 *   1. Deploy the SVD Modal app from gpu-worker/src/providers/svd_modal_app.py
 *   2. Set MODAL_SVD_ENDPOINT in your .env to your Modal endpoint URL
 *   3. Set MODAL_SVD_API_TOKEN for authentication
 *
 * SVD model: stabilityai/stable-video-diffusion-img2vid
 * Output: 14-25 frames (~2.5-4s at 24fps) at 1024×576
 * VRAM: 12-16GB recommended
 *
 * Quality note: shorter and lower resolution than Runway.
 * Best for: subtle interior motion, free-tier fallback.
 */

import { VideoProvider, VideoGenerateOpts, JobStatus } from './index.js';
import { logger } from '../logger.js';

export class SVDProvider implements VideoProvider {
  readonly name = 'svd';
  readonly isSelfHosted = true;

  private endpoint: string;
  private apiToken: string;

  constructor() {
    this.endpoint = process.env.MODAL_SVD_ENDPOINT ?? '';
    this.apiToken = process.env.MODAL_SVD_API_TOKEN ?? '';
    if (!this.endpoint) {
      throw new Error('MODAL_SVD_ENDPOINT is not set — deploy svd_modal_app.py first');
    }
  }

  private headers() {
    return {
      'Authorization': `Bearer ${this.apiToken}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Submit an SVD generation job.
   * The Modal endpoint accepts an image URL and queues the job.
   */
  async generate(opts: VideoGenerateOpts): Promise<{ jobId: string; estimatedTime?: number }> {
    const { imageUrl, prompt } = opts;

    logger.info(`[SVD] Submitting job — prompt: "${prompt}"`);

    const response = await fetch(`${this.endpoint}/generate`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        image_url: imageUrl,
        prompt, // passed through for logging/selection
        // SVD outputs ~14-25 frames at 24fps — can't specify duration directly
        // Map to num_frames: 25fps * duration → capped at 25 frames
        num_frames: 25,
        // Default 24fps, can also set 30
        fps: 24,
        // Motion magnitude — 0.0 (static) to 1.0 (dramatic), default 0.5
        motion_bucket_id: 127,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`SVD generate failed (${response.status}): ${body}`);
    }

    const data = await response.json() as { job_id: string; estimated_time?: number };
    return {
      jobId: data.job_id,
      estimatedTime: data.estimated_time,
    };
  }

  /**
   * Poll job status from the Modal endpoint.
   */
  async poll(jobId: string): Promise<JobStatus> {
    const response = await fetch(`${this.endpoint}/status/${jobId}`, {
      method: 'GET',
      headers: this.headers(),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`SVD poll failed (${response.status}): ${body}`);
    }

    const data = await response.json() as { status: string };

    // Normalize to our JobStatus
    const status: JobStatus =
      data.status === 'completed'  ? 'done'      :
      data.status === 'failed'    ? 'error'     :
      data.status === 'running'   ? 'processing' :
                                     'pending';

    return status;
  }

  /**
   * Download completed video from the Modal endpoint.
   */
  async download(jobId: string): Promise<Buffer> {
    const response = await fetch(`${this.endpoint}/download/${jobId}`, {
      method: 'GET',
      headers: this.headers(),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`SVD download failed (${response.status}): ${body}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
