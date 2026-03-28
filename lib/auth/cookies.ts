import { type NextRequest } from 'next/server';

export function getSessionToken(req: NextRequest): string | null {
  return (
    req.cookies.get('session_token')?.value ??
    req.cookies.get('dev_token')?.value ?? // backward compat for existing sessions
    null
  );
}
