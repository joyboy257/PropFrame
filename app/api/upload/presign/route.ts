import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/db/auth';
import { getSessionToken } from '@/lib/auth/cookies';
import { generatePresignedUploadUrl, generateStorageKey } from '@/lib/r2';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const token = getSessionToken(req);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { filename, contentType, type = 'photo' } = await req.json();

  if (!filename || !contentType) {
    return NextResponse.json({ error: 'filename and contentType required' }, { status: 400 });
  }

  const extension = filename.split('.').pop() || 'jpg';
  const key = generateStorageKey(payload.userId, type, filename.replace(/\.[^.]+$/, ''), extension);

  const { url } = await generatePresignedUploadUrl(key, contentType);

  return NextResponse.json({ uploadUrl: url, storageKey: key });
}
