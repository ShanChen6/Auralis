import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { AudioAiClient } from './audio-ai.client.js';
import { RadioGenerationProcessor } from './radio-generation.processor.js';
import { RADIO_QUEUE, redisConnection } from './radio-queue.constants.js';
import {
  RADIO_QUEUE_DISABLED,
  RadioQueueService,
} from './radio-queue.service.js';

/** Tắt bằng DISABLE_QUEUE=true (VD: test không có Redis) – khi đó tạo Radio AI trả 503 */
const queueImports = RADIO_QUEUE_DISABLED
  ? []
  : [
      BullModule.forRoot({ connection: redisConnection() }),
      BullModule.registerQueue({ name: RADIO_QUEUE }),
    ];

@Global()
@Module({
  imports: queueImports,
  providers: [
    AudioAiClient,
    RadioQueueService,
    ...(RADIO_QUEUE_DISABLED ? [] : [RadioGenerationProcessor]),
  ],
  exports: [RadioQueueService],
})
export class RadioQueueModule {}
