import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS } from './redis.module.js';

const POSTS_VERSION_KEY = 'cache:posts:version';

/**
 * Cache JSON trên Redis cho các truy vấn đọc nhiều (trang chủ, chuyên mục, xếp hạng).
 * Vô hiệu hóa theo "phiên bản": mọi key bài viết chứa số phiên bản; khi có bài
 * xuất bản/cập nhật chỉ cần INCR phiên bản → tất cả key cũ tự hết hiệu lực.
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(REDIS) private readonly redis: Redis | null) {}

  private get ready(): boolean {
    return this.redis?.status === 'ready';
  }

  async getOrSet<T>(
    key: string,
    ttlSeconds: number,
    loader: () => Promise<T>,
  ): Promise<T> {
    if (!this.ready) return loader();
    let fullKey: string;
    try {
      const version = (await this.redis!.get(POSTS_VERSION_KEY)) ?? '0';
      fullKey = `cache:v${version}:${key}`;
      const hit = await this.redis!.get(fullKey);
      if (hit !== null) return JSON.parse(hit) as T;
    } catch (error) {
      this.logger.warn(`Đọc cache lỗi (${key}): ${(error as Error).message}`);
      return loader();
    }
    const value = await loader();
    this.redis!.set(fullKey, JSON.stringify(value), 'EX', ttlSeconds).catch(
      () => undefined,
    );
    return value;
  }

  /** Gọi khi bài viết được xuất bản / cập nhật / có audio mới */
  async invalidatePosts(): Promise<void> {
    if (!this.ready) return;
    await this.redis!.incr(POSTS_VERSION_KEY).catch(() => undefined);
  }
}
