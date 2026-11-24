import { Redis } from 'ioredis';
import { ListenRankingService } from './listen-ranking.service.js';
import { RedisThrottlerStorage } from './redis-throttler.storage.js';

/** Chạy với Redis thật: REDIS_TEST_URL=redis://localhost:6379 pnpm test */
const url = process.env.REDIS_TEST_URL;

describe.runIf(url)('Redis thật', () => {
  let redis: Redis;
  const prefix = `test:${Date.now()}`;

  beforeAll(async () => {
    redis = new Redis(url!);
    await new Promise((r) => redis.once('ready', r));
  });
  afterAll(async () => {
    const keys = await redis.keys(`*${prefix}*`);
    if (keys.length) await redis.del(...keys);
    await redis.quit();
  });

  it('rate limit: cửa sổ cố định, chặn khi vượt giới hạn, có thời gian chặn', async () => {
    const storage = new RedisThrottlerStorage(redis);
    const key = `${prefix}:login`;
    const results = [];
    for (let i = 0; i < 4; i++)
      results.push(await storage.increment(key, 60_000, 3, 30_000, 'default'));
    expect(results.map((r) => [r.totalHits, r.isBlocked])).toEqual([
      [1, false],
      [2, false],
      [3, false],
      [4, true],
    ]);
    expect(results[3].timeToBlockExpire).toBeGreaterThan(25);
    expect(results[0].timeToExpire).toBeGreaterThan(55);
  });

  it('lượt nghe: không đếm lặp trong 1 giờ, xếp hạng tuần', async () => {
    const ranking = new ListenRankingService(redis);
    const now = new Date('2030-01-09T05:00:00Z'); // tuần riêng cho test
    expect(await ranking.record(`${prefix}-a`, 'ip:1', now)).toBe(true);
    expect(await ranking.record(`${prefix}-a`, 'ip:1', now)).toBe(false);
    expect(await ranking.record(`${prefix}-a`, 'ip:2', now)).toBe(true);
    expect(await ranking.record(`${prefix}-b`, 'ip:1', now)).toBe(true);
    const top = await ranking.topOfWeek(10, now);
    const mine = top.filter((t) => t.postId.startsWith(prefix));
    expect(mine).toEqual([
      { postId: `${prefix}-a`, listens: 2 },
      { postId: `${prefix}-b`, listens: 1 },
    ]);
    await redis.del(
      'rank:listen:2030-W02',
      `listen:${prefix}-a:ip:1`,
      `listen:${prefix}-a:ip:2`,
      `listen:${prefix}-b:ip:1`,
    );
  });
});
