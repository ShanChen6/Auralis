import { Module } from '@nestjs/common';
import { S3Client } from '@aws-sdk/client-s3';
import {
  S3_CLIENT,
  STORAGE_CONFIG,
  loadStorageConfig,
  r2Endpoint,
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
        config
          ? new S3Client({
              region: 'auto',
              endpoint: r2Endpoint(config.accountId),
              credentials: {
                accessKeyId: config.accessKeyId,
                secretAccessKey: config.secretAccessKey,
              },
            })
          : null,
    },
    StorageService,
  ],
  exports: [StorageService],
})
export class StorageModule {}
