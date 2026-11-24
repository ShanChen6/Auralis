import { z } from 'zod';
import { MoodTag } from '../generated/prisma/enums.js';

export const MAX_SCRIPT_WORDS = Number(process.env.RADIO_MAX_WORDS ?? 3000);

const audioSchema = z.discriminatedUnion('mode', [
  /** Tự thu âm & tải lên qua Presigned URL */
  z.object({
    mode: z.literal('upload'),
    audioUrl: z.url(),
    duration: z
      .number()
      .positive()
      .max(4 * 3600),
  }),
  /** Tạo Radio AI tự động */
  z.object({
    mode: z.literal('ai'),
    voice: z.enum(['female_warm', 'male_deep', 'studio']),
    music: z.enum(['piano_rain', 'lofi_warm', 'acoustic_night']).nullable(),
  }),
  /** Chỉ đăng chữ – mời cộng đồng lồng tiếng */
  z.object({ mode: z.literal('none') }),
]);

export const createPostSchema = z.object({
  title: z.string().trim().min(3, 'Tiêu đề tối thiểu 3 ký tự').max(200),
  summary: z.string().trim().max(500).optional(),
  moodTag: z.enum(MoodTag),
  categorySlug: z.string().max(120).optional(),
  content: z
    .string()
    .trim()
    .min(20, 'Nội dung quá ngắn')
    .max(60_000)
    .refine((v) => v.split(/\s+/).filter(Boolean).length <= MAX_SCRIPT_WORDS, {
      message: `Nội dung tối đa ${MAX_SCRIPT_WORDS} từ`,
    }),
  audio: audioSchema,
});

export type CreatePostInput = z.infer<typeof createPostSchema>;
