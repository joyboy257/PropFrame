'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const faqs = [
  {
    q: 'How long does it take to generate a clip?',
    a: 'Most clips are generated in 30-60 seconds. During peak times, queue times may extend to 2-3 minutes. You will receive a notification when your clip is ready.',
  },
  {
    q: 'Can I choose the camera movement?',
    a: 'Yes. Default is smooth push-in. You can also select zoom-out, pan left, or pan right. Advanced users can write a custom motion prompt to describe the movement they want.',
  },
  {
    q: 'Is vertical video supported?',
    a: 'Yes. We generate both horizontal (16:9) and vertical (9:16) formats. Horizontal is best for MLS and YouTube. Vertical is optimized for Instagram Reels and TikTok.',
  },
  {
    q: 'What resolution are the clips?',
    a: 'Default is 720p HD. Upgrade to 1080p for $0.20/clip or 4K for $0.80/clip. All resolutions are delivered as MP4 with H.264 encoding.',
  },
  {
    q: 'What happens to my photos after processing?',
    a: 'Your photos are stored securely in encrypted cloud storage and automatically deleted after 30 days or when you delete your account. We never use your photos for any other purpose.',
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="py-24">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Frequently asked questions</h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div key={i} className="border border-slate-800 rounded-lg overflow-hidden">
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left bg-slate-900/50 hover:bg-slate-900 transition-colors"
              >
                <span className="font-medium text-slate-200">{faq.q}</span>
                <ChevronDown
                  className={cn(
                    'w-4 h-4 text-slate-500 shrink-0 transition-transform duration-200',
                    openIndex === i && 'rotate-180'
                  )}
                />
              </button>
              <div
                className={cn(
                  'overflow-hidden transition-all duration-200',
                  openIndex === i ? 'max-h-48' : 'max-h-0'
                )}
              >
                <p className="px-5 py-4 text-sm text-slate-400 leading-relaxed border-t border-slate-800">
                  {faq.a}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
