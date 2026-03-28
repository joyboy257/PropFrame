import { NextRequest, NextResponse } from 'next/server';
import { getUserByEmail, createUser, createSession } from '@/lib/db/auth';
import { nanoid } from 'nanoid';
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
    const { email } = await req.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user exists
    let user = await getUserByEmail(normalizedEmail);

    if (!user) {
      // Create new user with $10 free credits (1000 cents = 1000 credits)
      user = await createUser(normalizedEmail);
    }

    // Create session
    const { token, expiresAt } = await createSession(user.id);

    const response = NextResponse.json({
      success: true,
      message: 'Magic link sent',
      email: normalizedEmail,
    });

    // Set session cookie
    response.cookies.set('session_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
