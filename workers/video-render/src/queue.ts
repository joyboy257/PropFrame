import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { ClipJob, CLIP_QUEUE_NAME } from './types.js';

// ─── Redis connection ────────────────────────────────────────────────────────

function createRedisInstance(): Redis {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  return new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });
}

let _connection: Redis | null = null;

export function getRedisConnection(): Redis {
  if (!_connection) {
    _connection = createRedisInstance();
  }
  return _connection;
}

// ─── Queue ────────────────────────────────────────────────────────────────────

let _queue: Queue<ClipJob> | null = null;

export function getClipQueue(): Queue<ClipJob> {
  if (!_queue) {
    if (!_connection) {
      _connection = createRedisInstance();
    }
    _queue = new Queue<ClipJob>(CLIP_QUEUE_NAME, {
      connection: _connection,
      defaultJobOptions: {
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 30000,
        },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 1000 },
      },
    });
  }
  return _queue;
}

// ─── Enqueue ──────────────────────────────────────────────────────────────────

export async function enqueueClipJob(job: ClipJob): Promise<string> {
  const queue = getClipQueue();
  const result = await queue.add(
    `clip-${job.clipId}`,
    job,
    {
      jobId: job.clipId, // use clipId as the job ID for idempotency
    }
  );
  return result.id ?? job.clipId;
}

// ─── Graceful shutdown ────────────────────────────────────────────────────────

export async function closeQueue(): Promise<void> {
  if (_queue) {
    await _queue.close();
    _queue = null;
  }
  if (_connection) {
    await _connection.quit();
    _connection = null;
  }
}
