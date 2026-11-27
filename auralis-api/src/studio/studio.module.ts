import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module.js';
import { StudioController } from './studio.controller.js';
import { StudioService } from './studio.service.js';

@Module({
  imports: [StorageModule],
  controllers: [StudioController],
  providers: [StudioService],
})
export class StudioModule {}
