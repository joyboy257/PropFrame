import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Log in — FrameForge',
  description: 'Log in to your FrameForge account.',
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <a href="/" className="inline-flex items-center gap-2">
            <svg width="32" height="32" viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" rx="6" fill="#3B82F6"/>
              <rect x="6" y="8" width="16" height="12" rx="2" fill="white" fillOpacity="0.9"/>
              <rect x="9" y="11" width="10" height="6" rx="1" fill="#3B82F6"/>
              <circle cx="14" cy="14" r="1.5" fill="white"/>
            </svg>
            <span className="text-xl font-semibold text-white">FrameForge</span>
          </a>
        </div>
        {children}
      </div>
    </div>
  );
}
