import { InjectQueue } from '@nestjs/bullmq';
import {
  Injectable,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Queue } from 'bullmq';
import {
  RADIO_JOB_ATTEMPTS,
  RADIO_QUEUE,
  type RadioJobData,
} from './radio-queue.constants.js';

export const RADIO_QUEUE_DISABLED = process.env.DISABLE_QUEUE === 'true';

@Injectable()
export class RadioQueueService {
  constructor(
    @Optional()
    @InjectQueue(RADIO_QUEUE)
    private readonly queue?: Queue<RadioJobData>,
  ) {}

  async enqueue(data: RadioJobData): Promise<void> {
    if (!this.queue) {
      throw new ServiceUnavailableException(
        'Hàng đợi tạo Radio đang tắt (DISABLE_QUEUE=true)',
      );
    }
    await this.queue.add('generate', data, {
      jobId: `${data.postId}-${Date.now()}`,
      attempts: RADIO_JOB_ATTEMPTS,
      backoff: { type: 'exponential', delay: 30_000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    });
  }
}
