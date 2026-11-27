import { Module } from '@nestjs/common';
import { jwtSecret } from '../auth/auth.types.js';
import { LOCAL_MEDIA, LocalMediaStore } from './local-media.store.js';
import {
  S3_CLIENT,
  STORAGE_CONFIG,
  createS3Client,
  loadStorageConfig,
  type StorageConfig,
} from './storage.config.js';
import { StorageController } from './storage.controller.js';
import { StorageService } from './storage.service.js';

export function localMediaDir(env: NodeJS.ProcessEnv = process.env): string {
  return env.LOCAL_MEDIA_DIR ?? 'media';
}

/** Kho local chỉ bật khi chưa cấu hình R2 và không ở production (trừ khi bật rõ ràng) */
export function createLocalMediaStore(
  config: StorageConfig | null,
  env: NodeJS.ProcessEnv = process.env,
): LocalMediaStore | null {
  const enabled =
    env.STORAGE_LOCAL_FALLBACK ??
    (env.NODE_ENV === 'production' ? 'false' : 'true');
  if (config || enabled !== 'true') return null;
  const apiPublicUrl =
    env.API_PUBLIC_URL ?? `http://localhost:${env.PORT ?? 4000}`;
  return new LocalMediaStore(localMediaDir(env), apiPublicUrl, jwtSecret(env));
}

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
    {
      provide: LOCAL_MEDIA,
      inject: [STORAGE_CONFIG],
      useFactory: (config: StorageConfig | null) =>
        createLocalMediaStore(config),
    },
    StorageService,
  ],
  exports: [StorageService],
})
export class StorageModule {}
