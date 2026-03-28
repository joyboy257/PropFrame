'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Film, Clock, ArrowRight, Loader2 } from 'lucide-react';
import { DeleteButton } from '@/components/DeleteButton';
import { InlineEdit } from '@/components/InlineEdit';
import { toast } from 'sonner';

interface ProjectCardProps {
  project: {
    id: string;
    name: string;
    status: string;
    clipCount: number;
    thumbnailUrl?: string | null;
    updatedAt: Date | string;
  };
}

export function ProjectCard({ project }: ProjectCardProps) {
  const [projectName, setProjectName] = useState(project.name);

  const handleRename = async (newName: string) => {
    const res = await fetch(`/api/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: newName }),
    });

    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error || 'Failed to rename project');
      throw new Error(err.error);
    }

    const { project: updated } = await res.json();
    setProjectName(updated.name);
    toast.success('Project renamed');
  };

  return (
    <Link href={`/project/${project.id}`}>
      <div className="group bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-all hover:-translate-y-0.5 cursor-pointer h-full">
        {/* Thumbnail */}
        <div className="aspect-video bg-slate-800 rounded-lg mb-4 overflow-hidden">
          {project.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={project.thumbnailUrl} alt={projectName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Film className="w-8 h-8 text-slate-700" />
            </div>
          )}
        </div>

        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <InlineEdit
              value={projectName}
              onSave={handleRename}
              textClassName="font-semibold text-slate-200"
              className="w-full"
              inputClassName="w-full min-w-0"
              iconSize={14}
            />
            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <Film className="w-3 h-3" />
                {project.clipCount} clip{project.clipCount !== 1 ? 's' : ''}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(project.updatedAt).toLocaleDateString('en-SG', { timeZone: 'Asia/Singapore', month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <DeleteButton projectId={project.id} projectName={projectName} />
            <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
          </div>
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
  );
}
