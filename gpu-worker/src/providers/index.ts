/**
 * VideoProvider interface — implemented by Runway, SVD, CogVideoX, etc.
 * All providers share the same interface so the worker is provider-agnostic.
 */
import { RunwayProvider } from './runway.js';
import { SVDProvider } from './svd.js';

export interface VideoGenerateOpts {
  /** Public URL of the source photo in R2 */
  imageUrl: string;
  /** Text prompt guiding the motion/camera */
  prompt: string;
  /** Desired clip duration in seconds (provider may clamp) */
  duration?: number;
}

export interface VideoGenerateResult {
  /** Provider's job ID — stored in clips.job_id for polling */
  jobId: string;
  /** Estimated time until completion (seconds) */
  estimatedTime?: number;
}

export type JobStatus = 'pending' | 'processing' | 'done' | 'error';

export interface VideoProvider {
  /**
   * Submit a clip generation job.
   * Returns immediately with a jobId for polling.
   */
  generate(opts: VideoGenerateOpts): Promise<VideoGenerateResult>;

  /**
   * Check the status of a submitted job.
   */
  poll(jobId: string): Promise<JobStatus>;

  /**
   * Download the completed video as a Buffer.
   * Only valid when poll() returns 'done'.
   */
  download(jobId: string): Promise<Buffer>;

  /** Provider name — used for logs and feature flags. */
  readonly name: string;

  /** Whether this provider requires a GPU to run (self-hosted). */
  readonly isSelfHosted: boolean;
}

const PROVIDERS: Record<string, VideoProvider> = {
  runway: new RunwayProvider(),
  svd:    new SVDProvider(),
};

/**
 * Factory to pick a provider by name.
 * Throws if the provider name is unknown or its required env vars are missing.
 */
export function getProvider(name: string): VideoProvider {
  const provider = PROVIDERS[name];
  if (!provider) {
    const available = Object.keys(PROVIDERS);
    throw new Error(
      `Unknown video provider: "${name}". Available: ${available.join(', ')} or "none".`
    );
  }
  return provider;
}
