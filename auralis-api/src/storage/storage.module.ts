import { Module } from '@nestjs/common';
import {
  S3_CLIENT,
  STORAGE_CONFIG,
  createS3Client,
  loadStorageConfig,
  type StorageConfig,
} from './storage.config.js';
import { StorageController } from './storage.controller.js';
import { StorageService } from './storage.service.js';

@Module({
  controllers: [StorageController],
  providers: [
    { provide: STORAGE_CONFIG, useFactory: () => loadStorageConfig() },
    {
      provide: S3_CLIENT,
      inject: [STORAGE_CONFIG],
      useFactory: (config: StorageConfig | null) =>
        config ? createS3Client(config) : null,
    },
    StorageService,
  ],
  exports: [StorageService],
})
export class StorageModule {}
