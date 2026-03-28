import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Redis-backed rate limiter using @upstash/ratelimit.
 * Effective in serverless environments (Vercel) where in-memory state resets on cold start.
 * Falls back to allow-all when UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are not set.
 */
const ratelimit = (() => {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl || !redisToken) {
    console.warn('[ratelimit] Redis env vars not set — rate limiting disabled');
    return null;
  }

  const redis = new Redis({ url: redisUrl, token: redisToken });
  return new Ratelimit({
    redis,
    limiter: 'sliding_window',
    windowMs: 60_000, // 1 minute
    max: 5, // 5 requests per window per IP
  });
})();

/**
 * Check if the given IP has exceeded the rate limit.
 * Returns { allowed: true } if the request is allowed.
 * Returns { allowed: false, retryAfter: seconds } if rate limited.
 */
export async function checkRateLimit(ip: string): Promise<{ allowed: boolean; retryAfter?: number }> {
  // Fallback when Redis is not configured
  if (!ratelimit) {
    return { allowed: true };
  }

  const result = await ratelimit.limit(ip);
  if (!result.success) {
    return { allowed: false, retryAfter: Math.ceil((result.reset - Date.now()) / 1000) };
  }
  return { allowed: true };
}

/**
 * Extract client IP from NextRequest headers.
 * Handles proxies (Vercel, Cloudflare, etc.)
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  return 'unknown';
}
