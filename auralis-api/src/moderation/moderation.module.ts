import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module.js';
import { ModerationController } from './moderation.controller.js';
import { ModerationService } from './moderation.service.js';

@Module({
  imports: [StorageModule],
  controllers: [ModerationController],
  providers: [ModerationService],
})
export class ModerationModule {}
