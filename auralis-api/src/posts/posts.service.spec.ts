import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service.js';
import { PostsService, isMoodTag, splitParagraphs } from './posts.service.js';

const row = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  slug: `bai-${id}`,
  title: `Bài ${id}`,
  summary: null,
  coverUrl: null,
  audioUrl: `/demo/${id}.mp3`,
  duration: 42,
  moodTag: 'CALM',
  voiceName: 'vi-VN-HoaiMyNeural',
  backgroundMusic: 'piano_rain',
  listenCount: 10,
  publishedAt: new Date('2026-11-20T00:00:00Z'),
  author: { username: 'auralis', displayName: 'Trạm Auralis', avatarUrl: null },
  narrator: null,
  category: { slug: 'radio-dem', name: 'Radio đêm' },
  ...extra,
});

function setup() {
  const prisma = { post: { findMany: vi.fn(), findFirst: vi.fn() } };
  const service = new PostsService(prisma as unknown as PrismaService);
  return { prisma, service };
}

describe('splitParagraphs', () => {
  it('tách theo dòng trống, bỏ đoạn rỗng, chuẩn hóa CRLF', () => {
    expect(
      splitParagraphs('Đoạn một.\r\n\r\nĐoạn hai\ncòn tiếp.\n \n\n'),
    ).toEqual(['Đoạn một.', 'Đoạn hai\ncòn tiếp.']);
  });
});

describe('isMoodTag', () => {
  it('chỉ nhận giá trị enum MoodTag', () => {
    expect(isMoodTag('CALM')).toBe(true);
    expect(isMoodTag('calm')).toBe(false);
    expect(isMoodTag(undefined)).toBe(false);
  });
});

describe('PostsService', () => {
  it('findFeatured lấy bài đã xuất bản + nổi bật, giới hạn 1..20', async () => {
    const { prisma, service } = setup();
    prisma.post.findMany.mockResolvedValue([row('1')]);

    const result = await service.findFeatured(100);

    const args = prisma.post.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ status: 'PUBLISHED', isFeatured: true });
    expect(args.orderBy).toEqual({ publishedAt: 'desc' });
    expect(args.take).toBe(20);
    expect(result[0].publishedAt).toBe('2026-11-20T00:00:00.000Z');
  });

  it('findMany lọc theo tâm trạng/chuyên mục và phân trang bằng cursor', async () => {
    const { prisma, service } = setup();
    prisma.post.findMany.mockResolvedValue([row('a'), row('b'), row('c')]);

    const page = await service.findMany({
      mood: 'HEALING',
      category: 'chua-lanh',
      limit: 2,
      cursor: 'z',
    });

    const args = prisma.post.findMany.mock.calls[0][0];
    expect(args.where).toEqual({
      status: 'PUBLISHED',
      moodTag: 'HEALING',
      category: { slug: 'chua-lanh' },
    });
    expect(args.take).toBe(3);
    expect(args.cursor).toEqual({ id: 'z' });
    expect(args.skip).toBe(1);
    expect(page.items.map((p) => p.id)).toEqual(['a', 'b']);
    expect(page.nextCursor).toBe('b');
  });

  it('findMany trả nextCursor null ở trang cuối', async () => {
    const { prisma, service } = setup();
    prisma.post.findMany.mockResolvedValue([row('a')]);
    expect((await service.findMany()).nextCursor).toBeNull();
  });

  it('findBySlug trả về đoạn văn + timestamps hợp lệ', async () => {
    const { prisma, service } = setup();
    prisma.post.findFirst.mockResolvedValue(
      row('1', {
        content: {
          content: 'Đoạn một.\n\nĐoạn hai.',
          timestamps: [
            { index: 0, start: 3, end: 5.5 },
            { index: 1, start: 6.5, end: 9 },
            { bogus: true },
          ],
          wordCount: 4,
        },
      }),
    );

    const post = await service.findBySlug('bai-1');

    expect(prisma.post.findFirst.mock.calls[0][0].where).toEqual({
      slug: 'bai-1',
      status: 'PUBLISHED',
    });
    expect(post.paragraphs).toEqual(['Đoạn một.', 'Đoạn hai.']);
    expect(post.timestamps).toEqual([
      { index: 0, start: 3, end: 5.5 },
      { index: 1, start: 6.5, end: 9 },
    ]);
    expect(post).not.toHaveProperty('content');
  });

  it('findBySlug ném 404 khi không có bài', async () => {
    const { prisma, service } = setup();
    prisma.post.findFirst.mockResolvedValue(null);
    await expect(service.findBySlug('khong-co')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
