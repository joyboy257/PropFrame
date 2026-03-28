// DEPRECATED: This file contains reference implementations of auth patterns. Actual auth is per-route: getSessionToken() + verifyToken().
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/db/auth';

export function authMiddleware(request: NextRequest) {
  // Skip auth for non-app routes
  if (!request.nextUrl.pathname.startsWith('/ai')) {
    return null;
  }

  const token = request.cookies.get('session_token')?.value;
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return NextResponse.json({ error: 'Session expired' }, { status: 401 });
  }

  return payload; // { userId, tokenId }
}
