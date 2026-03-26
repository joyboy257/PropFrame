import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { verifyToken, getUserById } from '@/lib/db/auth';
import { db } from '@/lib/db';
import { projects, clips, photos } from '@/lib/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { Button } from '@/components/ui/Button';
import { Plus, Film, Clock, ArrowRight } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const cookieStore = cookies();
  const token = cookieStore.get('session_token')?.value || cookieStore.get('dev_token')?.value;
  if (!token) redirect('/auth/login');

  const payload = verifyToken(token);
  if (!payload) redirect('/auth/login');

  const user = await getUserById(payload.userId);
  if (!user) redirect('/auth/login');

  const allProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.userId, payload.userId))
    .orderBy(desc(projects.updatedAt))
    .limit(50);

  // Stats
  const totalClips = allProjects.reduce((sum, p) => sum + p.clipCount, 0);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Projects</h1>
          <p className="text-sm text-slate-500 mt-1">
            {allProjects.length} project{allProjects.length !== 1 ? 's' : ''} &middot; {totalClips} total clips
          </p>
        </div>
        <Link href="/ai/project/new">
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            New Project
          </Button>
        </Link>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-white font-mono">{allProjects.length}</div>
          <div className="text-sm text-slate-500">Projects</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-white font-mono">{totalClips}</div>
          <div className="text-sm text-slate-500">Clips Generated</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-emerald-400 font-mono">${(user.credits / 100).toFixed(2)}</div>
          <div className="text-sm text-slate-500">Credit Balance</div>
        </div>
      </div>

      {/* Project grid */}
      {allProjects.length === 0 ? (
        <div className="text-center py-20 bg-slate-900/50 border border-slate-800 rounded-xl">
          <Film className="w-12 h-12 text-slate-700 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-slate-300 mb-2">No projects yet</h2>
          <p className="text-sm text-slate-500 mb-6">Upload your first listing photos to get started.</p>
          <Link href="/ai/project/new">
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Create your first project
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {allProjects.map((project) => (
            <Link key={project.id} href={`/ai/project/${project.id}`}>
              <div className="group bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-all hover:-translate-y-0.5 cursor-pointer h-full">
                {/* Thumbnail */}
                <div className="aspect-video bg-slate-800 rounded-lg mb-4 overflow-hidden">
                  {project.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={project.thumbnailUrl} alt={project.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Film className="w-8 h-8 text-slate-700" />
                    </div>
                  )}
                </div>

                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-200 truncate">{project.name}</h3>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Film className="w-3 h-3" />
                        {project.clipCount} clip{project.clipCount !== 1 ? 's' : ''}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(project.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors shrink-0 mt-1" />
                </div>

                {/* Status */}
                <div className="mt-3 flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    project.status === 'complete' ? 'bg-emerald-500' :
                    project.status === 'processing' ? 'bg-amber-500 animate-pulse' :
                    'bg-slate-600'
                  }`} />
                  <span className="text-xs text-slate-500 capitalize">{project.status}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
