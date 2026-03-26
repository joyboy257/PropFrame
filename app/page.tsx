import Link from 'next/link';
import { ArrowRight, Play, Sparkles, Zap, Music, CloudSun } from 'lucide-react';
import LandingNavbar from '@/components/landing/LandingNavbar';
import LandingHero from '@/components/landing/LandingHero';
import HowItWorks from '@/components/landing/HowItWorks';
import Features from '@/components/landing/Features';
import Pricing from '@/components/landing/Pricing';
import FAQ from '@/components/landing/FAQ';
import LandingFooter from '@/components/landing/LandingFooter';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-950">
      <LandingNavbar />

      <main>
        <LandingHero />
        <HowItWorks />
        <Features />
        <Pricing />
        <FAQ />
      </main>

      <LandingFooter />
    </div>
  );
}
