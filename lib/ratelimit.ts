/**
 * Simple in-memory rate limiter for auth endpoints.
 * Limits to 5 requests per minute per IP address.
 *
 * Note: In serverless environments (Vercel), this state resets on each cold start.
 * For production at scale, consider @upstash/ratelimit with Redis.
 */

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 5;

// In-memory store: IP -> timestamp[] of requests
const requestLog = new Map<string, number[]>();

/**
 * Check if the given IP has exceeded the rate limit.
 * Returns { allowed: true } if the request is allowed.
 * Returns { allowed: false, retryAfter: seconds } if rate limited.
 */
export function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  const timestamps = requestLog.get(ip) ?? [];
  // Filter to only requests within the current window
  const recentRequests = timestamps.filter((ts) => ts > windowStart);

  if (recentRequests.length >= MAX_REQUESTS) {
    // Calculate when the oldest request in the window will expire
    const oldestTimestamp = Math.min(...recentRequests);
    const retryAfter = Math.ceil((oldestTimestamp + WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfter };
  }

  // Allow request and record it
  recentRequests.push(now);
  requestLog.set(ip, recentRequests);

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
