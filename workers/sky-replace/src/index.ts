import 'dotenv/config';
import { Worker } from 'bullmq';
import { getRedisConnection } from './queue.js';
import { processSkyReplaceJob } from './processor.js';
import type { SkyReplaceJob } from './types.js';

const connection = getRedisConnection();

const worker = new Worker<SkyReplaceJob>(
  'propframe:sky-replace',
  async (job) => {
    console.log(`Processing sky replace job ${job.id} for photo ${job.data.photoId}`);
    await processSkyReplaceJob(job.data);
    console.log(`Sky replace job ${job.id} completed.`);
  },
  {
    connection,
    concurrency: 2,
  }
);

worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed successfully`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err);
});

worker.on('error', (err) => {
  console.error('Worker error:', err);
});

console.log('Sky replace worker started. Listening for jobs...');

process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Closing worker...');
  await worker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Closing worker...');
  await worker.close();
  process.exit(0);
});
