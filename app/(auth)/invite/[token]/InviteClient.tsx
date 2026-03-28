'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Crown, User, CheckCircle, XCircle } from 'lucide-react';

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  orgId: string;
  orgName: string;
}

interface CurrentUser {
  id: string;
  email: string;
}

interface InviteClientProps {
  invitation: Invitation;
  currentUser: CurrentUser | null;
  token: string;
}

export function InviteClient({ invitation, currentUser, token }: InviteClientProps) {
  const router = useRouter();
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState('');
  const [accepted, setAccepted] = useState(false);

  const isExpired = new Date(invitation.expiresAt) <= new Date();
  const isPending = invitation.status === 'pending';
  const emailMatches = currentUser?.email.toLowerCase() === invitation.email.toLowerCase();
  const isAlreadyMember = invitation.status === 'accepted';

  async function handleAccept() {
    if (!currentUser) {
      // Redirect to login with return URL
      router.push(`/auth/login?redirect=/invite/${token}`);
      return;
    }

    setAccepting(true);
    setError('');

    try {
      const res = await fetch(`/api/organizations/${invitation.orgId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }), // 'token' prop = URL nanoid = invite token
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to accept invitation');
      } else {
        setAccepted(true);
        setTimeout(() => {
          router.push(`/dashboard/org/${invitation.orgId}`);
        }, 1500);
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setAccepting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 max-w-md w-full">
        {/* Status icon */}
        <div className="flex justify-center mb-6">
          {isAlreadyMember ? (
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
          ) : isExpired || !isPending ? (
            <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <XCircle className="w-8 h-8 text-red-400" />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
              {invitation.role === 'director' ? (
                <Crown className="w-8 h-8 text-amber-400" />
              ) : (
                <User className="w-8 h-8 text-slate-400" />
              )}
            </div>
          )}
        </div>

        {/* Org name */}
        <div className="text-center mb-6">
          <p className="text-sm text-slate-500 uppercase tracking-wider mb-1">Invitation to join</p>
          <h1 className="text-2xl font-bold text-white">{invitation.orgName}</h1>
          <p className="text-sm text-slate-400 mt-1">
            as{' '}
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
              invitation.role === 'director'
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                : 'bg-slate-700 text-slate-300'
            }`}>
              {invitation.role === 'director' ? <Crown className="w-3 h-3" /> : <User className="w-3 h-3" />}
              {invitation.role}
            </span>
          </p>
        </div>

        {/* Email info */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 mb-6">
          <p className="text-xs text-slate-500 mb-1">Invited email</p>
          <p className="text-sm text-white font-medium">{invitation.email}</p>
        </div>

        {/* Status-specific content */}
        {isAlreadyMember ? (
          <div className="text-center">
            <p className="text-emerald-400 text-sm mb-4">You are already a member of this organization.</p>
            <Link href={`/dashboard/org/${invitation.orgId}`}>
              <Button className="w-full gap-2">
                Go to Organization
              </Button>
            </Link>
          </div>
        ) : isExpired || !isPending ? (
          <div className="text-center">
            <p className="text-red-400 text-sm mb-4">
              {!isPending ? 'This invitation has already been used.' : 'This invitation has expired.'}
            </p>
            <p className="text-slate-500 text-xs">Ask your team director for a new invitation.</p>
          </div>
        ) : !currentUser ? (
          /* Not logged in */
          <div className="space-y-3">
            <p className="text-sm text-slate-400 text-center mb-4">
              Sign in or create an account to accept this invitation.
            </p>
            <Link href={`/auth/login?redirect=/invite/${token}`}>
              <Button className="w-full gap-2">
                Sign In
              </Button>
            </Link>
            <Link href={`/auth/signup?redirect=/invite/${token}`}>
              <Button variant="outline" className="w-full gap-2">
                Create Account
              </Button>
            </Link>
          </div>
        ) : emailMatches ? (
          /* Logged in + email matches */
          <div className="space-y-3">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
                {error}
              </div>
            )}
            {accepted ? (
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 text-emerald-400 mb-4">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">Invitation accepted!</span>
                </div>
                <p className="text-slate-400 text-sm">Redirecting you to your organization...</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-slate-400 text-center mb-4">
                  Accept this invitation to join <strong className="text-white">{invitation.orgName}</strong> as an {invitation.role}.
                </p>
                <Button
                  onClick={handleAccept}
                  loading={accepting}
                  className="w-full gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Accept Invitation
                </Button>
              </>
            )}
          </div>
        ) : (
          /* Logged in but wrong email */
          <div className="text-center">
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400 mb-4">
              This invitation was sent to <strong>{invitation.email}</strong>, but you are signed in as <strong>{currentUser.email}</strong>.
            </div>
            <p className="text-slate-500 text-xs">
              Sign in with the correct email address, or ask your team director for a new invitation.
            </p>
          </div>
        )}

        {/* Expiry info */}
        {isPending && !isExpired && (
          <p className="text-xs text-slate-600 text-center mt-6">
            Expires {new Date(invitation.expiresAt).toLocaleDateString('en-SG', { timeZone: 'Asia/Singapore', month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        )}
      </div>
    </div>
  );
}
