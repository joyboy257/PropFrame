'use client';

import { useEffect, useRef } from 'react';
import { X, Download } from 'lucide-react';

interface VideoModalProps {
  clip: {
    id: string;
    publicUrl: string | null;
    motionStyle: string;
    resolution: string;
  };
  onClose: () => void;
}

export function VideoModal({ clip, onClose }: VideoModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-3xl mx-4 rounded-xl overflow-hidden bg-slate-900 border border-slate-800 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-300 font-medium capitalize">{clip.motionStyle}</span>
            <span className="text-xs text-slate-600">|</span>
            <span className="text-xs text-slate-500 font-mono">{clip.resolution}</span>
          </div>
          <div className="flex items-center gap-2">
            {clip.publicUrl && (
              <a
                href={clip.publicUrl}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors"
                title="Download"
              >
                <Download className="w-4 h-4" />
              </a>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Video */}
        <div className="aspect-video bg-black flex items-center justify-center">
          {clip.publicUrl ? (
            <video
              ref={videoRef}
              src={clip.publicUrl}
              controls
              autoPlay
              className="w-full h-full object-contain"
            />
          ) : (
            <p className="text-slate-500 text-sm">Video not available</p>
          )}
        </div>
      </div>
    </div>
  );
}
