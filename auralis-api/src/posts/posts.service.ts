import { Injectable, NotFoundException } from '@nestjs/common';
import { MoodTag, PostStatus } from '../generated/prisma/enums.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { splitParagraphs } from '../common/text.js';
import type {
  PostCard,
  PostDetail,
  PostList,
  PostTimestamp,
} from './posts.types.js';

const cardSelect = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  coverUrl: true,
  audioUrl: true,
  duration: true,
  moodTag: true,
  voiceName: true,
  backgroundMusic: true,
  listenCount: true,
  publishedAt: true,
  author: { select: { username: true, displayName: true, avatarUrl: true } },
  narrator: { select: { username: true, displayName: true } },
  category: { select: { slug: true, name: true } },
} satisfies Prisma.PostSelect;

type CardRow = Prisma.PostGetPayload<{ select: typeof cardSelect }>;

export interface ListPostsQuery {
  mood?: MoodTag;
  category?: string;
  limit?: number;
  cursor?: string;
}

export { splitParagraphs } from '../common/text.js';

export function isMoodTag(value: unknown): value is MoodTag {
  return typeof value === 'string' && value in MoodTag;
}

function toCard(row: CardRow): PostCard {
  return { ...row, publishedAt: row.publishedAt?.toISOString() ?? null };
}

function toTimestamps(value: unknown): PostTimestamp[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (t): t is PostTimestamp =>
      typeof t === 'object' &&
      t !== null &&
      typeof (t as PostTimestamp).index === 'number' &&
      typeof (t as PostTimestamp).start === 'number' &&
      typeof (t as PostTimestamp).end === 'number',
  );
}

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}

  async findFeatured(limit = 5): Promise<PostCard[]> {
    const rows = await this.prisma.post.findMany({
      where: { status: PostStatus.PUBLISHED, isFeatured: true },
      orderBy: { publishedAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 20),
      select: cardSelect,
    });
    return rows.map(toCard);
  }

  async findMany(query: ListPostsQuery = {}): Promise<PostList> {
    const take = Math.min(Math.max(query.limit ?? 20, 1), 50);
    const rows = await this.prisma.post.findMany({
      where: {
        status: PostStatus.PUBLISHED,
        ...(query.mood ? { moodTag: query.mood } : {}),
        ...(query.category ? { category: { slug: query.category } } : {}),
      },
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      select: cardSelect,
    });
    const hasMore = rows.length > take;
    const items = rows.slice(0, take).map(toCard);
    return { items, nextCursor: hasMore ? items[items.length - 1].id : null };
  }

  async findBySlug(slug: string): Promise<PostDetail> {
    const row = await this.prisma.post.findFirst({
      where: { slug, status: PostStatus.PUBLISHED },
      select: {
        ...cardSelect,
        content: {
          select: { content: true, timestamps: true, wordCount: true },
        },
      },
    });
    if (!row) {
      throw new NotFoundException(`Không tìm thấy số Radio "${slug}"`);
    }
    const { content, ...card } = row;
    return {
      ...toCard(card),
      paragraphs: content ? splitParagraphs(content.content) : [],
      timestamps: toTimestamps(content?.timestamps),
      wordCount: content?.wordCount ?? 0,
    };
  }
}
