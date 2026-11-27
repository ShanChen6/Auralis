import type { Redis } from 'ioredis';
import { CacheService } from './cache.service.js';

/** Redis giả tối giản: get/set/incr trong Map */
function fakeRedis(status = 'ready') {
  const data = new Map<string, string>();
  return {
    status,
    data,
    get: vi.fn(async (k: string) => data.get(k) ?? null),
    set: vi.fn(async (k: string, v: string) => {
      data.set(k, v);
      return 'OK';
    }),
    incr: vi.fn(async (k: string) => {
      const v = Number(data.get(k) ?? 0) + 1;
      data.set(k, String(v));
      return v;
    }),
  };
}

describe('CacheService', () => {
  it('lần đầu gọi loader, lần sau đọc cache; TTL được đặt', async () => {
    const redis = fakeRedis();
    const cache = new CacheService(redis as unknown as Redis);
    const loader = vi.fn().mockResolvedValue({ n: 1 });
    await expect(cache.getOrSet('k', 600, loader)).resolves.toEqual({ n: 1 });
    await new Promise((r) => setImmediate(r));
    await expect(cache.getOrSet('k', 600, loader)).resolves.toEqual({ n: 1 });
    expect(loader).toHaveBeenCalledTimes(1);
    expect(redis.set).toHaveBeenCalledWith('cache:v0:k', '{"n":1}', 'EX', 600);
  });

  it('invalidatePosts tăng phiên bản → dữ liệu cũ không còn được dùng', async () => {
    const redis = fakeRedis();
    const cache = new CacheService(redis as unknown as Redis);
    const loader = vi
      .fn()
      .mockResolvedValueOnce('cũ')
      .mockResolvedValueOnce('mới');
    await cache.getOrSet('k', 60, loader);
    await new Promise((r) => setImmediate(r));
    await cache.invalidatePosts();
    await expect(cache.getOrSet('k', 60, loader)).resolves.toBe('mới');
  });

  it('Redis chưa sẵn sàng hoặc lỗi → gọi thẳng loader', async () => {
    const offline = new CacheService(
      fakeRedis('connecting') as unknown as Redis,
    );
    await expect(offline.getOrSet('k', 60, async () => 42)).resolves.toBe(42);
    const broken = fakeRedis();
    broken.get.mockRejectedValue(new Error('ECONNRESET'));
    await expect(
      new CacheService(broken as unknown as Redis).getOrSet(
        'k',
        60,
        async () => 7,
      ),
    ).resolves.toBe(7);
    await expect(
      new CacheService(null).getOrSet('k', 60, async () => 'x'),
    ).resolves.toBe('x');
  });
});
