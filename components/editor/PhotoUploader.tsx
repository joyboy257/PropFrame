'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface UploadedFile {
  id: string;
  file: File;
  preview: string;
  uploading: boolean;
  uploaded: boolean;
  storageKey?: string;
  error?: string;
}

interface PhotoUploaderProps {
  projectId: string;
  onPhotoUploaded: (photo: { id: string; storageKey: string; filename: string; publicUrl: string | null; order: number }) => void;
  maxFiles?: number;
}

export function PhotoUploader({ projectId, onPhotoUploaded, maxFiles = 50 }: PhotoUploaderProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploadingCount, setUploadingCount] = useState(0);

  const uploadFile = useCallback(async (uploadedFile: UploadedFile) => {
    setFiles(prev =>
      prev.map(f => f.id === uploadedFile.id ? { ...f, uploading: true } : f)
    );

    try {
      // 1. Get presigned URL
      const presignRes = await fetch('/api/upload/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          filename: uploadedFile.file.name,
          contentType: uploadedFile.file.type,
          type: 'photo',
        }),
      });

      if (!presignRes.ok) throw new Error('Failed to get upload URL');
      const { uploadUrl, storageKey } = await presignRes.json();

      // 2. Upload directly to R2 (or mock endpoint)
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: uploadedFile.file,
        headers: { 'Content-Type': uploadedFile.file.type },
      });

      if (!uploadRes.ok) throw new Error('Upload to storage failed');

      // 3. Confirm upload with backend
      const confirmRes = await fetch('/api/upload/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          projectId,
          storageKey,
          filename: uploadedFile.file.name,
          type: 'photo',
        }),
      });

      if (!confirmRes.ok) throw new Error('Failed to confirm upload. Please try again.');
      const { photo } = await confirmRes.json();

      setFiles(prev =>
        prev.map(f => f.id === uploadedFile.id ? { ...f, uploading: false, uploaded: true } : f)
      );

      onPhotoUploaded(photo);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      toast.error(msg);
      setFiles(prev =>
        prev.map(f => f.id === uploadedFile.id ? { ...f, uploading: false, error: msg } : f)
      );
    }
  }, [projectId, onPhotoUploaded]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (files.length + acceptedFiles.length > maxFiles) {
      acceptedFiles = acceptedFiles.slice(0, maxFiles - files.length);
    }

    const newFiles: UploadedFile[] = acceptedFiles.map(file => ({
      id: Math.random().toString(36).slice(2),
      file,
      preview: URL.createObjectURL(file),
      uploading: false,
      uploaded: false,
    }));

    setFiles(prev => [...prev, ...newFiles]);

    // Upload each file
    for (const f of newFiles) {
      await uploadFile(f);
    }
  }, [files, maxFiles, uploadFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
      'image/heic': ['.heic'],
    },
    maxSize: 25 * 1024 * 1024, // 25MB
    disabled: files.length >= maxFiles,
  });

  const removeFile = (id: string) => {
    setFiles(prev => {
      const file = prev.find(f => f.id === id);
      if (file) URL.revokeObjectURL(file.preview);
      return prev.filter(f => f.id !== id);
    });
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all',
          isDragActive
            ? 'border-blue-500 bg-blue-500/5'
            : 'border-slate-700 hover:border-slate-600 bg-slate-900/50',
          files.length >= maxFiles && 'opacity-50 cursor-not-allowed'
        )}
      >
        <input {...getInputProps()} />
        <Upload className={cn('w-8 h-8 mx-auto mb-3', isDragActive ? 'text-blue-400' : 'text-slate-600')} />
        <p className="text-sm text-slate-400">
          {isDragActive ? (
            <span className="text-blue-400">Drop photos here</span>
          ) : (
            <>
              <span className="text-slate-300 font-medium">Click to upload</span> or drag and drop
              <br />
              <span className="text-slate-600">JPG, PNG, WebP, HEIC — up to 25MB each, max {maxFiles} photos</span>
            </>
          )}
        </p>
      </div>

      {/* File previews */}
      {files.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {files.map(file => (
            <div key={file.id} className="relative aspect-square group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={file.preview}
                alt={file.file.name}
                className={cn(
                  'w-full h-full object-cover rounded-lg',
                  file.uploading && 'opacity-50',
                  file.error && 'ring-2 ring-red-500'
                )}
              />

              {/* Overlay states */}
              {file.uploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg">
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                </div>
              )}
              {file.uploaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-emerald-500/20 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-xs text-emerald-400 font-medium">Done</span>
                </div>
              )}
              {file.error && (
                <div className="absolute inset-0 flex items-center justify-center bg-red-500/20 rounded-lg">
                  <span className="text-xs text-red-400">Error</span>
                </div>
              )}

              {/* Remove button */}
              <button
                onClick={() => removeFile(file.id)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:border-red-500"
              >
                <X className="w-3 h-3 text-slate-400" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Progress summary */}
      {files.length > 0 && (
        <div className="text-xs text-slate-500">
          {files.filter(f => f.uploaded).length} / {files.length} uploaded
          {files.some(f => f.uploading) && ' · uploading...'}
        </div>
      )}
    </div>
  );
}
