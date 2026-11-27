import { Injectable, NotFoundException } from '@nestjs/common';
import { MoodTag, PostStatus } from '../generated/prisma/enums.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CacheService } from '../redis/cache.service.js';
import { ListenRankingService } from '../security/listen-ranking.service.js';
import { splitParagraphs } from '../common/text.js';
import type {
  PostCard,
  PostDetail,
  PostList,
  PostTimestamp,
  RankedPost,
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

/** TTL cache Redis (giây) – cache còn bị xóa ngay khi có bài xuất bản/cập nhật */
const CACHE_TTL = 600;

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly ranking: ListenRankingService,
  ) {}

  findFeatured(limit = 5): Promise<PostCard[]> {
    const take = Math.min(Math.max(limit, 1), 20);
    return this.cache.getOrSet(`posts:featured:${take}`, CACHE_TTL, () =>
      this.queryFeatured(take),
    );
  }

  private async queryFeatured(limit: number): Promise<PostCard[]> {
    const rows = await this.prisma.post.findMany({
      where: { status: PostStatus.PUBLISHED, isFeatured: true },
      orderBy: { publishedAt: 'desc' },
      take: limit,
      select: cardSelect,
    });
    return rows.map(toCard);
  }

  findMany(query: ListPostsQuery = {}): Promise<PostList> {
    // Chỉ cache trang đầu (trang chủ, bộ lọc tâm trạng/chuyên mục)
    if (query.cursor) return this.queryMany(query);
    const key = `posts:list:${query.mood ?? '-'}:${query.category ?? '-'}:${query.limit ?? 20}`;
    return this.cache.getOrSet(key, CACHE_TTL, () => this.queryMany(query));
  }

  private async queryMany(query: ListPostsQuery): Promise<PostList> {
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
    const post = await this.cache.getOrSet(
      `posts:detail:${slug}`,
      CACHE_TTL,
      () => this.queryBySlug(slug),
    );
    if (!post) throw new NotFoundException(`Không tìm thấy số Radio "${slug}"`);
    return post;
  }

  private async queryBySlug(slug: string): Promise<PostDetail | null> {
    const row = await this.prisma.post.findFirst({
      where: { slug, status: PostStatus.PUBLISHED },
      select: {
        ...cardSelect,
        content: {
          select: { content: true, timestamps: true, wordCount: true },
        },
      },
    });
    if (!row) return null;
    const { content, ...card } = row;
    return {
      ...toCard(card),
      paragraphs: content ? splitParagraphs(content.content) : [],
      timestamps: toTimestamps(content?.timestamps),
      wordCount: content?.wordCount ?? 0,
    };
  }

  /** "Nghe nhiều trong tuần": theo lượt nghe tuần này, bù bằng tổng lượt nghe nếu chưa đủ */
  topOfWeek(limit = 5): Promise<RankedPost[]> {
    const take = Math.min(Math.max(limit, 1), 20);
    return this.cache.getOrSet(
      `posts:top-week:${take}`,
      CACHE_TTL,
      async () => {
        const weekly = await this.ranking.topOfWeek(take);
        const weeklyIds = weekly.map((w) => w.postId);
        const [ranked, extra] = await Promise.all([
          weeklyIds.length
            ? this.prisma.post.findMany({
                where: { id: { in: weeklyIds }, status: PostStatus.PUBLISHED },
                select: cardSelect,
              })
            : Promise.resolve([]),
          this.prisma.post.findMany({
            where: {
              status: PostStatus.PUBLISHED,
              audioUrl: { not: null },
              id: { notIn: weeklyIds },
            },
            orderBy: [{ listenCount: 'desc' }, { publishedAt: 'desc' }],
            take,
            select: cardSelect,
          }),
        ]);
        const byId = new Map(ranked.map((p) => [p.id, p]));
        const fromWeek = weekly
          .filter((w) => byId.has(w.postId))
          .map((w) => ({
            ...toCard(byId.get(w.postId)!),
            weeklyListens: w.listens,
          }));
        const filler = extra.map((p) => ({ ...toCard(p), weeklyListens: 0 }));
        return [...fromWeek, ...filler].slice(0, take);
      },
    );
  }

  /** Ghi một lượt nghe; cùng người nghe cùng bài chỉ tính 1 lần mỗi giờ */
  async recordListen(
    postId: string,
    listener: string,
  ): Promise<{ counted: boolean }> {
    const exists = await this.prisma.post.findFirst({
      where: { id: postId, status: PostStatus.PUBLISHED },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Không tìm thấy số Radio');
    const counted = await this.ranking.record(postId, listener);
    if (counted) {
      await this.prisma.post.update({
        where: { id: postId },
        data: { listenCount: { increment: 1 } },
      });
    }
    return { counted };
  }
}
