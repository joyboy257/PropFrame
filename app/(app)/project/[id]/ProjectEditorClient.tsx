'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { PhotoUploader } from '@/components/editor/PhotoUploader';
import { ClipGrid, type Clip } from '@/components/editor/ClipGrid';
import { Button } from '@/components/ui/Button';
import { ArrowLeft, Wand2, Sparkles, Film } from 'lucide-react';
import { toast } from 'sonner';

interface Photo {
  id: string;
  storageKey: string;
  filename: string;
  publicUrl: string | null;
  width?: number | null;
  height?: number | null;
  order: number;
}

interface Project {
  id: string;
  name: string;
  status: string;
  clipCount: number;
  thumbnailUrl?: string | null;
}

export default function ProjectEditorClient({
  project: initialProject,
  photos: initialPhotos,
  clips: initialClips,
}: {
  project: Project;
  photos: Photo[];
  clips: Clip[];
}) {
  const [project, setProject] = useState(initialProject);
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
  const [clips, setClips] = useState<Clip[]>(initialClips);
  const [generatingCount, setGeneratingCount] = useState(0);
  const [activeTab, setActiveTab] = useState<'photos' | 'clips' | 'edit'>('photos');
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Poll clip statuses when there are in-flight clips
  useEffect(() => {
    const inFlight = clips.some(c => c.status === 'queued' || c.status === 'processing');
    if (!inFlight) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    if (pollingRef.current) return; // already polling

    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/projects/${project.id}`, {
          credentials: 'include',
        });
        if (!res.ok) return;
        const { clips: updated } = await res.json();

        // Merge: replace local clips with server state
        setClips(prev => {
          if (updated.length === 0) return prev;
          // Only replace statuses/URLs — don't reorder
          const merged = prev.map(local => {
            const server = updated.find((s: Clip) => s.id === local.id);
            return server ? { ...local, ...server } : local;
          });
          // Add any new clips the server has that we don't
          const localIds = new Set(prev.map(c => c.id));
          const newOnServer = updated.filter((s: Clip) => !localIds.has(s.id));
          return [...merged, ...newOnServer];
        });
      } catch {
        // silent fail — will retry on next interval
      }
    }, 5000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [clips, project.id]);

  const handlePhotoUploaded = useCallback((photo: Photo) => {
    setPhotos(prev => [...prev, photo]);
    if (photos.length === 0) {
      setProject(prev => prev ? { ...prev, thumbnailUrl: photo.publicUrl } : prev);
    }
  }, [photos.length]);

  const handleGenerateClip = useCallback(async (photoId: string, motionStyle: string, resolution: string) => {
    if (generatingCount >= 5) {
      toast.error('Maximum 5 clips can be generating at once.');
      return;
    }

    setGeneratingCount(prev => prev + 1);
    const tempId = `temp-${Date.now()}`;
    setClips(prev => [...prev, {
      id: tempId,
      photoId,
      status: 'queued',
      motionStyle,
      resolution,
      cost: resolution === '4k' ? 4 : resolution === '1080p' ? 2 : 1,
    }]);

    try {
      const res = await fetch('/api/clips/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ photoId, motionStyle, resolution }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Failed to generate clip');
        setClips(prev => prev.filter(c => c.id !== tempId));
        return;
      }

      const { clip } = await res.json();
      setClips(prev => prev.map(c => c.id === tempId ? clip : c));
      toast.success('Clip queued for generation.');
    } catch {
      toast.error('Network error. Please try again.');
      setClips(prev => prev.filter(c => c.id !== tempId));
    } finally {
      setGeneratingCount(prev => Math.max(0, prev - 1));
    }
  }, [generatingCount]);

  const handleRetryClip = useCallback(async (clipId: string) => {
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;
    await handleGenerateClip(clip.photoId, clip.motionStyle, clip.resolution);
  }, [clips, handleGenerateClip]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-slate-800 px-4 py-3 flex items-center gap-4 shrink-0">
        <Link href="/dashboard" className="text-slate-500 hover:text-slate-300 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-slate-200 truncate">{project.name}</h1>
        </div>

        {/* Tab nav */}
        <div className="flex items-center gap-1 bg-slate-900 rounded-lg p-1">
          {([
            { key: 'photos', label: 'Photos', icon: Film },
            { key: 'clips', label: 'Clips', icon: Wand2 },
            { key: 'edit', label: 'Auto-Edit', icon: Sparkles },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                activeTab === tab.key
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
              {tab.key === 'clips' && clips.length > 0 && (
                <span className="text-xs text-slate-600">({clips.length})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'photos' && (
          <div className="max-w-4xl">
            <PhotoUploader
              projectId={project.id}
              onPhotoUploaded={handlePhotoUploaded}
            />

            {photos.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-medium text-slate-400">
                    {photos.length} photo{photos.length !== 1 ? 's' : ''} uploaded
                  </h2>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                  {photos.map((photo) => (
                    <div key={photo.id} className="relative aspect-square group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.publicUrl || ''}
                        alt={photo.filename}
                        className="w-full h-full object-cover rounded-lg"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors rounded-lg" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'clips' && (
          <div className="max-w-4xl">
            <ClipGrid
              clips={clips}
              projectId={project.id}
              onGenerateClip={handleGenerateClip}
              onRetryClip={handleRetryClip}
              generatingCount={generatingCount}
              isGeneratingLocked={generatingCount >= 5}
            />
          </div>
        )}

        {activeTab === 'edit' && (
          <div className="max-w-2xl">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
              <Sparkles className="w-10 h-10 text-slate-700 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-slate-300 mb-2">Auto-Edit</h2>
              <p className="text-sm text-slate-500 mb-6">
                Generate a polished video from your clips with music, transitions, and titles.
              </p>
              {clips.filter(c => c.status === 'done').length === 0 ? (
                <p className="text-xs text-slate-600">Generate at least one clip first to create an auto-edit.</p>
              ) : (
                <Button className="gap-2">
                  <Sparkles className="w-4 h-4" /> Create Auto-Edit
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
