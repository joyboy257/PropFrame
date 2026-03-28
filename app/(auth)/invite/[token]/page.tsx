import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken, getUserById } from '@/lib/db/auth';
import { InviteClient } from './InviteClient';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function InvitePage({ params }: PageProps) {
  const { token } = await params;

  const cookieStore = cookies();
  const sessionToken = cookieStore.get('session_token')?.value || cookieStore.get('dev_token')?.value;

  let currentUser = null;
  if (sessionToken) {
    const payload = verifyToken(sessionToken);
    if (payload) {
      currentUser = await getUserById(payload.userId);
    }
  }

  // Fetch invitation details (public endpoint, no auth required)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const invRes = await fetch(`${baseUrl}/api/invite/${token}`, {
    cache: 'no-store',
  });

  if (!invRes.ok) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 max-w-md w-full text-center">
          <div className="text-4xl mb-4">🔗</div>
          <h1 className="text-xl font-bold text-white mb-2">Invalid Invitation</h1>
          <p className="text-slate-400 text-sm">
            This invitation link is invalid or has expired. Ask your team director for a new one.
          </p>
        </div>
      </div>
    );
  }

  const { invitation } = await invRes.json();

  return (
    <InviteClient
      invitation={invitation}
      currentUser={currentUser ? { id: currentUser.id, email: currentUser.email } : null}
      token={token}
    />
  );
}
