import { ConflictException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service.js';
import { ModerationService } from './moderation.service.js';

function setup() {
  const tx = {
    post: { update: vi.fn() },
    narrationClaim: {
      updateMany: vi.fn(),
      update: vi.fn().mockResolvedValue({ id: 'n1' }),
    },
  };
  const prisma = {
    post: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      count: vi.fn(),
    },
    narrationClaim: { findUnique: vi.fn(), update: vi.fn(), count: vi.fn() },
    $transaction: vi.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  return {
    prisma,
    tx,
    service: new ModerationService(prisma as unknown as PrismaService),
  };
}

describe('ModerationService – bài viết', () => {
  it('duyệt: PENDING → PUBLISHED, ghi người duyệt, sửa tâm trạng', async () => {
    const { prisma, service } = setup();
    prisma.post.findUnique.mockResolvedValue({
      id: 'p1',
      status: 'PENDING',
      audioStatus: 'READY',
    });
    await service.approvePost('editor', 'p1', {
      moodTag: 'HEALING',
      isFeatured: true,
    });
    const data = prisma.post.update.mock.calls[0][0].data;
    expect(data).toMatchObject({
      status: 'PUBLISHED',
      rejectReason: null,
      moodTag: 'HEALING',
      isFeatured: true,
      reviewer: { connect: { id: 'editor' } },
    });
    expect(data.publishedAt).toBeInstanceOf(Date);
  });

  it('không duyệt bài không ở trạng thái chờ hoặc đang tạo Radio', async () => {
    const { prisma, service } = setup();
    prisma.post.findUnique.mockResolvedValueOnce({
      id: 'p1',
      status: 'PUBLISHED',
      audioStatus: 'READY',
    });
    await expect(service.approvePost('e', 'p1', {})).rejects.toBeInstanceOf(
      ConflictException,
    );
    prisma.post.findUnique.mockResolvedValueOnce({
      id: 'p1',
      status: 'PENDING',
      audioStatus: 'PROCESSING',
    });
    await expect(service.approvePost('e', 'p1', {})).rejects.toThrow(
      'đang được tạo',
    );
  });

  it('từ chối kèm lý do', async () => {
    const { prisma, service } = setup();
    prisma.post.findUnique.mockResolvedValue({
      id: 'p1',
      status: 'PENDING',
      audioStatus: 'READY',
    });
    await service.rejectPost('editor', 'p1', {
      reason: 'Nội dung chưa phù hợp',
    });
    expect(prisma.post.update.mock.calls[0][0].data).toMatchObject({
      status: 'REJECTED',
      rejectReason: 'Nội dung chưa phù hợp',
    });
  });
});

describe('ModerationService – lồng tiếng', () => {
  const submitted = {
    id: 'n1',
    status: 'SUBMITTED',
    audioUrl: 'https://cdn/a.mp3',
    duration: 30,
    narratorId: 'voice',
    post: {
      id: 'p1',
      audioStatus: 'TEXT_ONLY',
      content: { content: 'Một.\n\nHai hai.' },
    },
  };

  it('duyệt: gắn audio + CTV vào bài, từ chối các bản còn lại', async () => {
    const { prisma, tx, service } = setup();
    prisma.narrationClaim.findUnique.mockResolvedValue(submitted);
    await service.approveNarration('n1');

    const postData = tx.post.update.mock.calls[0][0].data;
    expect(postData).toMatchObject({
      audioUrl: 'https://cdn/a.mp3',
      duration: 30,
      audioSource: 'UPLOAD',
      audioStatus: 'READY',
      narrator: { connect: { id: 'voice' } },
    });
    expect(postData.content.update.timestamps).toHaveLength(2);
    expect(tx.narrationClaim.updateMany.mock.calls[0][0]).toMatchObject({
      where: { postId: 'p1', id: { not: 'n1' } },
      data: { status: 'REJECTED' },
    });
    expect(tx.narrationClaim.update.mock.calls[0][0].data.status).toBe(
      'APPROVED',
    );
  });

  it('không duyệt bản chưa nộp hoặc bài đã có giọng', async () => {
    const { prisma, service } = setup();
    prisma.narrationClaim.findUnique.mockResolvedValueOnce({
      ...submitted,
      status: 'CLAIMED',
    });
    await expect(service.approveNarration('n1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    prisma.narrationClaim.findUnique.mockResolvedValueOnce({
      ...submitted,
      post: { ...submitted.post, audioStatus: 'READY' },
    });
    await expect(service.approveNarration('n1')).rejects.toThrow(
      'đã có giọng đọc',
    );
  });
});
