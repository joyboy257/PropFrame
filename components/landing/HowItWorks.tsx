import { Upload, Wand2, Film, Download, ShieldCheck, Star, Lock, Zap, CreditCard } from 'lucide-react';

const steps = [
  {
    number: '01',
    icon: Upload,
    title: 'Upload your listing photos',
    description: 'Drag and drop horizontal images. JPG, PNG, HEIC, WebP supported. Up to 50 photos per project.',
  },
  {
    number: '02',
    icon: Wand2,
    title: 'Pick a clip style',
    description: 'Choose from smooth push-in, zoom-out, pan, or write a custom motion prompt. Each photo becomes a 5-second clip.',
  },
  {
    number: '03',
    icon: Film,
    title: 'Generate clips',
    description: 'AI transforms your photos into cinematic MP4 clips with Ken Burns motion. Delivered in under a minute.',
  },
  {
    number: '04',
    icon: Download,
    title: 'Auto-edit with music',
    description: 'Combine clips into a complete walkthrough. Add titles, select AI-generated music, download or share directly.',
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 bg-slate-900/50 border-y border-slate-800">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Four steps from photo to video
          </h2>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            No camera gear. No editing software. No design skills required.
          </p>

          {/* Social Proof Strip */}
          <div className="flex flex-wrap justify-center items-center gap-6 sm:gap-8 mt-8 pt-8 border-t border-slate-800/50">
            <div className="flex items-center gap-2 text-slate-400">
              <CreditCard className="w-4 h-4 text-emerald-400" />
              <span className="text-sm">No credit card required</span>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <Zap className="w-4 h-4 text-blue-400" />
              <span className="text-sm">30-second delivery</span>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <Lock className="w-4 h-4 text-emerald-400" />
              <span className="text-sm">Private & secure</span>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <Star className="w-4 h-4 text-amber-400" />
              <span className="text-sm">4.9★ on Product Hunt</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.number} className="relative">
                {/* Connector line */}
                {step.number !== '04' && (
                  <div className="hidden lg:block absolute top-12 left-full w-full h-px bg-gradient-to-r from-blue-500/50 to-transparent -translate-x-6" />
                )}

                <div className="flex flex-col items-start lg:items-center text-left lg:text-center">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-blue-400" />
                    </div>
                    <span className="text-4xl font-bold text-blue-500/20 font-mono">
                      {step.number}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{step.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{step.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
