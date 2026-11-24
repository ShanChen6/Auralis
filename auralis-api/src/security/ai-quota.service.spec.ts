import { HttpException } from '@nestjs/common';
import { AiQuotaService, vietnamDay } from './ai-quota.service.js';

describe('vietnamDay', () => {
  it('đổi ngày theo giờ Việt Nam (UTC+7)', () => {
    expect(vietnamDay(new Date('2026-11-24T16:59:59Z'))).toBe('2026-11-24');
    expect(vietnamDay(new Date('2026-11-24T17:00:00Z'))).toBe('2026-11-25');
  });
});

describe('AiQuotaService (bộ nhớ khi không có Redis)', () => {
  const now = new Date('2026-11-24T03:00:00Z');

  it('cho phép 3 lượt/ngày, lượt thứ 4 trả 429 và không bị trừ thêm', async () => {
    const quota = new AiQuotaService(null);
    for (let i = 1; i <= 3; i++) {
      await expect(quota.consume('u1', 'AUTHOR', now)).resolves.toMatchObject({
        used: i,
        remaining: 3 - i,
      });
    }
    const error = await quota
      .consume('u1', 'AUTHOR', now)
      .catch((e: HttpException) => e);
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(429);
    await expect(quota.status('u1', 'AUTHOR', now)).resolves.toMatchObject({
      used: 3,
      remaining: 0,
    });
  });

  it('reset sang ngày mới, tách riêng từng người, hoàn lượt được', async () => {
    const quota = new AiQuotaService(null);
    for (let i = 0; i < 3; i++) await quota.consume('u1', 'AUTHOR', now);
    await expect(quota.consume('u2', 'AUTHOR', now)).resolves.toMatchObject({
      used: 1,
    });
    const tomorrow = new Date('2026-11-25T03:00:00Z');
    await expect(
      quota.consume('u1', 'AUTHOR', tomorrow),
    ).resolves.toMatchObject({ used: 1 });
    await quota.refund('u1', tomorrow);
    await expect(quota.status('u1', 'AUTHOR', tomorrow)).resolves.toMatchObject(
      { used: 0 },
    );
  });

  it('biên tập viên và quản trị không bị giới hạn', async () => {
    const quota = new AiQuotaService(null);
    for (let i = 0; i < 10; i++) await quota.consume('e1', 'EDITOR', now);
    await expect(quota.status('e1', 'ADMIN', now)).resolves.toMatchObject({
      remaining: Infinity,
    });
  });
});
