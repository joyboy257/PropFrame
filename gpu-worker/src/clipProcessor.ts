import { writeFile, readFile } from 'fs/promises';
import { execFileSync } from 'child_process';
import { join } from 'path';
import { tmpdir } from 'os';
import { logger } from './logger.js';
import { getProvider } from './providers/index.js';

const FFMPEG_PATH = process.env.FFMPEG_PATH ?? 'ffmpeg';
const FFPROBE_PATH = process.env.FFPROBE_PATH ?? 'ffprobe';

/**
 * Active video provider: runway, svd, or 'none' for ffmpeg-only fallback.
 * Set VIDEO_PROVIDER env var. Defaults to 'runway' if RUNWAY_API_KEY is present,
 * otherwise 'svd' if MODAL_SVD_ENDPOINT is present, else 'none'.
 */
function resolveProvider(): string {
  if (process.env.VIDEO_PROVIDER) return process.env.VIDEO_PROVIDER;
  if (process.env.RUNWAY_API_KEY) return 'runway';
  if (process.env.MODAL_SVD_ENDPOINT) return 'svd';
  return 'none';
}

export interface ClipJobInput {
  clipId: string;
  photoBuffer: Buffer;
  photoFilename: string;
  /** Public R2 URL of the photo — required for Runway/SVD (they accept a URL, not a buffer) */
  photoUrl: string;
  motionStyle: string;
  resolution: string;
  duration: number;
  customPrompt?: string;
}

// ── Ken Burns presets ───────────────────────────────────────────────
const KEN_BURNS_PRESETS: Record<string, { zoom: string; pan: string }> = {
  'push-in':     { zoom: '1.0,1.25',   pan: '0:0' },
  'pan-left':    { zoom: '1.0,1.2',    pan: 'w:0' },
  'pan-right':   { zoom: '1.0,1.2',    pan: '-w:0' },
  'pan-up':      { zoom: '1.0,1.2',    pan: '0:-h' },
  'pan-down':    { zoom: '1.0,1.2',    pan: '0:h' },
  'zoom-in':     { zoom: '1.0,1.4',    pan: '0:0' },
  'zoom-out':    { zoom: '1.4,1.0',    pan: '0:0' },
  'slow-zoom':   { zoom: '1.0,1.15',  pan: '0:0' },
};

// ── Resolution dimensions ───────────────────────────────────────────
const RESOLUTION_MAP: Record<string, string> = {
  '720p':  '1280:720',
  '1080p': '1920:1080',
  '4k':    '3840:2160',
};

const DEFAULT_RES = '1280:720';

// ── Main entry point ─────────────────────────────────────────────────
export async function processClipJob(input: ClipJobInput): Promise<Buffer> {
  const { clipId, photoBuffer, photoUrl, motionStyle, resolution, duration, customPrompt } = input;

  const preset = KEN_BURNS_PRESETS[motionStyle] ?? KEN_BURNS_PRESETS['push-in'];
  const scale = RESOLUTION_MAP[resolution] ?? DEFAULT_RES;
  const providerName = resolveProvider();

  const tmpDir = tmpdir();
  const inputPath = join(tmpDir, `input-${clipId}.jpg`);
  const outputPath = join(tmpDir, `output-${clipId}.mp4`);

  await writeFile(inputPath, photoBuffer);

  try {
    // Route through the active video provider
    if (providerName !== 'none') {
      const provider = getProvider(providerName);
      logger.info(`[clip ${clipId}] Using provider: ${provider.name}`);

      // Build motion prompt from style + custom prompt
      const motionPrompt = buildMotionPrompt(motionStyle, customPrompt);

      // 1. Submit generation job
      const { jobId } = await provider.generate({
        imageUrl: photoUrl,
        prompt: motionPrompt,
        duration,
      });
      logger.info(`[clip ${clipId}] Job submitted — ${provider.name}:${jobId}`);

      // 2. Poll until done (every 10s, max 5 minutes)
      const maxWait = 300_000; // 5 minutes
      const pollInterval = 10_000; // 10 seconds
      const deadline = Date.now() + maxWait;

      while (Date.now() < deadline) {
        const status = await provider.poll(jobId);
        if (status === 'done') break;
        if (status === 'error') throw new Error(`Provider job failed: ${jobId}`);
        logger.info(`[clip ${clipId}] Waiting... (${status})`);
        await sleep(pollInterval);
      }

      // 3. Download result
      const videoBuffer = await provider.download(jobId);
      logger.info(`[clip ${clipId}] Provider video downloaded (${(videoBuffer.length / 1024).toFixed(1)} KB)`);

      // 4. Run Ken Burns as post-pass on the AI output (adds the cinematic camera motion)
      //    The AI generates the motion; Ken Burns overlays the slow zoom/pan.
      //    If the output already matches the target resolution, skip re-encoding.
      const aiOutputPath = join(tmpDir, `ai-${clipId}.mp4`);
      await writeFile(aiOutputPath, videoBuffer);

      // Re-encode with Ken Burns overlay at target resolution
      runKenBurns(aiOutputPath, outputPath, preset, scale, duration, /* isFromAI */ true);
      const result = await readFile(outputPath);

      // Clean up AI output
      try { const { unlink } = await import('fs/promises'); await unlink(aiOutputPath); } catch { /* ignore */ }

      return result;
    }

    // No provider configured — pure ffmpeg Ken Burns fallback
    logger.info(`[clip ${clipId}] No video provider configured, using ffmpeg Ken Burns`);
    runKenBurns(inputPath, outputPath, preset, scale, duration, /* isFromAI */ false);
    const result = await readFile(outputPath);
    return result;

  } finally {
    // Clean up temp files
    try {
      const { unlink } = await import('fs/promises');
      await unlink(inputPath);
      await unlink(outputPath);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Build a motion prompt from the clip's motionStyle and optional customPrompt.
 * Maps PropFrame style names to natural language for the video model.
 */
function buildMotionPrompt(style: string, customPrompt?: string): string {
  const styleDescriptions: Record<string, string> = {
    'push-in':    'slow dolly push-in towards the room',
    'pan-left':   'slow pan left revealing the space',
    'pan-right':  'slow pan right revealing the space',
    'pan-up':     'slow pan up through the room',
    'pan-down':   'slow pan down through the room',
    'zoom-in':    'slow zoom in highlighting details',
    'zoom-out':   'slow zoom out showing context',
    'slow-zoom':  'cinematic slow zoom in',
  };

  const base = styleDescriptions[style] ?? 'slow cinematic camera movement through the space';

  if (customPrompt?.trim()) {
    return `${customPrompt.trim()}. ${base}.`;
  }

  return `Real estate photography. ${base}. Professional, high-end property showcase.`;
}

// ── Helpers ──────────────────────────────────────────────────────────
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Ken Burns via ffmpeg ─────────────────────────────────────────────
// zoompan filter: zoom in from 1.0→1.25 over the clip duration,
//                 with optional pan to add lateral movement.
// isFromAI: if true, input is already a video so use -i instead of -loop 1
function runKenBurns(
  inputPath: string,
  outputPath: string,
  preset: { zoom: string; pan: string },
  scale: string,
  duration: number,
  isFromAI = false,
): void {
  const [zoomStart, zoomEnd] = preset.zoom.split(',').map(Number);
  const frames = Math.round(duration * 25); // 25 fps

  // Build zoom/pan expression
  const zoomExpr = (
    `min(zoom+${((zoomEnd - zoomStart) / frames).toFixed(4)},${zoomEnd})`
  );

  // When input is a video (from AI), pipe it through without looping
  // When input is an image, use -loop 1
  const filterComplex = [
    `scale=${scale}`,
    `zoompan=z='${zoomExpr}':x=${preset.pan.split(':')[0]}:y=${preset.pan.split(':')[1]}:d=${frames}:s=${scale}`,
    `fps=25`,
    `settb=1/25`,
  ].join(',');

  const args = [
    '-hide_banner',
    '-loglevel', 'warning',
    '-y',
    ...(isFromAI ? ['-i', inputPath] : ['-loop', '1', '-i', inputPath]),
    '-filter_complex', filterComplex,
    '-t', String(duration),
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-pix_fmt', 'yuv420p',
    outputPath,
  ];

  logger.debug(`[ffmpeg] ${FFMPEG_PATH} ${args.join(' ')}`);

  try {
    execFileSync(FFMPEG_PATH, args, { stdio: 'pipe' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`ffmpeg Ken Burns failed: ${msg}`);
  }
}
