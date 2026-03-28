'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Check } from 'lucide-react';

const inclusions = [
  'High quality MP4 videos',
  '720p, 1080p, and 4K options',
  'Instant download',
  'No watermarks',
  'Shareable public links',
  'AI music generation',
];

const USD_PACKAGES = [
  { label: '$12.50', sublabel: 'Starter',  credits: '50',   bonus: ''      },
  { label: '$49',    sublabel: 'Standard', credits: '200',  bonus: ''      },
  { label: '$149',   sublabel: 'Pro',      credits: '600',  bonus: ''      },
  { label: '$299',   sublabel: 'Team',     credits: '1,200', bonus: ''      },
];

const SGD_PACKAGES = [
  { label: 'S$17',  sublabel: 'Starter',  credits: '50',   bonus: ''       },
  { label: 'S$65',  sublabel: 'Standard', credits: '200',  bonus: ''       },
  { label: 'S$199', sublabel: 'Pro',      credits: '600',  bonus: ''       },
  { label: 'S$399', sublabel: 'Team',     credits: '1,200', bonus: ''       },
];

export default function Pricing() {
  const [currency, setCurrency] = useState<'USD' | 'SGD'>('USD');
  const packages = currency === 'USD' ? USD_PACKAGES : SGD_PACKAGES;

  return (
    <section id="pricing" className="py-24 bg-slate-900/50 border-y border-slate-800">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Simple, fair pricing</h2>
          <p className="text-slate-400 text-lg mb-6">
            40 free credits on signup. No subscription. Pay for what you use.
          </p>

          {/* Currency toggle */}
          <div className="inline-flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-lg p-1 mb-4">
            <button
              onClick={() => setCurrency('USD')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                currency === 'USD'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              USD
            </button>
            <button
              onClick={() => setCurrency('SGD')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                currency === 'SGD'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              SGD
            </button>
          </div>
          {currency === 'SGD' && (
            <p className="text-xs text-slate-500 mb-2">
              Singapore pricing · Powered by Stripe & PayNow
            </p>
          )}
        </div>

        {/* Credit packages */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {packages.map((pkg) => (
            <div
              key={pkg.label}
              className={`bg-slate-800 border rounded-2xl p-6 flex flex-col items-center text-center ${
                pkg.bonus ? 'border-blue-500/30 relative' : 'border-slate-700'
              }`}
            >
              {pkg.bonus && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs px-3 py-0.5 rounded-full">
                  Best value
                </div>
              )}
              <div className="text-3xl font-bold text-white font-mono mb-1">{pkg.label}</div>
              <div className="text-xs text-slate-500 mb-3">{pkg.sublabel}</div>
              <div className="text-lg font-semibold text-emerald-400 font-mono mb-1">
                {pkg.credits}
              </div>
              <div className="text-xs text-slate-500">credits</div>
              {pkg.bonus && (
                <div className="mt-2 text-xs text-blue-400">{pkg.bonus}</div>
              )}
            </div>
          ))}
        </div>

        {/* Per-clip rate */}
        <div className="text-center mb-8">
          <p className="text-sm text-slate-500">
            Or pay per clip:{' '}
            <span className="text-white font-mono font-medium">
              {currency === 'USD' ? '$2.50' : 'S$3.30'}
            </span>{' '}
            (720p) ·{' '}
            <span className="text-white font-mono font-medium">
              {currency === 'USD' ? '$3.00' : 'S$4.00'}
            </span>{' '}
            (1080p) ·{' '}
            <span className="text-white font-mono font-medium">
              {currency === 'USD' ? '$4.00' : 'S$5.30'}
            </span>{' '}
            (4K)
          </p>
        </div>

        {/* Inclusions */}
        <ul className="max-w-md mx-auto space-y-3 mb-8">
          {inclusions.map((item) => (
            <li key={item} className="flex items-center gap-3 text-sm text-slate-300">
              <Check className="w-4 h-4 text-emerald-500 shrink-0" />
              {item}
            </li>
          ))}
        </ul>

        {/* CTA */}
        <div className="space-y-3 max-w-md mx-auto">
          <Link href="/auth/signup" className="block">
            <Button className="w-full" size="lg">
              {currency === 'SGD' ? 'Start with S$2.50 free' : 'Start with $2.50 free'}
            </Button>
          </Link>
          <p className="text-center text-xs text-slate-500">
            No credit card required · Instant activation · 40 free credits
          </p>
        </div>
      </div>
    </section>
  );
}
