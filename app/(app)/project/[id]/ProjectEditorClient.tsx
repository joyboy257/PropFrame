'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { PhotoUploader } from '@/components/editor/PhotoUploader';
import { ClipGrid, type Clip } from '@/components/editor/ClipGrid';
import { AutoEditTab } from '@/components/editor/AutoEditTab';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { InlineEdit } from '@/components/InlineEdit';
import { SortablePhotoGrid } from '@/components/editor/SortablePhotoGrid';
import { VirtualStageModal } from '@/components/editor/VirtualStageModal';
import { ArrowLeft, Wand2, Sparkles, Film, Trash2, Loader2, CheckCircle } from 'lucide-react';
import { MUSIC_TRACKS } from '@/lib/music';
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

export interface AutoEdit {
  id: string;
  projectId: string;
  clipIds: string[];
  titleText?: string | null;
  musicKey?: string | null;
  status: 'draft' | 'rendering' | 'done' | 'error';
  publicUrl?: string | null;
  storageKey?: string | null;
  shareToken?: string | null;
  shareExpiresAt?: string | Date | null;
  cost: number;
  createdAt: string | Date;
}

export default function ProjectEditorClient({
  project: initialProject,
  photos: initialPhotos,
  clips: initialClips,
  autoEdits: initialAutoEdits,
  onProjectUpdated,
}: {
  project: Project;
  photos: Photo[];
  clips: Clip[];
  autoEdits: AutoEdit[];
  onProjectUpdated?: (project: Project) => void;
}) {
  const [project, setProject] = useState(initialProject);
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
  const [clips, setClips] = useState<Clip[]>(initialClips);
  const [autoEdits, setAutoEdits] = useState<AutoEdit[]>(initialAutoEdits);
  const [generatingCount, setGeneratingCount] = useState(0);
  const [activeTab, setActiveTab] = useState<'photos' | 'clips' | 'edit'>('photos');
  const [stagingPhoto, setStagingPhoto] = useState<Photo | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Generate Video state
  const [showRenderModal, setShowRenderModal] = useState(false);
  const [renderStatus, setRenderStatus] = useState<'idle' | 'rendering' | 'done' | 'error'>('idle');
  const [renderedVideoUrl, setRenderedVideoUrl] = useState<string | null>(null);
  const [renderedAutoEditId, setRenderedAutoEditId] = useState<string | null>(null);
  const [renderModalTitle, setRenderModalTitle] = useState('');
  const [renderModalMusic, setRenderModalMusic] = useState<string>('upbeat-1');
  const renderPollingRef = useRef<NodeJS.Timeout | null>(null);

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${project.id}`, { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      if (data.project) setProject(data.project);
      if (data.photos) setPhotos(data.photos);
      if (data.clips) setClips(data.clips);
    } catch { /* silent */ }
  }, [project.id]);

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

  const handlePhotoDeleted = useCallback((photoId: string) => {
    setPhotos(prev => prev.filter(p => p.id !== photoId));
  }, []);

  const handlePhotosReordered = useCallback((newOrder: string[]) => {
    setPhotos(prev => {
      const sorted = newOrder
        .map(id => prev.find(p => p.id === id))
        .filter(Boolean) as Photo[];
      // Fill in any missing photos that weren't in the order
      const orderedIds = new Set(newOrder);
      const extras = prev.filter(p => !orderedIds.has(p.id));
      return [...sorted, ...extras];
    });
  }, []);

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

  const handleAutoEditCreated = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${project.id}`, { credentials: 'include' });
      if (!res.ok) return;
      const { autoEdits: updatedAutoEdits } = await res.json();
      setAutoEdits(updatedAutoEdits);
    } catch {
      // silent
    }
  }, [project.id]);

  const handleRename = useCallback(async (newName: string) => {
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
    setProject(updated);
    onProjectUpdated?.(updated);
    toast.success('Project renamed');
  }, [project.id, onProjectUpdated]);

  // Generate Video handlers
  const doneClips = clips.filter(c => c.status === 'done');

  const handleOpenRenderModal = useCallback(() => {
    setRenderModalTitle(project.name);
    setRenderModalMusic('upbeat-1');
    setShowRenderModal(true);
  }, [project.name]);

  const handleCloseRenderModal = useCallback(() => {
    if (renderStatus === 'rendering') return; // don't close during render
    setShowRenderModal(false);
    setRenderStatus('idle');
    setRenderedVideoUrl(null);
  }, [renderStatus]);

  const pollRenderStatus = useCallback(async (autoEditId: string) => {
    try {
      const res = await fetch(`/api/auto-edits/${autoEditId}`, { credentials: 'include' });
      if (!res.ok) return;
      const { autoEdit } = await res.json();

      if (autoEdit.status === 'done') {
        setRenderStatus('done');
        setRenderedVideoUrl(autoEdit.publicUrl);
        if (renderPollingRef.current) clearInterval(renderPollingRef.current);
      } else if (autoEdit.status === 'error') {
        setRenderStatus('error');
        toast.error(autoEdit.errorMessage || 'Rendering failed');
        if (renderPollingRef.current) clearInterval(renderPollingRef.current);
      }
    } catch {
      // silent
    }
  }, []);

  const handleGenerateVideo = useCallback(async () => {
    if (doneClips.length < 2) {
      toast.error('Select at least 2 clips');
      return;
    }

    if (!renderModalTitle.trim()) {
      toast.error('Title is required');
      return;
    }

    setRenderStatus('rendering');

    try {
      // First create the auto-edit
      const createRes = await fetch('/api/auto-edits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          projectId: project.id,
          clipIds: doneClips.map(c => c.id),
          titleText: renderModalTitle.trim(),
          musicKey: renderModalMusic,
        }),
      });

      if (!createRes.ok) {
        const err = await createRes.json();
        toast.error(err.error || 'Failed to create auto-edit');
        setRenderStatus('idle');
        return;
      }

      const { autoEdit } = await createRes.json();
      setRenderedAutoEditId(autoEdit.id);

      // Then trigger render
      const renderRes = await fetch(`/api/auto-edits/${autoEdit.id}/render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          titleText: renderModalTitle.trim(),
          musicKey: renderModalMusic,
        }),
      });

      if (!renderRes.ok) {
        const err = await renderRes.json();
        toast.error(err.error || 'Failed to start rendering');
        setRenderStatus('idle');
        return;
      }

      toast.success('Video rendering started!');

      // Start polling
      renderPollingRef.current = setInterval(() => {
        pollRenderStatus(autoEdit.id);
      }, 3000);
    } catch {
      toast.error('Network error. Please try again.');
      setRenderStatus('idle');
    }
  }, [doneClips, renderModalTitle, renderModalMusic, project.id, pollRenderStatus]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (renderPollingRef.current) clearInterval(renderPollingRef.current);
    };
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-slate-800 px-4 py-3 flex items-center gap-4 shrink-0">
        <Link href="/dashboard" className="text-slate-500 hover:text-slate-300 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <InlineEdit
            value={project.name}
            onSave={handleRename}
            textClassName="font-semibold text-slate-200 truncate"
            className="w-full"
            inputClassName="w-full min-w-0"
            iconSize={16}
          />
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
                  <button
                    onClick={() => {
                      if (!confirm('Remove all photos from this project?')) return;
                      fetch(`/api/projects/${project.id}/photos`, { method: 'DELETE', credentials: 'include' })
                        .then(res => { if (!res.ok) throw new Error(); setPhotos([]); })
                        .catch(() => toast.error('Failed to clear photos'));
                    }}
                    className="text-xs text-slate-500 hover:text-red-400 transition-colors flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear all
                  </button>
                </div>
                <SortablePhotoGrid
                  photos={photos}
                  projectId={project.id}
                  onDeleted={handlePhotoDeleted}
                  onReordered={handlePhotosReordered}
                  onStageClick={setStagingPhoto}
                />

                {stagingPhoto && (
                  <VirtualStageModal
                    photo={stagingPhoto}
                    projectId={project.id}
                    onClose={() => setStagingPhoto(null)}
                    onStaged={() => { fetchProject(); setStagingPhoto(null); }}
                  />
                )}
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

            {/* Generate Video button - shown when 2+ clips are done */}
            {doneClips.length >= 2 && (
              <div className="mt-6 flex justify-center">
                <Button
                  onClick={handleOpenRenderModal}
                  size="lg"
                  className="gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  Generate Video
                  <span className="text-xs opacity-70">({doneClips.length} clips)</span>
                </Button>
              </div>
            )}

            {/* Rendering indicator */}
            {renderStatus === 'rendering' && (
              <div className="mt-4 p-4 bg-slate-900/80 border border-amber-500/30 rounded-xl text-center">
                <Loader2 className="w-6 h-6 text-amber-400 mx-auto mb-2 animate-spin" />
                <p className="text-slate-300 font-medium">Rendering your video...</p>
                <p className="text-sm text-slate-500 mt-1">This may take a few minutes</p>
              </div>
            )}

            {/* Rendered video preview */}
            {renderStatus === 'done' && renderedVideoUrl && (
              <div className="mt-4 p-4 bg-slate-900/80 border border-emerald-500/30 rounded-xl">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                  <p className="text-slate-300 font-medium">Your video is ready!</p>
                </div>
                <video
                  src={renderedVideoUrl}
                  controls
                  className="w-full rounded-lg"
                />
              </div>
            )}
          </div>
        )}

        {activeTab === 'edit' && (
          <AutoEditTab
            projectId={project.id}
            clips={clips}
            autoEdits={autoEdits}
            onAutoEditCreated={handleAutoEditCreated}
          />
        )}
      </div>

      {/* Generate Video Modal */}
      <Modal
        open={showRenderModal}
        onClose={handleCloseRenderModal}
        title="Generate Video"
        size="md"
        footer={
          renderStatus === 'idle' ? (
            <>
              <Button variant="secondary" onClick={handleCloseRenderModal}>
                Cancel
              </Button>
              <Button onClick={handleGenerateVideo} className="gap-2">
                <Sparkles className="w-4 h-4" />
                Generate (1 credit)
              </Button>
            </>
          ) : renderStatus === 'rendering' ? (
            <Button disabled className="gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Rendering...
            </Button>
          ) : (
            <Button variant="secondary" onClick={handleCloseRenderModal}>
              Close
            </Button>
          )
        }
      >
        {renderStatus === 'idle' && (
          <div className="space-y-4">
            {/* Clip count */}
            <div className="bg-slate-800/50 rounded-lg px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-300 font-medium">Clips to assemble</p>
                <p className="text-xs text-slate-500">{doneClips.length} clips selected</p>
              </div>
              <Film className="w-5 h-5 text-blue-400" />
            </div>

            {/* Credit cost */}
            <div className="bg-slate-800/50 rounded-lg px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-300 font-medium">Credit cost</p>
                <p className="text-xs text-slate-500">1 credit will be deducted</p>
              </div>
              <span className="text-lg font-bold text-amber-400">1</span>
            </div>

            {/* Title input */}
            <div>
              <label className="text-sm font-medium text-slate-300 mb-2 block">
                Title Screen Text
              </label>
              <input
                type="text"
                value={renderModalTitle}
                onChange={e => setRenderModalTitle(e.target.value)}
                placeholder="123 Main Street, Los Angeles CA"
                className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Music selector */}
            <div>
              <label className="text-sm font-medium text-slate-300 mb-2 block">
                Background Music
              </label>
              <select
                value={renderModalMusic}
                onChange={e => setRenderModalMusic(e.target.value)}
                className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {(Object.keys(MUSIC_TRACKS) as Array<keyof typeof MUSIC_TRACKS>).map(key => (
                  <option key={key} value={key}>
                    {MUSIC_TRACKS[key].name} — {MUSIC_TRACKS[key].mood}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {renderStatus === 'rendering' && (
          <div className="text-center py-8">
            <Loader2 className="w-10 h-10 text-amber-400 mx-auto mb-4 animate-spin" />
            <p className="text-slate-300 font-medium mb-1">Rendering your video...</p>
            <p className="text-sm text-slate-500">This may take a few minutes. You can close this modal and continue working.</p>
          </div>
        )}

        {renderStatus === 'error' && (
          <div className="text-center py-8">
            <p className="text-red-400 font-medium mb-2">Rendering failed</p>
            <Button variant="secondary" onClick={() => setRenderStatus('idle')}>
              Try Again
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
