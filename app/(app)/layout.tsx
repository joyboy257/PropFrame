import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken, getUserById } from '@/lib/db/auth';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies();
  const token = cookieStore.get('session_token')?.value || cookieStore.get('dev_token')?.value;

  if (!token) {
    redirect('/auth/login');
  }

  const payload = verifyToken(token);
  if (!payload) {
    redirect('/auth/login');
  }

  const user = await getUserById(payload.userId);
  if (!user) {
    redirect('/auth/login');
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Top nav */}
      <header className="h-14 border-b border-slate-800 flex items-center px-4 gap-4 shrink-0">
        <a href="/ai" className="flex items-center gap-2">
          <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="6" fill="#3B82F6"/>
            <rect x="6" y="8" width="16" height="12" rx="2" fill="white" fillOpacity="0.9"/>
            <rect x="9" y="11" width="10" height="6" rx="1" fill="#3B82F6"/>
            <circle cx="14" cy="14" r="1.5" fill="white"/>
          </svg>
          <span className="font-semibold text-white text-sm">FrameForge</span>
        </a>

        <div className="flex-1" />

        {/* Credits badge */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-full">
          <span className="text-xs font-mono text-emerald-400">
            {user.credits.toLocaleString()} credits
          </span>
        </div>

        {/* User menu */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-sm font-medium text-slate-200">{user.name || user.email}</div>
          </div>
          <form action="/api/auth/logout" method="POST">
            <button type="submit" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
              Sign out
            </button>
          </form>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
