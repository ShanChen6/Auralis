import type { MoodTag } from '../generated/prisma/enums.js';

export interface PostTimestamp {
  index: number;
  start: number;
  end: number;
}

export interface PostCard {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  coverUrl: string | null;
  audioUrl: string | null;
  /** Thời lượng (giây) */
  duration: number | null;
  moodTag: MoodTag;
  voiceName: string | null;
  backgroundMusic: string | null;
  listenCount: number;
  publishedAt: string | null;
  author: { username: string; displayName: string; avatarUrl: string | null };
  narrator: { username: string; displayName: string } | null;
  category: { slug: string; name: string } | null;
}

export interface PostDetail extends PostCard {
  /** Nội dung đã tách đoạn (khớp với index của timestamps) */
  paragraphs: string[];
  timestamps: PostTimestamp[];
  wordCount: number;
}

export interface PostList {
  items: PostCard[];
  nextCursor: string | null;
}

export interface RankedPost extends PostCard {
  weeklyListens: number;
}
