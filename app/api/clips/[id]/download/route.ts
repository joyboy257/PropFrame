import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/db/auth';
import { getPublicUrl } from '@/lib/r2';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  // In production: verify session + ownership
  const url = getPublicUrl(`clips/${params.id}.mp4`);
  return NextResponse.redirect(url);
}
