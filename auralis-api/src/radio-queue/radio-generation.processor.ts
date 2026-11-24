import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { AudioStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AudioAiClient } from './audio-ai.client.js';
import {
  EDGE_VOICE_NAMES,
  RADIO_JOB_ATTEMPTS,
  RADIO_QUEUE,
  type RadioJobData,
  engineRequest,
} from './radio-queue.constants.js';

/** Sản xuất số Radio AI ở nền: gọi auralis-audio-ai rồi cập nhật bài viết. */
@Processor(RADIO_QUEUE, { concurrency: 2 })
export class RadioGenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(RadioGenerationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audioAi: AudioAiClient,
  ) {
    super();
  }

  async process(job: Job<RadioJobData>): Promise<void> {
    const { postId, voice, music } = job.data;
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, content: { select: { content: true } } },
    });
    if (!post?.content) {
      this.logger.warn(`Bỏ qua job ${job.id}: bài ${postId} không còn tồn tại`);
      return;
    }

    await this.prisma.post.update({
      where: { id: postId },
      data: { audioStatus: AudioStatus.PROCESSING },
    });

    const result = await this.audioAi.generateRadio({
      script: post.content.content,
      ...engineRequest(voice),
      music,
      postId,
    });

    // Nếu VoiceStudio sập và đã fallback sang edge thì ghi đúng giọng đã dùng
    const voiceName =
      result.engine === 'voicestudio'
        ? 'VoiceStudio'
        : EDGE_VOICE_NAMES[voice === 'male_deep' ? 'male_deep' : 'female_warm'];

    await this.prisma.post.update({
      where: { id: postId },
      data: {
        audioUrl: result.audioUrl,
        duration: Math.round(result.duration),
        audioStatus: AudioStatus.READY,
        voiceName,
        backgroundMusic: result.music,
        content: { update: { timestamps: result.timestamps } },
      },
    });
    this.logger.log(
      `Đã tạo Radio cho bài ${postId} (${result.duration}s, ${result.engine})`,
    );
  }

  @OnWorkerEvent('failed')
  async onFailed(
    job: Job<RadioJobData> | undefined,
    error: Error,
  ): Promise<void> {
    if (!job) return;
    const attempts = job.opts.attempts ?? RADIO_JOB_ATTEMPTS;
    this.logger.error(
      `Job ${job.id} lỗi (lần ${job.attemptsMade}/${attempts}): ${error.message}`,
    );
    if (job.attemptsMade >= attempts) {
      await this.prisma.post
        .update({
          where: { id: job.data.postId },
          data: { audioStatus: AudioStatus.FAILED },
        })
        .catch(() => undefined);
    }
  }
}
