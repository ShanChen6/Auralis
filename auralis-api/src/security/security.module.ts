import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerStorage } from '@nestjs/throttler';
import { CacheService } from '../redis/cache.service.js';
import { AiQuotaService } from './ai-quota.service.js';
import { AppThrottlerGuard } from './app-throttler.guard.js';
import { ListenRankingService } from './listen-ranking.service.js';
import { RedisThrottlerStorage } from './redis-throttler.storage.js';
import { ContentEvents } from './web-revalidator.service.js';

@Global()
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      useFactory: () => ({
        throttlers: [
          {
            name: 'default',
            ttl: 60_000,
            limit: Number(process.env.RATE_LIMIT_PER_MINUTE ?? 120),
          },
        ],
      }),
    }),
  ],
  providers: [
    RedisThrottlerStorage,
    { provide: ThrottlerStorage, useExisting: RedisThrottlerStorage },
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
    CacheService,
    AiQuotaService,
    ListenRankingService,
    ContentEvents,
  ],
  exports: [CacheService, AiQuotaService, ListenRankingService, ContentEvents],
})
export class SecurityModule {}
