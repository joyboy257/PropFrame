import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { ArrowRight, Play, CheckCircle } from 'lucide-react';

export default function LandingHero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#1E293B_0%,_#0F172A_60%)]" />
      <div className="absolute inset-0" style={{
        backgroundImage: 'radial-gradient(#334155 1px, transparent 1px)',
        backgroundSize: '32px 32px',
        opacity: 0.3,
      }} />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 mb-8 text-sm bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400">
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          AI-powered real estate video generation
        </div>

        {/* Headline */}
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white leading-[1.1] mb-6">
          From listing photos to{' '}
          <span className="relative">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-600">
              cinematic video
            </span>
            <svg className="absolute -bottom-1 left-0 w-full" viewBox="0 0 300 12" fill="none">
              <path d="M2 8 C50 2, 150 2, 298 8" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>{' '}
          in minutes
        </h1>

        {/* Subheadline */}
        <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          Upload your listing photos. Get Ken Burns video clips, auto-edited walkthroughs, and AI music — ready for MLS, social media, and listings.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
          <Link href="/auth/signup">
            <Button size="lg" className="gap-2 text-base">
              Try it free
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <Button variant="secondary" size="lg" className="gap-2 text-base">
            <Play className="w-4 h-4" />
            Watch demo
          </Button>
        </div>

        {/* Social proof */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            <span>$10 free credits</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            <span>No credit card required</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            <span>15,000+ clips generated</span>
          </div>
        </div>

        {/* Hero visual — video demo preview */}
        <div className="mt-16 relative">
          <div className="relative rounded-xl overflow-hidden border border-slate-700 shadow-2xl shadow-blue-500/10 bg-slate-900">
            {/* Browser chrome */}
            <div className="flex items-center gap-2 px-4 py-3 bg-slate-800 border-b border-slate-700">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>
              <div className="flex-1 mx-4 h-6 bg-slate-700 rounded-md text-xs text-slate-500 flex items-center px-3">
                ai.vugru.com/project/luxury-villa-tour
              </div>
            </div>
            {/* App preview */}
            <div className="aspect-video bg-slate-950 relative overflow-hidden">
              {/* Simulated UI */}
              <div className="absolute inset-0 flex">
                {/* Sidebar */}
                <div className="w-48 bg-slate-900 border-r border-slate-800 p-3 flex flex-col gap-2">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Project</div>
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className={`h-12 rounded-md ${i === 1 ? 'bg-blue-500/20 border border-blue-500/30' : 'bg-slate-800'}`} />
                  ))}
                </div>
                {/* Main content */}
                <div className="flex-1 p-4">
                  <div className="text-sm font-medium text-slate-300 mb-3">Living Room</div>
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div key={i} className="aspect-video bg-slate-800 rounded-md overflow-hidden">
                        <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-800" />
                      </div>
                    ))}
                  </div>
                  <div className="text-xs text-slate-500">6 clips generated</div>
                </div>
                {/* Preview */}
                <div className="w-64 bg-slate-900/50 p-3 border-l border-slate-800">
                  <div className="aspect-video bg-slate-800 rounded-md mb-2 overflow-hidden">
                    <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-800 animate-pulse" />
                  </div>
                  <div className="text-xs text-slate-400 text-center">Clip 1 of 6</div>
                </div>
              </div>
              {/* Play overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center cursor-pointer hover:bg-white/20 transition-colors">
                  <Play className="w-6 h-6 text-white ml-1" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
