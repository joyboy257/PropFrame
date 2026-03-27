/**
 * Music track constants for PropFrame auto-edit feature.
 * Tracks should be uploaded to R2 storage at: music/{key}.mp3
 */

export const MUSIC_TRACKS = {
  'upbeat-1': {
    name: 'Morning Drive',
    mood: 'upbeat, optimistic',
    duration: 60,
    url: 'music/upbeat-1.mp3',
  },
  'warm-1': {
    name: 'Golden Hour',
    mood: 'warm, relaxed',
    duration: 60,
    url: 'music/warm-1.mp3',
  },
  'modern-1': {
    name: 'Clean Lines',
    mood: 'modern, minimal',
    duration: 60,
    url: 'music/modern-1.mp3',
  },
  'cinematic-1': {
    name: 'Wide Open',
    mood: 'cinematic, dramatic',
    duration: 60,
    url: 'music/cinematic-1.mp3',
  },
  'acoustic-1': {
    name: 'Sunday Light',
    mood: 'acoustic, peaceful',
    duration: 60,
    url: 'music/acoustic-1.mp3',
  },
} as const;

export type MusicTrackKey = keyof typeof MUSIC_TRACKS;
