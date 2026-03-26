'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';
import {
  Sparkles, Music, ChevronUp, ChevronDown, Trash2, Download,
  Loader2, CheckCircle, Clock, AlertCircle, Film, Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Clip {
  id: string;
  photoId: string;
  status: string;
  motionStyle: string;
  resolution: string;
  publicUrl?: string | null;
  cost: number;
}

interface AutoEdit {
  id: string;
  projectId: string;
  clipIds: string[];
  titleText?: string | null;
  musicKey?: string | null;
  status: 'draft' | 'rendering' | 'done' | 'error';
  publicUrl?: string | null;
  storageKey?: string | null;
  cost: number;
  createdAt: string | Date;
}

interface AutoEditTabProps {
  projectId: string;
  clips: Clip[];
  autoEdits: AutoEdit[];
  onAutoEditCreated: () => void;
}

const MUSIC_TRACKS = [
  { key: 'cinematic', label: 'Cinematic', desc: 'Dramatic orchestral scores' },
  { key: 'upbeat', label: 'Upbeat', desc: 'Energetic and modern' },
  { key: 'calm', label: 'Calm', desc: 'Relaxing ambient vibes' },
  { key: 'modern', label: 'Modern', desc: 'Sleek electronic tones' },
  { key: 'warm', label: 'Warm', desc: 'Cozy acoustic warmth' },
];

type ViewState = 'idle' | 'generating' | 'rendering' | 'done' | 'error';

export function AutoEditTab({ projectId, clips, autoEdits: initialAutoEdits, onAutoEditCreated }: AutoEditTabProps) {
  const doneClips = clips.filter(c => c.status === 'done');
  const [selectedClipIds, setSelectedClipIds] = useState<string[]>([]);
  const [titleText, setTitleText] = useState('');
  const [musicKey, setMusicKey] = useState<string>('cinematic');
  const [viewState, setViewState] = useState<ViewState>('idle');
  const [autoEdits, setAutoEdits] = useState<AutoEdit[]>(initialAutoEdits);
  const [currentAutoEdit, setCurrentAutoEdit] = useState<AutoEdit | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Sync initial autoEdits
  useEffect(() => {
    setAutoEdits(initialAutoEdits);
  }, [initialAutoEdits]);

  // Poll auto-edit status
  const pollStatus = useCallback(async (autoEditId: string) => {
    try {
      const res = await fetch(`/api/auto-edits/${autoEditId}`, { credentials: 'include' });
      if (!res.ok) return;
      const { autoEdit } = await res.json();

      setAutoEdits(prev => prev.map(ae => ae.id === autoEditId ? autoEdit : ae));
      setCurrentAutoEdit(prev => prev?.id === autoEditId ? autoEdit : prev);

      if (autoEdit.status === 'done' || autoEdit.status === 'error') {
        setViewState(autoEdit.status === 'done' ? 'done' : 'error');
        if (pollingRef.current) clearInterval(pollingRef.current);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    if (!currentAutoEdit || currentAutoEdit.status === 'done') return;

    const status = currentAutoEdit.status as string;
    if (status === 'error') return;

    pollingRef.current = setInterval(() => {
      pollStatus(currentAutoEdit.id);
    }, 3000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [currentAutoEdit, pollStatus]);

  const toggleClip = (clipId: string) => {
    setSelectedClipIds(prev =>
      prev.includes(clipId)
        ? prev.filter(id => id !== clipId)
        : [...prev, clipId]
    );
  };

  const moveClip = (clipId: string, direction: 'up' | 'down') => {
    setSelectedClipIds(prev => {
      const idx = prev.indexOf(clipId);
      if (idx === -1) return prev;
      const newIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      return next;
    });
  };

  const handleGenerate = async () => {
    if (selectedClipIds.length === 0) {
      toast.error('Select at least one clip');
      return;
    }

    setViewState('generating');
    try {
      const res = await fetch('/api/auto-edits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          projectId,
          clipIds: selectedClipIds,
          titleText: titleText || undefined,
          musicKey: musicKey || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Failed to create auto-edit');
        setViewState('idle');
        return;
      }

      const { autoEdit } = await res.json();
      setAutoEdits(prev => [...prev, autoEdit]);
      setCurrentAutoEdit(autoEdit);
      toast.success('Auto-edit created! Rendering will begin shortly.');
      onAutoEditCreated();

      // Immediately trigger rendering
      setViewState('rendering');
      const patchRes = await fetch(`/api/auto-edits/${autoEdit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'rendering' }),
      });

      if (!patchRes.ok) {
        const err = await patchRes.json();
        toast.error(err.error || 'Failed to start rendering');
        setViewState('error');
        return;
      }

      const { autoEdit: updated } = await patchRes.json();
      setCurrentAutoEdit(updated);
      setAutoEdits(prev => prev.map(ae => ae.id === updated.id ? updated : ae));
    } catch {
      toast.error('Network error. Please try again.');
      setViewState('error');
    }
  };

  const handleDelete = async (autoEditId: string) => {
    try {
      const res = await fetch(`/api/auto-edits/${autoEditId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        toast.error('Failed to delete auto-edit');
        return;
      }
      setAutoEdits(prev => prev.filter(ae => ae.id !== autoEditId));
      toast.success('Auto-edit deleted');
    } catch {
      toast.error('Network error');
    }
  };

  const statusBadge = (status: AutoEdit['status']) => {
    const configs: Record<string, { icon: typeof Clock; className: string; animate?: boolean }> = {
      draft: { icon: Clock, className: 'text-slate-400 bg-slate-800' },
      rendering: { icon: Loader2, className: 'text-amber-400 bg-amber-900/30', animate: true },
      done: { icon: CheckCircle, className: 'text-emerald-400 bg-emerald-900/30' },
    };
    const cfg = configs[status] ?? configs.draft;
    return (
      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium', cfg.className)}>
        <cfg.icon className={cn('w-3 h-3', cfg.animate && 'animate-spin')} />
        {status}
      </span>
    );
  };

  const selectedClips = selectedClipIds
    .map(id => doneClips.find(c => c.id === id))
    .filter(Boolean) as Clip[];

  const renderContent = () => {
    if (viewState === 'error') {
      return (
        <div className="text-center py-8">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
          <p className="text-slate-300 font-medium mb-2">Something went wrong</p>
          <Button variant="secondary" onClick={() => setViewState('idle')}>Try Again</Button>
        </div>
      );
    }

    if (viewState === 'rendering' && currentAutoEdit) {
      return (
        <div className="text-center py-8">
          <Loader2 className="w-8 h-8 text-amber-400 mx-auto mb-3 animate-spin" />
          <p className="text-slate-300 font-medium mb-1">Rendering your video...</p>
          <p className="text-sm text-slate-500">This may take a few minutes. You can navigate away and return later.</p>
        </div>
      );
    }

    if (viewState === 'done' && currentAutoEdit) {
      return (
        <div className="text-center py-8">
          <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
          <p className="text-slate-300 font-medium mb-3">Your video is ready!</p>
          {currentAutoEdit.publicUrl ? (
            <div className="flex justify-center gap-3">
              <a href={currentAutoEdit.publicUrl} download target="_blank" rel="noopener noreferrer">
                <Button className="gap-2">
                  <Download className="w-4 h-4" /> Download MP4
                </Button>
              </a>
              <Button variant="secondary" onClick={() => setViewState('idle')}>Create Another</Button>
            </div>
          ) : (
            <Button variant="secondary" onClick={() => setViewState('idle')}>Create Another</Button>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Clip Selector */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-slate-300">Select Clips</label>
            <span className="text-xs text-slate-500">{selectedClipIds.length} selected</span>
          </div>
          {doneClips.length === 0 ? (
            <div className="border border-dashed border-slate-800 rounded-xl p-6 text-center">
              <Film className="w-6 h-6 text-slate-700 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No finished clips yet</p>
              <p className="text-xs text-slate-600 mt-1">Generate clips in the Clips tab first</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {doneClips.map(clip => (
                <button
                  key={clip.id}
                  onClick={() => toggleClip(clip.id)}
                  className={cn(
                    'relative rounded-lg overflow-hidden border-2 transition-colors aspect-video',
                    selectedClipIds.includes(clip.id)
                      ? 'border-blue-500 ring-2 ring-blue-500/30'
                      : 'border-slate-800 hover:border-slate-700'
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={clip.publicUrl || ''}
                    alt="Clip thumbnail"
                    className="w-full h-full object-cover"
                  />
                  {selectedClipIds.includes(clip.id) && (
                    <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                      <span className="bg-blue-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                        {selectedClipIds.indexOf(clip.id) + 1}
                      </span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Clip Arrangement (if any selected) */}
        {selectedClips.length > 1 && (
          <div>
            <label className="text-sm font-medium text-slate-300 mb-2 block">Arrange Order</label>
            <div className="space-y-1">
              {selectedClips.map((clip, idx) => (
                <div key={clip.id} className="flex items-center gap-2 bg-slate-800/50 rounded-lg px-3 py-2">
                  <span className="text-xs font-mono text-slate-500 w-5">{idx + 1}.</span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={clip.publicUrl || ''} alt="" className="w-10 h-6 object-cover rounded" />
                  <span className="text-xs text-slate-400 flex-1 truncate">{clip.motionStyle} · {clip.resolution}</span>
                  <button
                    onClick={() => moveClip(clip.id, 'up')}
                    disabled={idx === 0}
                    className="p-1 text-slate-500 hover:text-slate-300 disabled:opacity-30"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => moveClip(clip.id, 'down')}
                    disabled={idx === selectedClips.length - 1}
                    className="p-1 text-slate-500 hover:text-slate-300 disabled:opacity-30"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Title Input */}
        <div>
          <label className="text-sm font-medium text-slate-300 mb-2 block">Title Screen</label>
          <input
            type="text"
            value={titleText}
            onChange={e => setTitleText(e.target.value)}
            placeholder="123 Main Street, Los Angeles CA"
            className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-slate-600 mt-1">Property address or title to display at start</p>
        </div>

        {/* Music Picker */}
        <div>
          <label className="text-sm font-medium text-slate-300 mb-2 block">Background Music</label>
          <div className="space-y-1.5">
            {MUSIC_TRACKS.map(track => (
              <label
                key={track.key}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors',
                  musicKey === track.key
                    ? 'bg-blue-600/10 border-blue-500/50 text-blue-300'
                    : 'bg-slate-800/50 border-slate-800 text-slate-400 hover:border-slate-700'
                )}
              >
                <input
                  type="radio"
                  name="musicKey"
                  value={track.key}
                  checked={musicKey === track.key}
                  onChange={() => setMusicKey(track.key)}
                  className="sr-only"
                />
                <Music className="w-4 h-4 shrink-0" />
                <span className="text-sm font-medium flex-1">{track.label}</span>
                <span className="text-xs text-slate-500">{track.desc}</span>
              </label>
            ))}
            <label
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors',
                musicKey === 'ai_generate'
                  ? 'bg-blue-600/10 border-blue-500/50 text-blue-300'
                  : 'bg-slate-800/50 border-slate-800 text-slate-400 hover:border-slate-700'
              )}
            >
              <input
                type="radio"
                name="musicKey"
                value="ai_generate"
                checked={musicKey === 'ai_generate'}
                onChange={() => setMusicKey('ai_generate')}
                className="sr-only"
              />
              <Sparkles className="w-4 h-4 shrink-0" />
              <span className="text-sm font-medium flex-1">AI Generate</span>
              <span className="text-xs text-slate-500">$2 per song</span>
            </label>
          </div>
        </div>

        {/* Generate Button */}
        <Button
          onClick={handleGenerate}
          disabled={selectedClipIds.length === 0 || viewState === 'generating'}
          loading={viewState === 'generating'}
          size="lg"
          className="w-full gap-2"
        >
          <Sparkles className="w-4 h-4" />
          Generate Auto-Edit
          {selectedClipIds.length > 0 && (
            <span className="text-xs opacity-70">({selectedClipIds.length} clip{selectedClipIds.length !== 1 ? 's' : ''})</span>
          )}
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Main editor panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        {renderContent()}
      </div>

      {/* Existing auto-edits list */}
      {autoEdits.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-slate-400 mb-3">Previous Auto-Edits</h3>
          <div className="space-y-2">
            {autoEdits.map(ae => (
              <div key={ae.id} className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-lg px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {statusBadge(ae.status)}
                    <span className="text-xs text-slate-500">
                      {ae.clipIds.length} clips · {ae.id.slice(0, 8)}...
                    </span>
                  </div>
                  {ae.titleText && (
                    <p className="text-sm text-slate-300 truncate">{ae.titleText}</p>
                  )}
                  <p className="text-xs text-slate-600">
                    {new Date(ae.createdAt).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {ae.status === 'done' && ae.publicUrl && (
                    <a href={ae.publicUrl} download target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="secondary" className="gap-1">
                        <Download className="w-3.5 h-3.5" /> Download
                      </Button>
                    </a>
                  )}
                  {ae.status === 'draft' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={async () => {
                        setCurrentAutoEdit(ae);
                        setViewState('rendering');
                        await fetch(`/api/auto-edits/${ae.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          credentials: 'include',
                          body: JSON.stringify({ status: 'rendering' }),
                        });
                        pollStatus(ae.id);
                      }}
                      className="gap-1"
                    >
                      <Sparkles className="w-3.5 h-3.5" /> Render
                    </Button>
                  )}
                  <button
                    onClick={() => handleDelete(ae.id)}
                    className="p-1.5 text-slate-600 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
