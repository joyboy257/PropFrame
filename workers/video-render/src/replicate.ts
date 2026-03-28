import type { MotionStyle, Resolution } from './types.js';
import { createCircuitBreaker } from '../../../../lib/circuitBreaker';

const BASE_URL = 'https://api.runwayml.com/v1';

function buildPrompt(motionStyle: MotionStyle, customPrompt: string | null): string {
  const stylePrompts: Record<MotionStyle, string> = {
    'push-in': 'smooth push-in towards subject, cinematic',
    'zoom-out': 'slow zoom out revealing room, cinematic',
    'pan-left': 'slow pan left revealing space, cinematic',
    'pan-right': 'slow pan right revealing space, cinematic',
    'custom': '',
  };

  const base = customPrompt?.trim() || stylePrompts[motionStyle];
  return `${base}, high quality, smooth motion, real estate photography`;
}

export interface VideoGenResult {
  videoUrl: string;
}

export interface GenerateClipParams {
  imageUrl: string;
  motionStyle: MotionStyle;
  customPrompt: string | null;
  resolution: Resolution;
}

/**
 * Generate a video clip from an image using Runway Gen-3.
 *
 * Runway Gen-3 outputs 1280×720 — significantly better than CogVideoX's 480p.
 * API: https://api.runwayml.com/v1/image_to_video
 */
export async function generateClipVideo(params: GenerateClipParams): Promise<VideoGenResult> {
  const { imageUrl, motionStyle, customPrompt } = params;

  const apiKey = process.env.RUNWAY_API_KEY;
  if (!apiKey) {
    throw new Error('RUNWAY_API_KEY is not set');
  }

  const prompt = buildPrompt(motionStyle, customPrompt);
  // Clamp to Runway's max of 10 seconds
  const duration = 10;

  const response = await fetch(`${BASE_URL}/image_to_video`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image_url: imageUrl,
      prompt,
      model: 'gen3a_turbo',
      duration,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Runway Gen-3 failed (${response.status}): ${body}`);
  }

  // Runway returns { id: string, status: string, estimated_completion_time?: number }
  const data = await response.json() as { id: string };

  // Poll until the job is done (Runway jobs are synchronous-ish but may take a few seconds)
  const videoUrl = await pollRunwayJob(data.id, apiKey);

  return { videoUrl };
}

async function pollRunwayJob(jobId: string, apiKey: string): Promise<string> {
  const maxWaitMs = 5 * 60 * 1000; // 5 minutes
  const start = Date.now();
  const pollInterval = 3000; // 3 seconds

  while (Date.now() - start < maxWaitMs) {
    const response = await fetch(`${BASE_URL}/jobs/${jobId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Runway poll failed (${response.status}): ${body}`);
    }

    const data = await response.json() as {
      status: string;
      artifacts?: Array<{ type: string; url: string }>;
    };

    if (data.status === 'succeeded') {
      const videoArtifact = data.artifacts?.find(a => a.type === 'video');
      if (!videoArtifact?.url) {
        throw new Error('Runway job succeeded but no video artifact found');
      }
      return videoArtifact.url;
    }

    if (data.status === 'failed') {
      throw new Error('Runway Gen-3 job failed');
    }

    // Wait before polling again
    await sleep(pollInterval);
  }

  throw new Error('Runway Gen-3 job timed out after 5 minutes');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Circuit breaker wrapper — shadows original to provide graceful Runway API degradation
export const generateClipVideo = createCircuitBreaker(generateClipVideo, {
  failureThreshold: 5,
  resetTimeout: 30_000,
  volumeThreshold: 3,
  timeout: 120_000,
}) as typeof generateClipVideo;
