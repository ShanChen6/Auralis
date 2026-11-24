import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  countWords,
  estimateTimestamps,
  randomSuffix,
  slugify,
  splitParagraphs,
} from '../common/text.js';
import {
  AudioSource,
  AudioStatus,
  PostStatus,
} from '../generated/prisma/enums.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  EDGE_VOICE_NAMES,
  type RadioJobData,
  voiceFromName,
} from '../radio-queue/radio-queue.constants.js';
import { RadioQueueService } from '../radio-queue/radio-queue.service.js';
import {
  AiQuotaService,
  type QuotaStatus,
} from '../security/ai-quota.service.js';
import { StorageService } from '../storage/storage.service.js';
import type { UserRole } from '../generated/prisma/enums.js';
import type { CreatePostInput } from './studio.schemas.js';

const studioSelect = {
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

@Injectable()
export class StudioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly radioQueue: RadioQueueService,
    private readonly quota: AiQuotaService,
  ) {}

  quotaStatus(userId: string, role: UserRole): Promise<QuotaStatus> {
    return this.quota.status(userId, role);
  }

  async createPost(
    authorId: string,
    input: CreatePostInput,
    role: UserRole = 'AUTHOR',
  ): Promise<StudioPost> {
    if (input.categorySlug) {
      const category = await this.prisma.category.findUnique({
        where: { slug: input.categorySlug },
        select: { id: true },
      });
      if (!category) throw new BadRequestException('Chuyên mục không tồn tại');
    }
    if (
      input.audio.mode === 'upload' &&
      !this.storage.ownsUrl(input.audio.audioUrl)
    ) {
      throw new BadRequestException(
        'audioUrl phải là file đã tải lên kho lưu trữ của Auralis',
      );
    }

    // Giữ lượt tạo Radio AI trong ngày trước khi ghi DB (hoàn lại nếu tạo bài lỗi)
    if (input.audio.mode === 'ai') await this.quota.consume(authorId, role);

    const paragraphs = splitParagraphs(input.content);
    const audio = this.audioFields(input, paragraphs);
    const post = await this.createRecord(authorId, input, audio).catch(
      async (error: unknown) => {
        if (input.audio.mode === 'ai') await this.quota.refund(authorId);
        throw error;
      },
    );

    if (input.audio.mode === 'ai') {
      await this.enqueueOrFail(post.id, {
        postId: post.id,
        voice: input.audio.voice,
        music: input.audio.music,
      });
    }
    return post;
  }

  private async createRecord(
    authorId: string,
    input: CreatePostInput,
    audio: ReturnType<StudioService['audioFields']>,
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

  listMine(authorId: string): Promise<StudioPost[]> {
    return this.prisma.post.findMany({
      where: { authorId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: studioSelect,
    });
  }

  /** Tạo lại Radio AI khi lần trước thất bại */
  async retryAudio(authorId: string, postId: string): Promise<StudioPost> {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, authorId },
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

  private audioFields(input: CreatePostInput, paragraphs: string[]) {
    const { audio } = input;
    switch (audio.mode) {
      case 'upload':
        return {
          post: {
            audioUrl: audio.audioUrl,
            duration: Math.round(audio.duration),
            audioSource: AudioSource.UPLOAD,
            audioStatus: AudioStatus.READY,
          },
          timestamps: estimateTimestamps(paragraphs, audio.duration),
        };
      case 'ai':
        return {
          post: {
            audioSource:
              audio.voice === 'studio'
                ? AudioSource.AI_VOICESTUDIO
                : AudioSource.AI_EDGE,
            audioStatus: AudioStatus.PROCESSING,
            voiceName:
              audio.voice === 'studio'
                ? 'VoiceStudio'
                : EDGE_VOICE_NAMES[audio.voice],
            backgroundMusic: audio.music,
          },
          timestamps: null,
        };
      case 'none':
        return {
          post: {
            audioSource: AudioSource.NONE,
            audioStatus: AudioStatus.TEXT_ONLY,
          },
          timestamps: null,
        };
    }
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
