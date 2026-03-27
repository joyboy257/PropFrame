import { z } from 'zod';

export const SKY_STYLES = ['blue-sky', 'golden-hour', 'twilight', 'custom'] as const;
export type SkyStyle = typeof SKY_STYLES[number];

export const SkyReplaceJobSchema = z.object({
  photoId: z.string().uuid(),
  userId: z.string().uuid(),
  skyStyle: z.enum(SKY_STYLES),
  customSkyUrl: z.string().url().optional(),
  originalStorageKey: z.string(),
  originalPublicUrl: z.string().url(),
});

export type SkyReplaceJob = z.infer<typeof SkyReplaceJobSchema>;
