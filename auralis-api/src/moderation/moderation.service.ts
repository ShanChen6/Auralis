import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { estimateTimestamps, splitParagraphs } from '../common/text.js';
import {
  AudioSource,
  AudioStatus,
  NarrationStatus,
  PostStatus,
} from '../generated/prisma/enums.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ContentEvents } from '../security/web-revalidator.service.js';
import type {
  ApprovePostInput,
  RejectInput,
  UpdatePostInput,
} from './moderation.schemas.js';

const reviewSelect = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  moodTag: true,
  status: true,
  audioSource: true,
  audioStatus: true,
  audioUrl: true,
  duration: true,
  voiceName: true,
  backgroundMusic: true,
  isFeatured: true,
  rejectReason: true,
  createdAt: true,
  publishedAt: true,
  author: { select: { username: true, displayName: true } },
  narrator: { select: { username: true, displayName: true } },
  category: { select: { slug: true, name: true } },
  content: { select: { content: true, wordCount: true } },
} satisfies Prisma.PostSelect;

export type ReviewPost = Prisma.PostGetPayload<{ select: typeof reviewSelect }>;

const narrationSelect = {
  id: true,
  status: true,
  audioUrl: true,
  duration: true,
  note: true,
  rejectReason: true,
  createdAt: true,
  updatedAt: true,
  narrator: { select: { username: true, displayName: true } },
  post: {
    select: {
      id: true,
      slug: true,
      title: true,
      audioStatus: true,
      content: { select: { content: true } },
    },
  },
} satisfies Prisma.NarrationClaimSelect;

export type ReviewNarration = Prisma.NarrationClaimGetPayload<{
  select: typeof narrationSelect;
}>;

@Injectable()
export class ModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: ContentEvents,
  ) {}

  async stats(): Promise<{
    pendingPosts: number;
    submittedNarrations: number;
  }> {
    const [pendingPosts, submittedNarrations] = await Promise.all([
      this.prisma.post.count({ where: { status: PostStatus.PENDING } }),
      this.prisma.narrationClaim.count({
        where: { status: NarrationStatus.SUBMITTED },
      }),
    ]);
    return { pendingPosts, submittedNarrations };
  }

  listPosts(status: PostStatus): Promise<ReviewPost[]> {
    return this.prisma.post.findMany({
      where: { status },
      // Hàng chờ duyệt: bài cũ trước; các trạng thái khác: mới nhất trước
      orderBy: { createdAt: status === PostStatus.PENDING ? 'asc' : 'desc' },
      take: 100,
      select: reviewSelect,
    });
  }

  async approvePost(
    reviewerId: string,
    id: string,
    input: ApprovePostInput,
  ): Promise<ReviewPost> {
    const post = await this.findPost(id);
    if (post.status !== PostStatus.PENDING) {
      throw new ConflictException('Chỉ duyệt được bài đang chờ duyệt');
    }
    if (post.audioStatus === AudioStatus.PROCESSING) {
      throw new ConflictException(
        'Radio AI đang được tạo, hãy đợi xong rồi duyệt',
      );
    }
    const published = await this.prisma.post.update({
      where: { id },
      data: {
        status: PostStatus.PUBLISHED,
        publishedAt: new Date(),
        rejectReason: null,
        reviewer: { connect: { id: reviewerId } },
        ...(input.moodTag ? { moodTag: input.moodTag } : {}),
        ...(input.isFeatured !== undefined
          ? { isFeatured: input.isFeatured }
          : {}),
      },
      select: reviewSelect,
    });
    await this.events.postsChanged([published.slug]);
    return published;
  }

  async rejectPost(
    reviewerId: string,
    id: string,
    input: RejectInput,
  ): Promise<ReviewPost> {
    const post = await this.findPost(id);
    if (post.status !== PostStatus.PENDING) {
      throw new ConflictException('Chỉ từ chối được bài đang chờ duyệt');
    }
    return this.prisma.post.update({
      where: { id },
      data: {
        status: PostStatus.REJECTED,
        rejectReason: input.reason,
        reviewer: { connect: { id: reviewerId } },
      },
      select: reviewSelect,
    });
  }

  async updatePost(id: string, input: UpdatePostInput): Promise<ReviewPost> {
    await this.findPost(id);
    const post = await this.prisma.post.update({
      where: { id },
      data: input,
      select: reviewSelect,
    });
    if (post.status === PostStatus.PUBLISHED) {
      await this.events.postsChanged([post.slug]);
    }
    return post;
  }

  listNarrations(status: NarrationStatus): Promise<ReviewNarration[]> {
    return this.prisma.narrationClaim.findMany({
      where: { status },
      orderBy: { updatedAt: 'asc' },
      take: 100,
      select: narrationSelect,
    });
  }

  /** Duyệt bản lồng tiếng: gắn audio vào bài, các bản khác của bài đó bị từ chối */
  async approveNarration(id: string): Promise<ReviewNarration> {
    const claim = await this.prisma.narrationClaim.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        audioUrl: true,
        duration: true,
        narratorId: true,
        post: {
          select: {
            id: true,
            audioStatus: true,
            content: { select: { content: true } },
          },
        },
      },
    });
    if (!claim) throw new NotFoundException('Không tìm thấy bản lồng tiếng');
    if (
      claim.status !== NarrationStatus.SUBMITTED ||
      !claim.audioUrl ||
      !claim.duration
    ) {
      throw new ConflictException('Chỉ duyệt được bản lồng tiếng đã nộp');
    }
    if (claim.post.audioStatus !== AudioStatus.TEXT_ONLY) {
      throw new ConflictException('Bài viết này đã có giọng đọc');
    }
    const paragraphs = splitParagraphs(claim.post.content?.content ?? '');

    const approved = await this.prisma.$transaction(async (tx) => {
      await tx.post.update({
        where: { id: claim.post.id },
        data: {
          audioUrl: claim.audioUrl,
          duration: claim.duration,
          audioSource: AudioSource.UPLOAD,
          audioStatus: AudioStatus.READY,
          voiceName: null,
          narrator: { connect: { id: claim.narratorId } },
          content: {
            update: {
              timestamps: estimateTimestamps(paragraphs, claim.duration ?? 0),
            },
          },
        },
      });
      await tx.narrationClaim.updateMany({
        where: {
          postId: claim.post.id,
          id: { not: id },
          status: { in: [NarrationStatus.CLAIMED, NarrationStatus.SUBMITTED] },
        },
        data: {
          status: NarrationStatus.REJECTED,
          rejectReason: 'Bài viết đã có giọng đọc khác được chọn. Cảm ơn bạn!',
        },
      });
      return tx.narrationClaim.update({
        where: { id },
        data: { status: NarrationStatus.APPROVED, rejectReason: null },
        select: narrationSelect,
      });
    });
    await this.events.postsChanged([approved.post.slug]);
    return approved;
  }

  async rejectNarration(
    id: string,
    input: RejectInput,
  ): Promise<ReviewNarration> {
    const claim = await this.prisma.narrationClaim.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!claim) throw new NotFoundException('Không tìm thấy bản lồng tiếng');
    if (claim.status !== NarrationStatus.SUBMITTED) {
      throw new ConflictException('Chỉ từ chối được bản lồng tiếng đã nộp');
    }
    return this.prisma.narrationClaim.update({
      where: { id },
      data: { status: NarrationStatus.REJECTED, rejectReason: input.reason },
      select: narrationSelect,
    });
  }

  private async findPost(id: string) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      select: { id: true, status: true, audioStatus: true },
    });
    if (!post) throw new NotFoundException('Không tìm thấy bài viết');
    return post;
  }
}
