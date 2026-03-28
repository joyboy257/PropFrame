import { NextRequest, NextResponse } from 'next/server';
import { getUserByEmail, createUser, createSession } from '@/lib/db/auth';
import { checkRateLimit, getClientIp } from '@/lib/ratelimit';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  // Rate limit check
  const ip = getClientIp(req);
  const { allowed, retryAfter } = checkRateLimit(ip);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: { 'Retry-After': String(retryAfter) },
      }
    );
  }

  try {
    const { email, name } = await req.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existing = await getUserByEmail(normalizedEmail);
    if (existing) {
      return NextResponse.json({ error: 'Account already exists' }, { status: 409 });
    }

    // Create new user
    const user = await createUser(normalizedEmail, name || null);

    // Create session
    const { token, expiresAt } = await createSession(user.id);

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, credits: user.credits },
    });

    response.cookies.set('session_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
