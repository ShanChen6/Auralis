import { z } from 'zod';

export const claimSchema = z.object({ postId: z.uuid() });
export type ClaimInput = z.infer<typeof claimSchema>;

export const submitSchema = z.object({
  audioUrl: z.url(),
  duration: z
    .number()
    .positive()
    .max(4 * 3600),
  note: z.string().trim().max(500).optional(),
});
export type SubmitInput = z.infer<typeof submitSchema>;
