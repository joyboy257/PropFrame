import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default function LandingNavbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-40 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="28" height="28" rx="6" fill="#3B82F6" />
              <rect x="6" y="8" width="16" height="12" rx="2" fill="white" fillOpacity="0.9" />
              <rect x="9" y="11" width="10" height="6" rx="1" fill="#3B82F6" />
              <circle cx="14" cy="14" r="1.5" fill="white" />
            </svg>
            <span className="text-lg font-semibold text-white tracking-tight">FrameForge</span>
          </Link>

          {/* Nav links */}
          <div className="hidden md:flex items-center gap-8">
            <Link href="/#features" className="text-sm text-slate-400 hover:text-slate-200 transition-colors">
              Features
            </Link>
            <Link href="/#pricing" className="text-sm text-slate-400 hover:text-slate-200 transition-colors">
              Pricing
            </Link>
            <Link href="/blog" className="text-sm text-slate-400 hover:text-slate-200 transition-colors">
              Blog
            </Link>
          </div>

          {/* Auth buttons */}
          <div className="flex items-center gap-3">
            <Link href="/auth/login">
              <Button variant="ghost" size="sm">Log in</Button>
            </Link>
            <Link href="/auth/signup">
              <Button size="sm">Get $10 free</Button>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
