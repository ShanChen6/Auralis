import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../redis/cache.service.js';

/**
 * Khi nội dung công khai thay đổi: xóa cache Redis và báo Next.js tái tạo trang (On-Demand ISR).
 * Không chặn request gốc nếu web không phản hồi.
 */
@Injectable()
export class ContentEvents {
  private readonly logger = new Logger(ContentEvents.name);
  private readonly webUrl = (
    process.env.WEB_URL ??
    process.env.WEB_ORIGIN ??
    'http://localhost:3000'
  ).replace(/\/+$/, '');
  private readonly secret = process.env.REVALIDATE_SECRET;

  constructor(private readonly cache: CacheService) {}

  async postsChanged(slugs: string[] = []): Promise<void> {
    await this.cache.invalidatePosts();
    if (!this.secret) return;
    const tags = [
      'posts',
      'featured',
      'top-week',
      ...slugs.map((s) => `post:${s}`),
    ];
    try {
      const res = await fetch(`${this.webUrl}/api/revalidate`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-revalidate-secret': this.secret,
        },
        body: JSON.stringify({ tags }),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) this.logger.warn(`Revalidate web trả ${res.status}`);
    } catch (error) {
      this.logger.warn(
        `Không gọi được revalidate web: ${(error as Error).message}`,
      );
    }
  }
}
