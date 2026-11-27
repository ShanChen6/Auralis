import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module.js';
import { NarrationsController } from './narrations.controller.js';
import { NarrationsService } from './narrations.service.js';

@Module({
  imports: [StorageModule],
  controllers: [NarrationsController],
  providers: [NarrationsService],
})
export class NarrationsModule {}
