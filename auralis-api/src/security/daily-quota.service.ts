import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { isStaff } from '../auth/roles.js';
import type { UserRole } from '../generated/prisma/enums.js';
import { REDIS } from '../redis/redis.module.js';

export type QuotaKind = 'post';

export interface QuotaStatus {
  kind: QuotaKind;
  /** null = không giới hạn (ban biên tập) */
  limit: number | null;
  used: number;
  remaining: number | null;
  /** Ngày tính quota theo giờ Việt Nam (YYYY-MM-DD) */
  day: string;
}

/** Ngày hiện tại theo múi giờ Việt Nam – quota reset lúc 0h giờ VN */
export function vietnamDay(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(now);
}

const MESSAGES: Record<QuotaKind, (limit: number) => string> = {
  post: (limit) =>
    `Bạn đã đăng ${limit} bài hôm nay – mức tối đa mỗi ngày. Hãy quay lại vào ngày mai nhé!`,
};

/**
 * Giới hạn số lần thực hiện một thao tác mỗi ngày cho mỗi người (chống spam).
 * Ban biên tập (admin, biên tập viên) được miễn. Redis lỗi thì dùng bộ đếm trong bộ nhớ.
 */
@Injectable()
export class DailyQuotaService {
  private readonly limits: Record<QuotaKind, number> = {
    post: Number(process.env.POST_DAILY_LIMIT ?? 5),
  };
  private readonly memory = new Map<string, number>();

  constructor(@Inject(REDIS) private readonly redis: Redis | null) {}

  limit(kind: QuotaKind): number {
    return this.limits[kind];
  }

  private key(kind: QuotaKind, userId: string, day: string) {
    return `quota:${kind}:${userId}:${day}`;
  }

  async status(
    kind: QuotaKind,
    userId: string,
    role: UserRole,
    now = new Date(),
  ): Promise<QuotaStatus> {
    const day = vietnamDay(now);
    const used = await this.read(this.key(kind, userId, day));
    if (isStaff(role)) return { kind, limit: null, used, remaining: null, day };
    const limit = this.limits[kind];
    return { kind, limit, used, remaining: Math.max(0, limit - used), day };
  }

  /** Giữ một lượt; ném 429 nếu đã hết lượt trong ngày */
  async consume(
    kind: QuotaKind,
    userId: string,
    role: UserRole,
    now = new Date(),
  ): Promise<QuotaStatus> {
    if (isStaff(role)) return this.status(kind, userId, role, now);
    const day = vietnamDay(now);
    const key = this.key(kind, userId, day);
    const limit = this.limits[kind];
    const used = await this.increment(key, 1);
    if (used > limit) {
      await this.increment(key, -1);
      throw new HttpException(
        MESSAGES[kind](limit),
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return { kind, limit, used, remaining: limit - used, day };
  }

  /** Hoàn lại lượt khi thao tác thất bại */
  async refund(
    kind: QuotaKind,
    userId: string,
    role: UserRole,
    now = new Date(),
  ): Promise<void> {
    if (isStaff(role)) return;
    await this.increment(this.key(kind, userId, vietnamDay(now)), -1);
  }

  private async read(key: string): Promise<number> {
    if (this.redis?.status === 'ready') {
      try {
        return Number((await this.redis.get(key)) ?? 0);
      } catch {
        // dùng bộ nhớ
      }
    }
    return this.memory.get(key) ?? 0;
  }

  private async increment(key: string, by: number): Promise<number> {
    if (this.redis?.status === 'ready') {
      try {
        const value = await this.redis.incrby(key, by);
        await this.redis.expire(key, 2 * 86_400);
        return value;
      } catch {
        // dùng bộ nhớ
      }
    }
    const value = Math.max(0, (this.memory.get(key) ?? 0) + by);
    this.memory.set(key, value);
    return value;
  }
}
