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

export default function Pricing() {
  return (
    <section id="pricing" className="py-24 bg-slate-900/50 border-y border-slate-800">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Simple, fair pricing</h2>
          <p className="text-slate-400 text-lg">
            No confusing credits or subscriptions. Just simple dollar pricing for what you actually use.
          </p>
        </div>

        <div className="max-w-md mx-auto">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8">
            {/* Price */}
            <div className="mb-6">
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-bold text-white font-mono">$0.80</span>
                <span className="text-slate-400">/clip</span>
              </div>
              <p className="text-slate-500 text-sm mt-1">720p. Add $0.20 for 1080p, $0.80 for 4K.</p>
            </div>

            {/* Inclusions */}
            <ul className="space-y-3 mb-8">
              {inclusions.map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm text-slate-300">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>

            {/* CTA */}
            <div className="space-y-3">
              <Link href="/auth/signup" className="block">
                <Button className="w-full" size="lg">Start with $10 free</Button>
              </Link>
              <p className="text-center text-xs text-slate-500">
                No credit card required
              </p>
            </div>
          </div>

          {/* Enhancement pricing */}
          <div className="mt-6 grid grid-cols-3 gap-4 text-center">
            <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-800">
              <div className="text-lg font-semibold text-white font-mono">$0.50</div>
              <div className="text-xs text-slate-500 mt-1">Virtual Staging / photo</div>
            </div>
            <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-800">
              <div className="text-lg font-semibold text-white font-mono">$0.50</div>
              <div className="text-xs text-slate-500 mt-1">Sky Replacement / photo</div>
            </div>
            <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-800">
              <div className="text-lg font-semibold text-white font-mono">$2.00</div>
              <div className="text-xs text-slate-500 mt-1">AI Music / 60s track</div>
            </div>
          </div>

          <div className="mt-6 text-center">
            <Link href="/auth/signup" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
              See full pricing calculator
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
