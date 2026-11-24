import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { UserRole } from '../generated/prisma/enums.js';
import { REDIS } from '../redis/redis.module.js';

export interface QuotaStatus {
  limit: number;
  used: number;
  remaining: number;
  /** Ngày tính quota theo giờ Việt Nam (YYYY-MM-DD) */
  day: string;
}

/** Ngày hiện tại theo múi giờ Việt Nam – quota reset lúc 0h giờ VN */
export function vietnamDay(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(now);
}

const EXEMPT_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.EDITOR];

/**
 * Giới hạn số số Radio AI mỗi người được tạo trong ngày (mặc định 3) để chống spam
 * làm quá tải dịch vụ TTS. Redis lỗi thì dùng bộ đếm trong bộ nhớ.
 */
@Injectable()
export class AiQuotaService {
  readonly limit = Number(process.env.AI_DAILY_LIMIT ?? 3);
  private readonly memory = new Map<string, number>();

  constructor(@Inject(REDIS) private readonly redis: Redis | null) {}

  private key(userId: string, day: string) {
    return `quota:ai:${userId}:${day}`;
  }

  async status(
    userId: string,
    role: UserRole,
    now = new Date(),
  ): Promise<QuotaStatus> {
    const day = vietnamDay(now);
    const limit = EXEMPT_ROLES.includes(role)
      ? Number.POSITIVE_INFINITY
      : this.limit;
    const used = await this.read(this.key(userId, day));
    return { limit, used, remaining: Math.max(0, limit - used), day };
  }

  /** Giữ một lượt; ném 429 nếu đã hết lượt trong ngày */
  async consume(
    userId: string,
    role: UserRole,
    now = new Date(),
  ): Promise<QuotaStatus> {
    const day = vietnamDay(now);
    if (EXEMPT_ROLES.includes(role)) return this.status(userId, role, now);
    const key = this.key(userId, day);
    const used = await this.increment(key, 1);
    if (used > this.limit) {
      await this.increment(key, -1);
      throw new HttpException(
        `Bạn đã dùng hết ${this.limit} lượt tạo Radio AI hôm nay. Hãy quay lại vào ngày mai, hoặc tự thu âm nhé!`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return { limit: this.limit, used, remaining: this.limit - used, day };
  }

  /** Hoàn lại lượt khi tạo bài thất bại trước khi đưa vào hàng đợi */
  async refund(userId: string, now = new Date()): Promise<void> {
    await this.increment(this.key(userId, vietnamDay(now)), -1);
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
