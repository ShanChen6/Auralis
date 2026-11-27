import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isStaff } from '../auth/roles.js';
import {
  countWords,
  randomSuffix,
  slugify,
  splitParagraphs,
} from '../common/text.js';
import {
  AudioSource,
  AudioStatus,
  PostStatus,
  type UserRole,
} from '../generated/prisma/enums.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { type AudioFields, audioFields } from '../radio-queue/audio-plan.js';
import {
  type RadioJobData,
  voiceFromName,
} from '../radio-queue/radio-queue.constants.js';
import { RadioQueueService } from '../radio-queue/radio-queue.service.js';
import {
  DailyQuotaService,
  type QuotaStatus,
} from '../security/daily-quota.service.js';
import { StorageService } from '../storage/storage.service.js';
import type { CreatePostInput } from './studio.schemas.js';

export const studioSelect = {
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
  rejectReason: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { slug: true, name: true } },
  narrator: { select: { username: true, displayName: true } },
} satisfies Prisma.PostSelect;

export type StudioPost = Prisma.PostGetPayload<{ select: typeof studioSelect }>;

export interface StudioQuota extends QuotaStatus {
  /** Chỉ ban biên tập được tạo audio */
  canCreateAudio: boolean;
}

export const AUDIO_FORBIDDEN_MESSAGE =
  'Chỉ biên tập viên và quản trị viên được tạo giọng đọc. Bạn hãy đăng bài chữ, ban biên tập sẽ thực hiện phần âm thanh.';

@Injectable()
export class StudioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly radioQueue: RadioQueueService,
    private readonly quota: DailyQuotaService,
  ) {}

  async quotaStatus(userId: string, role: UserRole): Promise<StudioQuota> {
    return {
      ...(await this.quota.status('post', userId, role)),
      canCreateAudio: isStaff(role),
    };
  }

  /**
   * Tạo bài mới ở trạng thái PENDING.
   * Người dùng thường: chỉ đăng chữ, tối đa POST_DAILY_LIMIT bài/ngày.
   * Ban biên tập: được kèm audio (Radio AI / bản thu), không giới hạn.
   */
  async createPost(
    authorId: string,
    input: CreatePostInput,
    role: UserRole,
  ): Promise<StudioPost> {
    const { audio } = input;
    if (audio.mode !== 'none' && !isStaff(role)) {
      throw new ForbiddenException(AUDIO_FORBIDDEN_MESSAGE);
    }
    if (input.categorySlug) {
      const category = await this.prisma.category.findUnique({
        where: { slug: input.categorySlug },
        select: { id: true },
      });
      if (!category) throw new BadRequestException('Chuyên mục không tồn tại');
    }
    if (audio.mode === 'upload' && !this.storage.ownsUrl(audio.audioUrl)) {
      throw new BadRequestException(
        'audioUrl phải là file đã tải lên kho lưu trữ của Auralis',
      );
    }

    // Giữ một lượt đăng bài trong ngày (hoàn lại nếu ghi DB lỗi)
    await this.quota.consume('post', authorId, role);
    const fields = audioFields(audio, splitParagraphs(input.content));
    const post = await this.createRecord(authorId, input, fields).catch(
      async (error: unknown) => {
        await this.quota.refund('post', authorId, role);
        throw error;
      },
    );

    if (audio.mode === 'ai') {
      await this.enqueueOrFail(post.id, {
        postId: post.id,
        voice: audio.voice,
        music: audio.music,
      });
    }
    return post;
  }

  listMine(authorId: string): Promise<StudioPost[]> {
    return this.prisma.post.findMany({
      where: { authorId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: studioSelect,
    });
  }

  /** Tạo lại Radio AI khi lần trước thất bại (chỉ ban biên tập – kiểm tra ở controller) */
  async retryAudio(postId: string): Promise<StudioPost> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        audioStatus: true,
        audioSource: true,
        voiceName: true,
        backgroundMusic: true,
      },
    });
    if (!post) throw new NotFoundException('Không tìm thấy bài viết');
    if (post.audioStatus !== AudioStatus.FAILED) {
      throw new ConflictException(
        'Chỉ tạo lại được khi lần tạo Radio trước bị lỗi',
      );
    }
    const updated = await this.prisma.post.update({
      where: { id: postId },
      data: { audioStatus: AudioStatus.PROCESSING },
      select: studioSelect,
    });
    await this.enqueueOrFail(postId, {
      postId,
      voice:
        post.audioSource === AudioSource.AI_VOICESTUDIO
          ? 'studio'
          : voiceFromName(post.voiceName),
      music: (post.backgroundMusic as RadioJobData['music']) ?? null,
    });
    return updated;
  }

  private async createRecord(
    authorId: string,
    input: CreatePostInput,
    audio: AudioFields,
  ): Promise<StudioPost> {
    return this.prisma.post.create({
      data: {
        title: input.title,
        slug: await this.uniqueSlug(input.title),
        summary: input.summary || null,
        moodTag: input.moodTag,
        status: PostStatus.PENDING,
        ...audio.post,
        author: { connect: { id: authorId } },
        ...(input.categorySlug
          ? { category: { connect: { slug: input.categorySlug } } }
          : {}),
        content: {
          create: {
            content: input.content,
            wordCount: countWords(input.content),
            ...(audio.timestamps ? { timestamps: audio.timestamps } : {}),
          },
        },
      },
      select: studioSelect,
    });
  }

  private async enqueueOrFail(
    postId: string,
    data: RadioJobData,
  ): Promise<void> {
    try {
      await this.radioQueue.enqueue(data);
    } catch (error) {
      await this.prisma.post.update({
        where: { id: postId },
        data: { audioStatus: AudioStatus.FAILED },
      });
      throw error;
    }
  }

  private async uniqueSlug(title: string): Promise<string> {
    const base = slugify(title) || 'so-radio';
    const taken = await this.prisma.post.findUnique({
      where: { slug: base },
      select: { id: true },
    });
    return taken ? `${base}-${randomSuffix()}` : base;
  }
}
