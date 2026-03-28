import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import Redis from 'ioredis';

export const runtime = 'nodejs';

// Module-level singleton — persists across requests
let redisInstance: Redis | null = null;

function getRedis(): Redis {
  if (!redisInstance) {
    redisInstance = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }
  return redisInstance;
}

// GET /api/health — health check for Singapore launch readiness
export async function GET(req: NextRequest) {
  const checks: Record<string, { status: 'ok' | 'error'; error?: string }> = {};

  // Check DB connectivity
  try {
    await db.select({ id: users.id }).from(users).limit(1);
    checks.db = { status: 'ok' };
  } catch (err) {
    checks.db = { status: 'error', error: err instanceof Error ? err.message : 'Database connection failed' };
  }

  // Check Redis/worker connectivity
  try {
    const redis = getRedis();
    await redis.ping();
    checks.redis = { status: 'ok' };
  } catch (err) {
    checks.redis = { status: 'error', error: err instanceof Error ? err.message : 'Redis connection failed' };
  }

  // Determine overall status
  const allHealthy = Object.values(checks).every((c) => c.status === 'ok');

  if (allHealthy) {
    return NextResponse.json({ status: 'ok' });
  } else {
    return NextResponse.json({ status: 'error', checks }, { status: 503 });
  }
}
