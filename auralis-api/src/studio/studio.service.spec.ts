import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { RadioQueueService } from '../radio-queue/radio-queue.service.js';
import type { StorageService } from '../storage/storage.service.js';
import type { AiQuotaService } from '../security/ai-quota.service.js';
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
      findFirst: vi.fn(),
    },
  };
  const storage = { ownsUrl: vi.fn().mockReturnValue(owns) };
  const queue = { enqueue: vi.fn().mockResolvedValue(undefined) };
  const quota = {
    consume: vi.fn().mockResolvedValue({}),
    refund: vi.fn(),
    status: vi.fn(),
  };
  const service = new StudioService(
    prisma as unknown as PrismaService,
    storage as unknown as StorageService,
    queue as unknown as RadioQueueService,
    quota as unknown as AiQuotaService,
  );
  return { prisma, storage, queue, quota, service };
}

const base = { title: 'Trạm đêm mưa', moodTag: 'CALM' as const, content };

describe('StudioService.createPost', () => {
  it('upload: chỉ nhận file trong kho Auralis, ước lượng timestamps, PENDING + READY', async () => {
    const { prisma, service } = setup();
    await service.createPost('u1', {
      ...base,
      audio: {
        mode: 'upload',
        audioUrl: 'https://cdn.auralis.vn/audio/a.mp3',
        duration: 60.4,
      },
    });
    const data = prisma.post.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      slug: 'tram-dem-mua',
      status: 'PENDING',
      audioSource: 'UPLOAD',
      audioStatus: 'READY',
      duration: 60,
      author: { connect: { id: 'u1' } },
    });
    const stamps = data.content.create.timestamps;
    expect(stamps).toHaveLength(2);
    expect(stamps[1].end).toBeCloseTo(60.4);
    expect(stamps[0].end).toBeLessThan(stamps[1].end - stamps[1].start);
  });

  it('upload: từ chối link ngoài', async () => {
    const { service } = setup({ owns: false });
    await expect(
      service.createPost('u1', {
        ...base,
        audio: {
          mode: 'upload',
          audioUrl: 'https://evil.example/a.mp3',
          duration: 10,
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('ai: PROCESSING và đưa job vào hàng đợi', async () => {
    const { prisma, queue, service } = setup();
    await service.createPost('u1', {
      ...base,
      audio: { mode: 'ai', voice: 'male_deep', music: 'lofi_warm' },
    });
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

  it('ai: giọng Studio dùng VoiceStudio; hàng đợi lỗi → FAILED và báo lỗi', async () => {
    const { prisma, queue, service } = setup();
    queue.enqueue.mockRejectedValue(
      new ServiceUnavailableException('queue off'),
    );
    await expect(
      service.createPost('u1', {
        ...base,
        audio: { mode: 'ai', voice: 'studio', music: null },
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(prisma.post.create.mock.calls[0][0].data.audioSource).toBe(
      'AI_VOICESTUDIO',
    );
    expect(prisma.post.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { audioStatus: 'FAILED' },
    });
  });

  it('none: TEXT_ONLY; slug trùng thì thêm hậu tố; chuyên mục phải tồn tại', async () => {
    const { prisma, service } = setup({ slugTaken: true });
    await service.createPost('u1', {
      ...base,
      categorySlug: 'tan-van',
      audio: { mode: 'none' },
    });
    const data = prisma.post.create.mock.calls[0][0].data;
    expect(data.audioStatus).toBe('TEXT_ONLY');
    expect(data.slug).toMatch(/^tram-dem-mua-[a-z0-9]{1,6}$/);
    expect(data.category).toEqual({ connect: { slug: 'tan-van' } });

    prisma.category.findUnique.mockResolvedValue(null);
    await expect(
      service.createPost('u1', {
        ...base,
        categorySlug: 'khong-co',
        audio: { mode: 'none' },
      }),
    ).rejects.toThrow('Chuyên mục không tồn tại');
  });
});

describe('StudioService.retryAudio', () => {
  it('chỉ tạo lại khi FAILED, khôi phục đúng giọng/nhạc', async () => {
    const { prisma, queue, service } = setup();
    prisma.post.findFirst.mockResolvedValueOnce({
      id: 'p1',
      audioStatus: 'READY',
      audioSource: 'AI_EDGE',
      voiceName: null,
      backgroundMusic: null,
    });
    await expect(service.retryAudio('u1', 'p1')).rejects.toThrow('Chỉ tạo lại');

    prisma.post.findFirst.mockResolvedValueOnce({
      id: 'p1',
      audioStatus: 'FAILED',
      audioSource: 'AI_EDGE',
      voiceName: 'vi-VN-NamMinhNeural',
      backgroundMusic: 'piano_rain',
    });
    await service.retryAudio('u1', 'p1');
    expect(queue.enqueue).toHaveBeenCalledWith({
      postId: 'p1',
      voice: 'male_deep',
      music: 'piano_rain',
    });
  });
});

describe('StudioService – quota Radio AI', () => {
  it('chỉ trừ lượt khi tạo Radio AI; hết lượt thì không tạo bài', async () => {
    const { prisma, quota, service } = setup();
    await service.createPost('u1', { ...base, audio: { mode: 'none' } });
    expect(quota.consume).not.toHaveBeenCalled();

    await service.createPost(
      'u1',
      { ...base, audio: { mode: 'ai', voice: 'female_warm', music: null } },
      'AUTHOR',
    );
    expect(quota.consume).toHaveBeenCalledWith('u1', 'AUTHOR');

    quota.consume.mockRejectedValueOnce(new Error('hết lượt'));
    prisma.post.create.mockClear();
    await expect(
      service.createPost('u1', {
        ...base,
        audio: { mode: 'ai', voice: 'female_warm', music: null },
      }),
    ).rejects.toThrow('hết lượt');
    expect(prisma.post.create).not.toHaveBeenCalled();
  });

  it('hoàn lượt khi ghi bài lỗi', async () => {
    const { prisma, quota, service } = setup();
    prisma.post.create.mockRejectedValueOnce(new Error('db down'));
    await expect(
      service.createPost('u1', {
        ...base,
        audio: { mode: 'ai', voice: 'male_deep', music: null },
      }),
    ).rejects.toThrow('db down');
    expect(quota.refund).toHaveBeenCalledWith('u1');
  });
});
