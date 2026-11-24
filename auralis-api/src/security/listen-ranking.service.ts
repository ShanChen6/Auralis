import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS } from '../redis/redis.module.js';

/** Tuần ISO, VD "2026-W48" (theo giờ Việt Nam) */
export function isoWeek(now = new Date()): string {
  const vn = new Date(now.getTime() + 7 * 3600_000);
  const date = new Date(
    Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate()),
  );
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
  );
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Đếm lượt nghe (chống đếm lặp trong 1 giờ) và bảng xếp hạng theo tuần trên Redis */
@Injectable()
export class ListenRankingService {
  constructor(@Inject(REDIS) private readonly redis: Redis | null) {}

  private get ready() {
    return this.redis?.status === 'ready';
  }

  /** true nếu đây là lượt nghe mới của người này với bài này trong giờ qua */
  async record(
    postId: string,
    listener: string,
    now = new Date(),
  ): Promise<boolean> {
    if (!this.ready) return true;
    try {
      const fresh = await this.redis!.set(
        `listen:${postId}:${listener}`,
        '1',
        'EX',
        3600,
        'NX',
      );
      if (fresh !== 'OK') return false;
      const key = `rank:listen:${isoWeek(now)}`;
      await this.redis!.zincrby(key, 1, postId);
      await this.redis!.expire(key, 15 * 86_400);
      return true;
    } catch {
      return true;
    }
  }

  /** [postId, lượt nghe tuần này] giảm dần */
  async topOfWeek(
    limit: number,
    now = new Date(),
  ): Promise<{ postId: string; listens: number }[]> {
    if (!this.ready) return [];
    try {
      const raw = await this.redis!.zrevrange(
        `rank:listen:${isoWeek(now)}`,
        0,
        limit - 1,
        'WITHSCORES',
      );
      const result: { postId: string; listens: number }[] = [];
      for (let i = 0; i < raw.length; i += 2)
        result.push({ postId: raw[i], listens: Number(raw[i + 1]) });
      return result;
    } catch {
      return [];
    }
  }
}
