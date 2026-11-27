import {
  Global,
  Logger,
  Module,
  type OnModuleDestroy,
  Inject,
} from '@nestjs/common';
import { Redis } from 'ioredis';

export const REDIS = Symbol('REDIS');

/**
 * Kết nối Redis dùng chung (cache, rate limit, quota, xếp hạng). Hỗ trợ Upstash (rediss://).
 * Không chặn khởi động khi Redis chưa sẵn sàng; các service tự bỏ qua Redis khi lỗi.
 * DISABLE_REDIS=true (VD: test) → không kết nối.
 */
export function createRedis(
  env: NodeJS.ProcessEnv = process.env,
): Redis | null {
  if (env.DISABLE_REDIS === 'true') return null;
  const redis = new Redis(env.REDIS_URL ?? 'redis://localhost:6379', {
    // Tách key giữa các môi trường dùng chung một Redis (VD: staging và production trên Upstash)
    keyPrefix: env.REDIS_KEY_PREFIX ?? 'auralis:',
    lazyConnect: false,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 3000,
  });
  const logger = new Logger('Redis');
  let warned = false;
  redis.on('error', (error) => {
    if (!warned)
      logger.warn(`Redis lỗi, tạm bỏ qua cache/rate limit: ${error.message}`);
    warned = true;
  });
  redis.on('ready', () => {
    warned = false;
  });
  return redis;
}

@Global()
@Module({
  providers: [{ provide: REDIS, useFactory: () => createRedis() }],
  exports: [REDIS],
})
export class RedisModule implements OnModuleDestroy {
  constructor(@Inject(REDIS) private readonly redis: Redis | null) {}

  async onModuleDestroy(): Promise<void> {
    await this.redis?.quit().catch(() => undefined);
  }
}
