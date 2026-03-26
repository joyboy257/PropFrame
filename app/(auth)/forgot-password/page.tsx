'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    setDone(true);
    setLoading(false);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-8">
      <h1 className="text-2xl font-bold text-white mb-2">Reset your password</h1>
      <p className="text-slate-400 text-sm mb-6">
        Enter your email and we'll send you a reset link.
      </p>

      {done ? (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-sm text-emerald-400">
          Check your email. If an account exists, you'll receive a password reset link.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
          <Button type="submit" className="w-full" loading={loading}>
            Send reset link
          </Button>
        </form>
      )}

      <div className="mt-6 text-center text-sm text-slate-500">
        Remember your password?{' '}
        <Link href="/auth/login" className="text-blue-400 hover:text-blue-300 transition-colors">
          Log in
        </Link>
      </div>
    </div>
  );
}
