import {
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { RadioQueueService } from '../radio-queue/radio-queue.service.js';
import type { DailyQuotaService } from '../security/daily-quota.service.js';
import type { StorageService } from '../storage/storage.service.js';
import { StudioService } from './studio.service.js';

const content = 'Đoạn một ngắn.\n\nĐoạn hai dài hơn đoạn một rất nhiều chữ.';

function setup({ owns = true, slugTaken = false } = {}) {
  const prisma = {
    category: { findUnique: vi.fn().mockResolvedValue({ id: 'c1' }) },
    post: {
      findUnique: vi.fn().mockResolvedValue(slugTaken ? { id: 'other' } : null),
      create: vi
        .fn()
        .mockImplementation(({ data }) =>
          Promise.resolve({ id: 'p1', ...data }),
        ),
      update: vi.fn().mockResolvedValue({}),
    },
  };
  const storage = { ownsUrl: vi.fn().mockReturnValue(owns) };
  const queue = { enqueue: vi.fn().mockResolvedValue(undefined) };
  const quota = {
    consume: vi.fn().mockResolvedValue({}),
    refund: vi.fn(),
    status: vi
      .fn()
      .mockResolvedValue({
        kind: 'post',
        limit: 5,
        used: 1,
        remaining: 4,
        day: 'd',
      }),
  };
  const service = new StudioService(
    prisma as unknown as PrismaService,
    storage as unknown as StorageService,
    queue as unknown as RadioQueueService,
    quota as unknown as DailyQuotaService,
  );
  return { prisma, storage, queue, quota, service };
}

const base = { title: 'Trạm đêm mưa', moodTag: 'CALM' as const, content };
const ai = {
  mode: 'ai' as const,
  voice: 'male_deep' as const,
  music: 'lofi_warm' as const,
};
const upload = {
  mode: 'upload' as const,
  audioUrl: 'https://cdn.auralis.vn/audio/a.mp3',
  duration: 60.4,
};

describe('StudioService – người dùng thường', () => {
  it('đăng bài chữ: PENDING + TEXT_ONLY, trừ 1 lượt đăng bài trong ngày', async () => {
    const { prisma, quota, queue, service } = setup();
    await service.createPost(
      'u1',
      { ...base, audio: { mode: 'none' } },
      'AUTHOR',
    );
    expect(prisma.post.create.mock.calls[0][0].data).toMatchObject({
      slug: 'tram-dem-mua',
      status: 'PENDING',
      audioSource: 'NONE',
      audioStatus: 'TEXT_ONLY',
      author: { connect: { id: 'u1' } },
    });
    expect(quota.consume).toHaveBeenCalledWith('post', 'u1', 'AUTHOR');
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it.each([
    ['Radio AI', ai],
    ['bản thu tải lên', upload],
  ])(
    'không được tạo audio (%s) → 403, không tạo bài, không trừ lượt',
    async (_, audio) => {
      const { prisma, quota, service } = setup();
      for (const role of ['AUTHOR', 'LISTENER'] as const) {
        await expect(
          service.createPost('u1', { ...base, audio }, role),
        ).rejects.toBeInstanceOf(ForbiddenException);
      }
      expect(prisma.post.create).not.toHaveBeenCalled();
      expect(quota.consume).not.toHaveBeenCalled();
    },
  );

  it('hết lượt đăng trong ngày → không tạo bài', async () => {
    const { prisma, quota, service } = setup();
    quota.consume.mockRejectedValueOnce(new Error('hết lượt'));
    await expect(
      service.createPost('u1', { ...base, audio: { mode: 'none' } }, 'AUTHOR'),
    ).rejects.toThrow('hết lượt');
    expect(prisma.post.create).not.toHaveBeenCalled();
  });

  it('ghi bài lỗi → hoàn lượt', async () => {
    const { prisma, quota, service } = setup();
    prisma.post.create.mockRejectedValueOnce(new Error('db down'));
    await expect(
      service.createPost('u1', { ...base, audio: { mode: 'none' } }, 'AUTHOR'),
    ).rejects.toThrow('db down');
    expect(quota.refund).toHaveBeenCalledWith('post', 'u1', 'AUTHOR');
  });

  it('slug trùng thì thêm hậu tố; chuyên mục phải tồn tại', async () => {
    const { prisma, service } = setup({ slugTaken: true });
    await service.createPost(
      'u1',
      { ...base, categorySlug: 'tan-van', audio: { mode: 'none' } },
      'AUTHOR',
    );
    const data = prisma.post.create.mock.calls[0][0].data;
    expect(data.slug).toMatch(/^tram-dem-mua-[a-z0-9]{1,6}$/);
    expect(data.category).toEqual({ connect: { slug: 'tan-van' } });

    prisma.category.findUnique.mockResolvedValue(null);
    await expect(
      service.createPost(
        'u1',
        { ...base, categorySlug: 'khong-co', audio: { mode: 'none' } },
        'AUTHOR',
      ),
    ).rejects.toThrow('Chuyên mục không tồn tại');
  });

  it('quota trả kèm quyền tạo audio', async () => {
    const { service } = setup();
    await expect(service.quotaStatus('u1', 'AUTHOR')).resolves.toMatchObject({
      remaining: 4,
      canCreateAudio: false,
    });
    await expect(service.quotaStatus('e1', 'EDITOR')).resolves.toMatchObject({
      canCreateAudio: true,
    });
  });
});

describe('StudioService – ban biên tập', () => {
  it('Radio AI: PROCESSING và đưa job vào hàng đợi', async () => {
    const { prisma, queue, service } = setup();
    await service.createPost('e1', { ...base, audio: ai }, 'EDITOR');
    expect(prisma.post.create.mock.calls[0][0].data).toMatchObject({
      audioSource: 'AI_EDGE',
      audioStatus: 'PROCESSING',
      voiceName: 'vi-VN-NamMinhNeural',
      backgroundMusic: 'lofi_warm',
    });
    expect(queue.enqueue).toHaveBeenCalledWith({
      postId: 'p1',
      voice: 'male_deep',
      music: 'lofi_warm',
    });
  });

  it('bản thu tải lên: READY + ước lượng timestamps; chặn link ngoài', async () => {
    const { prisma, service } = setup();
    await service.createPost('a1', { ...base, audio: upload }, 'ADMIN');
    const data = prisma.post.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      audioSource: 'UPLOAD',
      audioStatus: 'READY',
      duration: 60,
    });
    expect(data.content.create.timestamps).toHaveLength(2);
    expect(data.content.create.timestamps[1].end).toBeCloseTo(60.4);

    const { service: other } = setup({ owns: false });
    await expect(
      other.createPost('a1', { ...base, audio: upload }, 'ADMIN'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('giọng Studio dùng VoiceStudio; hàng đợi lỗi → FAILED', async () => {
    const { prisma, queue, service } = setup();
    queue.enqueue.mockRejectedValue(
      new ServiceUnavailableException('queue off'),
    );
    await expect(
      service.createPost(
        'e1',
        { ...base, audio: { mode: 'ai', voice: 'studio', music: null } },
        'EDITOR',
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(prisma.post.create.mock.calls[0][0].data.audioSource).toBe(
      'AI_VOICESTUDIO',
    );
    expect(prisma.post.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { audioStatus: 'FAILED' },
    });
  });

  it('tạo lại Radio chỉ khi FAILED, khôi phục đúng giọng/nhạc', async () => {
    const { prisma, queue, service } = setup();
    prisma.post.findUnique.mockResolvedValueOnce({
      id: 'p1',
      audioStatus: 'READY',
    });
    await expect(service.retryAudio('p1')).rejects.toThrow('Chỉ tạo lại');
    prisma.post.findUnique.mockResolvedValueOnce({
      id: 'p1',
      audioStatus: 'FAILED',
      audioSource: 'AI_EDGE',
      voiceName: 'vi-VN-NamMinhNeural',
      backgroundMusic: 'piano_rain',
    });
    await service.retryAudio('p1');
    expect(queue.enqueue).toHaveBeenCalledWith({
      postId: 'p1',
      voice: 'male_deep',
      music: 'piano_rain',
    });
  });
});
