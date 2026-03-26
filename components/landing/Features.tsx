import { Film, Music, Sofa, CloudSun, Layout, Zap } from 'lucide-react';
import { Card } from '@/components/ui/Card';

const features = [
  {
    icon: Film,
    title: 'Ken Burns Clips',
    description: 'AI motion applied to your photos. Smooth push-in, pan, zoom — each photo becomes a cinematic 5-second clip.',
    tag: 'Core',
  },
  {
    icon: Layout,
    title: 'Auto-Edit Walkthrough',
    description: 'Combine clips into complete property videos. Drag to reorder, add title screens, and export as a single MP4.',
    tag: 'Core',
  },
  {
    icon: Music,
    title: 'AI Music Generation',
    description: 'Generate copyright-free ambient soundtracks in 60 seconds. Match the mood of your listing — warm, upbeat, calm.',
    tag: '$2/song',
  },
  {
    icon: Sofa,
    title: 'Virtual Staging',
    description: 'Transform empty rooms into furnished spaces. Multiple style presets: Modern, Scandinavian, Industrial, Warm.',
    tag: '$0.50/photo',
  },
  {
    icon: CloudSun,
    title: 'Sky Replacement',
    description: 'Replace gray skies with blue or golden hour. Automatic sky detection — one click for exterior shots.',
    tag: '$0.50/photo',
  },
  {
    icon: Zap,
    title: 'Instant Export',
    description: 'Download individual clips or full walkthrough. One-click copy shareable link for MLS, email, or social.',
    tag: 'Included',
  },
];

export default function Features() {
  return (
    <section id="features" className="py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Everything you need to stand out
          </h2>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            Built for real estate photographers and agents who need professional video without the production overhead.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card key={feature.title} className="group">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-slate-700 group-hover:border-blue-500/30 transition-colors flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-white">{feature.title}</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-400 font-mono">
                        {feature.tag}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 leading-relaxed">{feature.description}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
