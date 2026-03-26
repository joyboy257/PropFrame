'use client';

import { useState } from 'react';
import { Play, Loader2, RefreshCw, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

export interface Clip {
  id: string;
  photoId: string;
  status: string;
  motionStyle: string;
  resolution: string;
  publicUrl?: string | null;
  errorMessage?: string | null;
  cost: number;
}

interface ClipGridProps {
  clips: Clip[];
  projectId: string;
  onGenerateClip: (photoId: string, motionStyle: string, resolution: string) => Promise<void>;
  onRetryClip?: (clipId: string) => void;
  generatingCount: number;
}

const MOTION_STYLES = [
  { value: 'push-in', label: 'Push In' },
  { value: 'zoom-out', label: 'Zoom Out' },
  { value: 'pan-left', label: 'Pan Left' },
  { value: 'pan-right', label: 'Pan Right' },
  { value: 'custom', label: 'Custom' },
];

export function ClipGrid({ clips, projectId, onGenerateClip, onRetryClip, generatingCount }: ClipGridProps) {
  const [selectedMotion, setSelectedMotion] = useState('push-in');
  const [selectedResolution, setSelectedResolution] = useState('720p');

  if (clips.length === 0) {
    return (
      <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl">
        <Play className="w-8 h-8 text-slate-700 mx-auto mb-3" />
        <p className="text-sm text-slate-500">Upload photos to generate clips</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500">Motion:</label>
          <select
            value={selectedMotion}
            onChange={e => setSelectedMotion(e.target.value)}
            className="h-8 px-2 bg-slate-800 border border-slate-700 rounded-md text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {MOTION_STYLES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500">Quality:</label>
          <select
            value={selectedResolution}
            onChange={e => setSelectedResolution(e.target.value)}
            className="h-8 px-2 bg-slate-800 border border-slate-700 rounded-md text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="720p">720p — 1 credit</option>
            <option value="1080p">1080p — 2 credits</option>
            <option value="4k">4K — 4 credits</option>
          </select>
        </div>

        <div className="flex-1" />

        <div className="text-xs text-slate-500">
          {generatingCount > 0 && (
            <span className="flex items-center gap-1.5 text-amber-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              Generating {generatingCount} clip{generatingCount > 1 ? 's' : ''}...
            </span>
          )}
          {generatingCount === 0 && (
            <span>{clips.filter(c => c.status === 'done').length} / {clips.length} done</span>
          )}
        </div>
      </div>

      {/* Clip grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {clips.map(clip => (
          <ClipCard
            key={clip.id}
            clip={clip}
            onGenerate={() => onGenerateClip(clip.photoId, selectedMotion, selectedResolution)}
            onRetry={() => onRetryClip?.(clip.id)}
          />
        ))}
      </div>
    </div>
  );
}

function ClipCard({ clip, onGenerate, onRetry }: { clip: Clip; onGenerate: () => void; onRetry: () => void }) {
  return (
    <div className={cn(
      'relative rounded-lg overflow-hidden border',
      clip.status === 'done' ? 'border-emerald-500/30' :
      clip.status === 'error' ? 'border-red-500/30' :
      clip.status === 'processing' ? 'border-amber-500/30' :
      'border-slate-800'
    )}>
      {/* Thumbnail */}
      <div className="aspect-video bg-slate-800">
        {clip.publicUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={clip.publicUrl} alt="Clip" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Clock className="w-5 h-5 text-slate-700" />
          </div>
        )}
      </div>

      {/* Status overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 opacity-0 hover:opacity-100 transition-opacity">
        {clip.status === 'queued' && (
          <Button size="sm" onClick={onGenerate} className="gap-1.5">
            <Play className="w-3 h-3" /> Generate
          </Button>
        )}
        {clip.status === 'processing' && (
          <div className="flex items-center gap-1.5 text-amber-400 text-xs">
            <Loader2 className="w-4 h-4 animate-spin" /> Processing
          </div>
        )}
        {clip.status === 'error' && (
          <div className="text-center px-2">
            <p className="text-red-400 text-xs mb-2">{clip.errorMessage || 'Generation failed'}</p>
            <Button size="sm" variant="secondary" onClick={onRetry} className="gap-1.5">
              <RefreshCw className="w-3 h-3" /> Retry
            </Button>
          </div>
        )}
        {clip.status === 'done' && (
          <div className="flex items-center gap-1.5 text-emerald-400 text-xs">
            <CheckCircle className="w-4 h-4" /> Done
          </div>
        )}
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">{clip.motionStyle}</span>
          <span className="text-xs font-mono text-slate-500">{clip.resolution}</span>
        </div>
      </div>
    </div>
  );
}
