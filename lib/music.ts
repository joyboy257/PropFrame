/**
 * Music track constants for PropFrame auto-edit feature.
 * Using copyright-free music from Pixabay CDN.
 */

export const MUSIC_TRACKS = {
  'upbeat-1': {
    name: 'Morning Drive',
    mood: 'upbeat, optimistic',
    duration: 60,
    url: 'https://cdn.pixabay.com/audio/2022/03/24/audio_1ec46ab521.mp3',
  },
  'warm-1': {
    name: 'Golden Hour',
    mood: 'warm, relaxed',
    duration: 60,
    url: 'https://cdn.pixabay.com/audio/2021/08/04/audio_a1e6b8e85e.mp3',
  },
  'modern-1': {
    name: 'Clean Lines',
    mood: 'modern, minimal',
    duration: 60,
    url: 'https://cdn.pixabay.com/audio/2022/10/25/audio_bf0d99e4e6.mp3',
  },
  'cinematic-1': {
    name: 'Wide Open',
    mood: 'cinematic, dramatic',
    duration: 60,
    url: 'https://cdn.pixabay.com/audio/2023/07/06/audio_88c74ab61b.mp3',
  },
  'acoustic-1': {
    name: 'Sunday Light',
    mood: 'acoustic, peaceful',
    duration: 60,
    url: 'https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3',
  },
} as const;

// TODO (future): AI-generated music. Currently using copyright-free CDN tracks.
// When AI music generation is implemented, add credit cost here and remove this comment.
export const MUSIC_TRACK_COST = 0; // Currently free (CDN tracks, not AI-generated)

export type MusicTrackKey = keyof typeof MUSIC_TRACKS;
