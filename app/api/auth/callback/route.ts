import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken, getUserById, createSession, createUser } from '@/lib/db/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const action = searchParams.get('action'); // 'login' | 'signup'
  const email = searchParams.get('email');

  if (!token || !action) {
    redirect('/auth/login?error=invalid_callback');
  }

  // Verify token (in production: cryptographically verify the magic link token)
  // For now, the token IS the session token — the email link contains it
  const payload = verifyToken(token);
  if (!payload) {
    redirect('/auth/login?error=session_expired');
  }

  const user = await getUserById(payload.userId);
  if (!user) {
    redirect('/auth/login?error=user_not_found');
  }

  // Create a response that redirects to dashboard
  const response = NextResponse.redirect(
    action === 'signup'
      ? new URL('/ai/dashboard', request.url)
      : new URL('/ai/dashboard', request.url)
  );

  // Set session cookie
  response.cookies.set('session_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });

  return response;
}
