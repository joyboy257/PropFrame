import { Queue } from 'bullmq';
import Redis from 'ioredis';
import type { SkyReplaceJob } from './types.js';

const SKY_REPLACE_QUEUE = 'propframe:sky-replace';

function createRedisInstance(): Redis {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  return new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

let _connection: Redis | null = null;
let _queue: Queue<SkyReplaceJob> | null = null;

export function getRedisConnection(): Redis {
  if (!_connection) {
    _connection = createRedisInstance();
  }
  return _connection;
}

export function getSkyReplaceQueue(): Queue<SkyReplaceJob> {
  if (!_queue) {
    _connection = createRedisInstance();
    _queue = new Queue<SkyReplaceJob>(SKY_REPLACE_QUEUE, {
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

export async function enqueueSkyReplaceJob(job: SkyReplaceJob): Promise<string> {
  const queue = getSkyReplaceQueue();
  const result = await queue.add(
    `sky-replace-${job.photoId}`,
    job,
    {
      jobId: `sky-replace-${job.photoId}`,
    }
  );
  return result.id ?? `sky-replace-${job.photoId}`;
}

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
