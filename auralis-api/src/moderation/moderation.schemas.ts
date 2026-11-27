import { z } from 'zod';
import {
  MoodTag,
  NarrationStatus,
  PostStatus,
} from '../generated/prisma/enums.js';

export const approvePostSchema = z.object({
  moodTag: z.enum(MoodTag).optional(),
  isFeatured: z.boolean().optional(),
});
export type ApprovePostInput = z.infer<typeof approvePostSchema>;

export const rejectSchema = z.object({
  reason: z.string().trim().min(5, 'Lý do tối thiểu 5 ký tự').max(500),
});
export type RejectInput = z.infer<typeof rejectSchema>;

export const updatePostSchema = z.object({
  moodTag: z.enum(MoodTag).optional(),
  isFeatured: z.boolean().optional(),
});
export type UpdatePostInput = z.infer<typeof updatePostSchema>;

export const postStatusQuery = z.object({
  status: z.enum(PostStatus).default(PostStatus.PENDING),
});

export const narrationStatusQuery = z.object({
  status: z.enum(NarrationStatus).default(NarrationStatus.SUBMITTED),
});
