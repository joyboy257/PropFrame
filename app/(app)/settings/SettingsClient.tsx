'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Settings, User, CreditCard, AlertTriangle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface UserData {
  id: string;
  email: string;
  name: string | null;
  plan: string;
  credits: number;
  stripeCustomerId: string | null;
  createdAt: string;
}

interface SettingsClientProps {
  user: UserData;
}

export function SettingsClient({ user }: SettingsClientProps) {
  const [name, setName] = useState(user.name || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSaveName = async () => {
    if (!name.trim()) {
      setSaveMessage({ type: 'error', text: 'Name cannot be empty' });
      return;
    }

    setIsSaving(true);
    setSaveMessage(null);

    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update name');
      }

      setSaveMessage({ type: 'success', text: 'Name updated successfully' });
    } catch (err) {
      setSaveMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to update name' });
    } finally {
      setIsSaving(false);
    }
  };

  const memberSince = new Date(user.createdAt).toLocaleDateString('en-SG', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const stripeIdDisplay = user.stripeCustomerId
    ? `****${user.stripeCustomerId.slice(-8)}`
    : 'Not connected';

  const planColors: Record<string, string> = {
    starter: 'bg-slate-700 text-slate-300',
    pro: 'bg-blue-600 text-white',
    scale: 'bg-purple-600 text-white',
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Back link */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-300 transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </Link>

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-slate-900 border border-slate-800 rounded-lg">
          <Settings className="w-5 h-5 text-slate-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage your account settings</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Account Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-4 h-4 text-slate-400" />
            <h2 className="text-lg font-semibold text-white">Account</h2>
          </div>

          <div className="space-y-4">
            {/* Email */}
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Email</label>
              <input
                type="email"
                value={user.email}
                readOnly
                className="h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-not-allowed opacity-75"
              />
            </div>

            {/* Name */}
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Name</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1"
                />
                <Button
                  variant="secondary"
                  onClick={handleSaveName}
                  loading={isSaving}
                  disabled={isSaving || name === (user.name || '')}
                >
                  Save
                </Button>
              </div>
              {saveMessage && (
                <p className={`text-xs mt-2 ${saveMessage.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {saveMessage.text}
                </p>
              )}
            </div>

            {/* Member since */}
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Member since</label>
              <p className="text-sm text-slate-300">{memberSince}</p>
            </div>
          </div>
        </div>

        {/* Billing Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-4 h-4 text-slate-400" />
            <h2 className="text-lg font-semibold text-white">Billing</h2>
          </div>

          <div className="space-y-4">
            {/* Plan */}
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Current plan</label>
              <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-medium capitalize ${planColors[user.plan] || planColors.starter}`}>
                {user.plan}
              </span>
            </div>

            {/* Credit Balance */}
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Credit balance</label>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-emerald-400 font-mono">
                  ${(user.credits / 100).toFixed(2)}
                </span>
                <Link href="/dashboard/billing">
                  <Button variant="secondary" size="sm">
                    Buy Credits
                  </Button>
                </Link>
              </div>
            </div>

            {/* Stripe Customer ID */}
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Stripe customer ID</label>
              <p className="text-sm text-slate-300 font-mono">{stripeIdDisplay}</p>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-slate-900 border border-red-900/50 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <h2 className="text-lg font-semibold text-white">Danger Zone</h2>
          </div>

          <div>
            <p className="text-sm text-slate-400 mb-3">
              Once you delete your account, there is no going back. Please contact support to delete your account.
            </p>
            <Button variant="danger" disabled>
              Delete Account
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
