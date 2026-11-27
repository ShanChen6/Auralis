import { HttpException } from '@nestjs/common';
import { DailyQuotaService, vietnamDay } from './daily-quota.service.js';

describe('vietnamDay', () => {
  it('đổi ngày theo giờ Việt Nam (UTC+7)', () => {
    expect(vietnamDay(new Date('2026-11-24T16:59:59Z'))).toBe('2026-11-24');
    expect(vietnamDay(new Date('2026-11-24T17:00:00Z'))).toBe('2026-11-25');
  });
});

describe('DailyQuotaService (bộ nhớ khi không có Redis)', () => {
  const now = new Date('2026-11-24T03:00:00Z');
  const limit = Number(process.env.POST_DAILY_LIMIT ?? 5);

  it(`cho phép ${limit} bài/ngày, lần kế tiếp trả 429 và không bị trừ thêm`, async () => {
    const quota = new DailyQuotaService(null);
    for (let i = 1; i <= limit; i++) {
      await expect(
        quota.consume('post', 'u1', 'AUTHOR', now),
      ).resolves.toMatchObject({
        used: i,
        remaining: limit - i,
      });
    }
    const error = await quota
      .consume('post', 'u1', 'AUTHOR', now)
      .catch((e: HttpException) => e);
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(429);
    await expect(
      quota.status('post', 'u1', 'AUTHOR', now),
    ).resolves.toMatchObject({
      used: limit,
      remaining: 0,
    });
  });

  it('reset sang ngày mới, tách riêng từng người, hoàn lượt được', async () => {
    const quota = new DailyQuotaService(null);
    for (let i = 0; i < limit; i++)
      await quota.consume('post', 'u1', 'AUTHOR', now);
    await expect(
      quota.consume('post', 'u2', 'AUTHOR', now),
    ).resolves.toMatchObject({ used: 1 });
    const tomorrow = new Date('2026-11-25T03:00:00Z');
    await expect(
      quota.consume('post', 'u1', 'AUTHOR', tomorrow),
    ).resolves.toMatchObject({ used: 1 });
    await quota.refund('post', 'u1', 'AUTHOR', tomorrow);
    await expect(
      quota.status('post', 'u1', 'AUTHOR', tomorrow),
    ).resolves.toMatchObject({ used: 0 });
  });

  it('ban biên tập không bị giới hạn', async () => {
    const quota = new DailyQuotaService(null);
    for (let i = 0; i < limit + 5; i++)
      await quota.consume('post', 'e1', 'EDITOR', now);
    await expect(
      quota.status('post', 'e1', 'ADMIN', now),
    ).resolves.toMatchObject({
      limit: null,
      remaining: null,
    });
  });
});
