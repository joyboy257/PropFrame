'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Coins, Copy, Mail, UserMinus, RefreshCw, Crown, User, Plus } from 'lucide-react';

interface Member {
  id: string;
  userId: string;
  role: string;
  joinedAt: string;
  email: string;
  name: string | null;
  stats: { projectsCreated: number; clipsGenerated: number; creditsUsed: number };
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  token: string;
}

interface OrgData {
  id: string;
  name: string;
  plan: string;
  poolCredits: number;
  members: Member[];
  invitations: Invitation[];
}

function BuyOrgCreditsModal({ orgId, onClose }: { orgId: string; onClose: () => void }) {
  const [loading, setLoading] = useState<number | null>(null);
  const [currency, setCurrency] = useState<'USD' | 'SGD'>('SGD');

  const config = currency === 'SGD' ? [
    { sgd: 19, credits: 23750, label: 'S$19', bonus: 0 },
    { sgd: 49, credits: 75000, label: 'S$49', bonus: 8750 },
    { sgd: 149, credits: 187500, label: 'S$149', bonus: 52500 },
  ] : [
    { dollars: 20, credits: 25000, label: '$20', bonus: 0 },
    { dollars: 50, credits: 62500, label: '$50', bonus: 12500 },
    { dollars: 100, credits: 130000, label: '$100', bonus: 30000 },
  ];

  const handlePurchase = async (pkg: typeof config[0]) => {
    setLoading(currency === 'SGD' ? pkg.sgd : pkg.dollars);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          dollars: currency === 'USD' ? pkg.dollars : undefined,
          sgd: currency === 'SGD' ? pkg.sgd : undefined,
          currency,
          orgId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to start checkout');
        setLoading(null);
        return;
      }
      const { url } = await res.json();
      if (url) {
        window.location.href = url;
      } else {
        toast.error('No checkout URL returned');
        setLoading(null);
      }
    } catch {
      toast.error('Network error. Please try again.');
      setLoading(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-lg mx-4 rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shadow-2xl">
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-white">Buy Pool Credits</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 pb-4">
          <div className="flex items-center gap-1 p-1 bg-slate-800 rounded-lg w-fit">
            <button
              onClick={() => setCurrency('SGD')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                currency === 'SGD' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              SGD
            </button>
            <button
              onClick={() => setCurrency('USD')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                currency === 'USD' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              USD
            </button>
          </div>
        </div>

        <div className="px-6 pb-6 space-y-3">
          {config.map((pkg, i) => (
            <div
              key={pkg.label}
              className={`relative flex items-center justify-between p-4 rounded-xl border transition-colors ${
                i === 1 ? 'bg-blue-600/10 border-blue-500/40' : 'bg-slate-800/50 border-slate-700'
              }`}
            >
              {i === 1 && (
                <div className="absolute -top-2.5 left-4 px-2 py-0.5 bg-blue-500 rounded text-xs font-medium text-white">
                  Most Popular
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white text-base">
                    {pkg.credits.toLocaleString()} credits
                  </span>
                  {pkg.bonus > 0 && (
                    <span className="text-xs text-emerald-400 font-medium">
                      +{pkg.bonus.toLocaleString()} bonus
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {pkg.label}
                </div>
              </div>
              <Button
                variant={i === 1 ? 'primary' : 'secondary'}
                size="sm"
                loading={loading === (currency === 'SGD' ? pkg.sgd : pkg.dollars)}
                onClick={() => handlePurchase(pkg as typeof config[0])}
              >
                {pkg.label}
              </Button>
            </div>
          ))}
        </div>

        <div className="px-6 pb-5 flex items-center justify-center gap-1.5 text-xs text-slate-600">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>Secured by Stripe. No subscription. Never expires.</span>
        </div>
      </div>
    </div>
  );
}

interface OrgSettingsClientProps {
  org: OrgData;
  currentUserId: string;
}

export function OrgSettingsClient({ org, currentUserId }: OrgSettingsClientProps) {
  const router = useRouter();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'agent' | 'director'>('agent');
  const [inviting, setInviting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [showBuyCredits, setShowBuyCredits] = useState(false);

  const isDirector = org.members.some(m => m.userId === currentUserId && m.role === 'director');

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const res = await fetch(`/api/organizations/${org.id}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to send invitation');
      } else {
        toast.success(`Invitation sent to ${inviteEmail}`);
        setInviteEmail('');
        router.refresh();
      }
    } finally {
      setInviting(false);
    }
  }

  async function handleRemoveMember(memberId: string, memberEmail: string) {
    setRemovingId(memberId);
    try {
      const res = await fetch(`/api/organizations/${org.id}/members/${memberId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to remove member');
      } else {
        toast.success(`${memberEmail} removed from team`);
        router.refresh();
      }
    } finally {
      setRemovingId(null);
    }
  }

  async function handleRevokeInvitation(invitationId: string) {
    setRevokingId(invitationId);
    try {
      const res = await fetch(`/api/organizations/${org.id}/invitations/${invitationId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to revoke invitation');
      } else {
        toast.success('Invitation revoked');
        router.refresh();
      }
    } finally {
      setRevokingId(null);
    }
  }

  function copyInviteLink(token: string) {
    const url = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(url);
    toast.success('Invite link copied to clipboard');
  }

  const pendingInvitations = org.invitations.filter(i => i.status === 'pending');

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{org.name}</h1>
          <p className="text-sm text-slate-500 mt-1 capitalize">{org.plan} plan</p>
        </div>
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-4 py-2">
          <Coins className="w-4 h-4 text-emerald-400" />
          <span className="text-sm text-slate-400">Pool:</span>
          <span className="text-lg font-bold text-white font-mono">{org.poolCredits.toLocaleString()}</span>
          <span className="text-xs text-slate-500">credits</span>
        </div>
        {isDirector && (
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => setShowBuyCredits(true)}
          >
            <Plus className="w-3 h-3" />
            Buy Credits
          </Button>
        )}
      </div>

      {/* Team Members */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg">
        <div className="px-4 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="font-semibold text-white">Team Members</h2>
        </div>
        <div className="divide-y divide-slate-800">
          {org.members.map(member => (
            <div key={member.id} className="px-4 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center">
                  {member.role === 'director' ? (
                    <Crown className="w-4 h-4 text-amber-400" />
                  ) : (
                    <User className="w-4 h-4 text-slate-400" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">
                      {member.name || member.email}
                    </span>
                    {member.userId === currentUserId && (
                      <span className="text-xs text-slate-500">(you)</span>
                    )}
                    <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${
                      member.role === 'director'
                        ? 'bg-amber-500/10 text-amber-400'
                        : 'bg-slate-700 text-slate-400'
                    }`}>
                      {member.role}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">{member.email}</div>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right hidden md:block">
                  <div className="text-xs text-slate-500">Projects / Clips / Credits</div>
                  <div className="text-sm text-slate-300 font-mono">
                    {member.stats.projectsCreated} / {member.stats.clipsGenerated} / {member.stats.creditsUsed}
                  </div>
                </div>
                {isDirector && member.userId !== currentUserId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-400 hover:text-red-300"
                    onClick={() => handleRemoveMember(member.id, member.email)}
                    disabled={removingId === member.id}
                  >
                    <UserMinus className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Invite Agent */}
      {isDirector && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg">
          <div className="px-4 py-4 border-b border-slate-800">
            <h2 className="font-semibold text-white">Invite Team Member</h2>
          </div>
          <div className="p-4">
            <form onSubmit={handleInvite} className="flex gap-3">
              <input
                type="email"
                placeholder="agent@agency.com"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-slate-600"
                required
              />
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value as 'agent' | 'director')}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-slate-600"
              >
                <option value="agent">Agent</option>
                <option value="director">Director</option>
              </select>
              <Button type="submit" disabled={inviting} className="gap-2">
                <Mail className="w-4 h-4" />
                {inviting ? 'Sending...' : 'Invite'}
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Pending Invitations */}
      {isDirector && pendingInvitations.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg">
          <div className="px-4 py-4 border-b border-slate-800">
            <h2 className="font-semibold text-white">Pending Invitations</h2>
          </div>
          <div className="divide-y divide-slate-800">
            {pendingInvitations.map(inv => (
              <div key={inv.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="text-sm text-white">{inv.email}</div>
                  <div className="text-xs text-slate-500">
                    Expires {new Date(inv.expiresAt).toLocaleDateString('en-SG', { timeZone: 'Asia/Singapore', month: 'short', day: 'numeric', year: 'numeric' })} · {inv.role}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-slate-400"
                    onClick={() => copyInviteLink(inv.token)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-400"
                    onClick={() => handleRevokeInvitation(inv.id)}
                    disabled={revokingId === inv.id}
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Buy Org Credits Modal */}
      {showBuyCredits && (
        <BuyOrgCreditsModal orgId={org.id} onClose={() => setShowBuyCredits(false)} />
      )}
    </div>
  );
}
