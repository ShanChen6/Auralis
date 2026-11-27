import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AudioStatus,
  NarrationStatus,
  PostStatus,
} from '../generated/prisma/enums.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import type { ClaimInput, SubmitInput } from './narrations.schemas.js';

const claimSelect = {
  id: true,
  status: true,
  audioUrl: true,
  duration: true,
  note: true,
  rejectReason: true,
  createdAt: true,
  updatedAt: true,
  post: {
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      moodTag: true,
      audioStatus: true,
      content: { select: { content: true, wordCount: true } },
    },
  },
} satisfies Prisma.NarrationClaimSelect;

export type MyNarration = Prisma.NarrationClaimGetPayload<{
  select: typeof claimSelect;
}>;

export interface OpenPost {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  moodTag: string;
  wordCount: number;
  author: { displayName: string };
  claimCount: number;
  myClaim: { id: string; status: NarrationStatus } | null;
}

@Injectable()
export class NarrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /** Bài đã xuất bản nhưng chỉ có chữ – đang cần giọng đọc */
  async listOpen(userId?: string): Promise<OpenPost[]> {
    const posts = await this.prisma.post.findMany({
      where: {
        status: PostStatus.PUBLISHED,
        audioStatus: AudioStatus.TEXT_ONLY,
      },
      orderBy: { publishedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        slug: true,
        title: true,
        summary: true,
        moodTag: true,
        author: { select: { displayName: true } },
        content: { select: { wordCount: true } },
        narrations: {
          where: {
            status: {
              in: [NarrationStatus.CLAIMED, NarrationStatus.SUBMITTED],
            },
          },
          select: { id: true, status: true, narratorId: true },
        },
      },
    });
    return posts.map(({ narrations, content, ...post }) => {
      const mine = userId
        ? narrations.find((n) => n.narratorId === userId)
        : undefined;
      return {
        ...post,
        wordCount: content?.wordCount ?? 0,
        claimCount: narrations.length,
        myClaim: mine ? { id: mine.id, status: mine.status } : null,
      };
    });
  }

  listMine(userId: string): Promise<MyNarration[]> {
    return this.prisma.narrationClaim.findMany({
      where: { narratorId: userId },
      orderBy: { updatedAt: 'desc' },
      select: claimSelect,
    });
  }

  async claim(userId: string, input: ClaimInput): Promise<MyNarration> {
    const post = await this.prisma.post.findUnique({
      where: { id: input.postId },
      select: { status: true, audioStatus: true },
    });
    if (!post || post.status !== PostStatus.PUBLISHED) {
      throw new NotFoundException('Không tìm thấy bài viết');
    }
    if (post.audioStatus !== AudioStatus.TEXT_ONLY) {
      throw new ConflictException('Bài viết này đã có giọng đọc');
    }
    const existing = await this.prisma.narrationClaim.findUnique({
      where: {
        postId_narratorId: { postId: input.postId, narratorId: userId },
      },
      select: { id: true, status: true },
    });
    if (existing) {
      if (
        existing.status === NarrationStatus.CLAIMED ||
        existing.status === NarrationStatus.SUBMITTED
      ) {
        throw new ConflictException('Bạn đã nhận lồng tiếng bài này rồi');
      }
      if (existing.status === NarrationStatus.APPROVED) {
        throw new ConflictException('Bản lồng tiếng của bạn đã được duyệt');
      }
      // Đã rút / bị từ chối trước đó → nhận lại
      return this.prisma.narrationClaim.update({
        where: { id: existing.id },
        data: {
          status: NarrationStatus.CLAIMED,
          rejectReason: null,
          audioUrl: null,
          duration: null,
        },
        select: claimSelect,
      });
    }
    return this.prisma.narrationClaim.create({
      data: { postId: input.postId, narratorId: userId },
      select: claimSelect,
    });
  }

  async submit(
    userId: string,
    id: string,
    input: SubmitInput,
  ): Promise<MyNarration> {
    const claim = await this.findOwn(userId, id);
    if (
      claim.status !== NarrationStatus.CLAIMED &&
      claim.status !== NarrationStatus.REJECTED
    ) {
      throw new ConflictException(
        'Không thể nộp bản thu ở trạng thái hiện tại',
      );
    }
    if (!this.storage.ownsUrl(input.audioUrl)) {
      throw new BadRequestException(
        'audioUrl phải là file đã tải lên kho lưu trữ của Auralis',
      );
    }
    return this.prisma.narrationClaim.update({
      where: { id },
      data: {
        status: NarrationStatus.SUBMITTED,
        audioUrl: input.audioUrl,
        duration: Math.round(input.duration),
        note: input.note || null,
        rejectReason: null,
      },
      select: claimSelect,
    });
  }

  async withdraw(userId: string, id: string): Promise<MyNarration> {
    const claim = await this.findOwn(userId, id);
    if (claim.status === NarrationStatus.APPROVED) {
      throw new ConflictException('Không thể rút bản đã được duyệt');
    }
    return this.prisma.narrationClaim.update({
      where: { id },
      data: { status: NarrationStatus.WITHDRAWN },
      select: claimSelect,
    });
  }

  private async findOwn(userId: string, id: string) {
    const claim = await this.prisma.narrationClaim.findUnique({
      where: { id },
      select: { narratorId: true, status: true },
    });
    if (!claim)
      throw new NotFoundException('Không tìm thấy lượt nhận lồng tiếng');
    if (claim.narratorId !== userId) throw new ForbiddenException();
    return claim;
  }
}
