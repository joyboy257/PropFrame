import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/db/auth';
import { getSessionToken } from '@/lib/auth/cookies';

export const runtime = 'nodejs';

// GET /api/upload/mock?key=... — dev-only mock upload endpoint
// R2 is not configured, so we accept PUT uploads and store in memory.
// In production (with R2 configured) this route is never used.
export async function PUT(req: NextRequest) {
  const token = getSessionToken(req);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const key = searchParams.get('key');
  if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 });

  // In a real mock we'd store the body somewhere accessible.
  // Here we just consume it so the browser upload completes without error.
  try {
    await req.arrayBuffer();
    return new NextResponse(null, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
