import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerStorage } from '@nestjs/throttler';
import { CacheService } from '../redis/cache.service.js';
import { DailyQuotaService } from './daily-quota.service.js';
import { AppThrottlerGuard } from './app-throttler.guard.js';
import { ListenRankingService } from './listen-ranking.service.js';
import { RedisThrottlerStorage } from './redis-throttler.storage.js';
import { ContentEvents } from './web-revalidator.service.js';

@Global()
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      useFactory: () => ({
        errorMessage: 'Bạn thao tác hơi nhanh, hãy thử lại sau ít phút nhé.',
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
    DailyQuotaService,
    ListenRankingService,
    ContentEvents,
  ],
  exports: [
    CacheService,
    DailyQuotaService,
    ListenRankingService,
    ContentEvents,
  ],
})
export class SecurityModule {}
