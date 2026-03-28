'use client';

import { useState } from 'react';
import { X, Loader2, Check, Coins } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';
import { USD_CREDIT_PACKAGES, SGD_CREDIT_PACKAGES } from '@/lib/credits';

type Currency = 'USD' | 'SGD';

const CURRENCY_CONFIG = {
  USD: {
    packages: USD_CREDIT_PACKAGES.map((pkg, i) => ({
      ...pkg,
      label: pkg.label,
      popular: i === 1,
      price: `$${pkg.dollars}`,
      perCredit: `$${(pkg.dollars / (pkg.credits + pkg.bonus)).toFixed(3)}/credit`,
    })),
    symbol: '$',
  },
  SGD: {
    packages: SGD_CREDIT_PACKAGES.map((pkg, i) => ({
      ...pkg,
      label: pkg.label,
      popular: i === 1,
      price: `S$${pkg.sgd}`,
      perCredit: `S$${(pkg.sgd / (pkg.credits + pkg.bonus)).toFixed(3)}/credit`,
    })),
    symbol: 'S$',
  },
} as const;

interface BuyCreditsModalProps {
  onClose: () => void;
  onSuccess?: (credits: number) => void;
}

export function BuyCreditsModal({ onClose, onSuccess }: BuyCreditsModalProps) {
  const [currency, setCurrency] = useState<Currency>('USD');
  const [loading, setLoading] = useState<number | null>(null);

  const config = CURRENCY_CONFIG[currency];
  const packages = config.packages;

  const handlePurchase = async (pkg: typeof packages[0]) => {
    setLoading(currency === 'USD' ? pkg.dollars : pkg.sgd);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          dollars: currency === 'USD' ? pkg.dollars : undefined,
          sgd: currency === 'SGD' ? pkg.sgd : undefined,
          currency,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Failed to start checkout');
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
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-white">Buy Credits</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Currency Toggle */}
        <div className="px-6 pb-4">
          <div className="flex items-center gap-1 p-1 bg-slate-800 rounded-lg w-fit">
            <button
              onClick={() => setCurrency('USD')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                currency === 'USD'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              USD
            </button>
            <button
              onClick={() => setCurrency('SGD')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                currency === 'SGD'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              SGD
            </button>
          </div>
        </div>

        {/* Packages */}
        <div className="px-6 pb-6 space-y-3">
          {packages.map((pkg) => (
            <div
              key={pkg.label}
              className={`relative flex items-center justify-between p-4 rounded-xl border transition-colors ${
                pkg.popular
                  ? 'bg-blue-600/10 border-blue-500/40'
                  : 'bg-slate-800/50 border-slate-700'
              }`}
            >
              {pkg.popular && (
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
                  {pkg.price} — {pkg.perCredit}
                </div>
              </div>

              <Button
                variant={pkg.popular ? 'primary' : 'secondary'}
                size="sm"
                loading={loading === (currency === 'USD' ? pkg.dollars : pkg.sgd)}
                onClick={() => handlePurchase(pkg)}
              >
                {pkg.price}
              </Button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex items-center justify-center gap-1.5 text-xs text-slate-600">
          <Check className="w-3 h-3" />
          <span>Secured by Stripe. No subscription. Never expires.</span>
        </div>
      </div>
    </div>
  );
}
