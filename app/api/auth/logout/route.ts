import { NextRequest, NextResponse } from 'next/server';
import { deleteSession } from '@/lib/db/auth';

export async function POST(req: NextRequest) {
  const token = req.cookies.get('session_token')?.value;

  if (token) {
    await deleteSession(token);
  }

  const response = NextResponse.json({ success: true });
  response.cookies.delete('session_token');
  response.cookies.delete('dev_token');

  return response;
}
