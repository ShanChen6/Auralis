import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { StorageService } from '../storage/storage.service.js';
import { NarrationsService } from './narrations.service.js';

const POST = '0193f2a1-0000-7000-8000-000000000001';

function setup() {
  const prisma = {
    post: { findUnique: vi.fn(), findMany: vi.fn() },
    narrationClaim: {
      findUnique: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: 'n1' }),
      update: vi.fn().mockResolvedValue({ id: 'n1' }),
    },
  };
  const storage = { ownsUrl: vi.fn().mockReturnValue(true) };
  const service = new NarrationsService(
    prisma as unknown as PrismaService,
    storage as unknown as StorageService,
  );
  return { prisma, storage, service };
}

describe('NarrationsService', () => {
  it('chỉ nhận lồng tiếng bài đã xuất bản và chưa có giọng', async () => {
    const { prisma, service } = setup();
    prisma.post.findUnique.mockResolvedValueOnce(null);
    await expect(service.claim('u1', { postId: POST })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    prisma.post.findUnique.mockResolvedValueOnce({
      status: 'PUBLISHED',
      audioStatus: 'READY',
    });
    await expect(service.claim('u1', { postId: POST })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('nhận mới, không nhận trùng, nhận lại sau khi rút', async () => {
    const { prisma, service } = setup();
    prisma.post.findUnique.mockResolvedValue({
      status: 'PUBLISHED',
      audioStatus: 'TEXT_ONLY',
    });

    prisma.narrationClaim.findUnique.mockResolvedValueOnce(null);
    await service.claim('u1', { postId: POST });
    expect(prisma.narrationClaim.create).toHaveBeenCalled();

    prisma.narrationClaim.findUnique.mockResolvedValueOnce({
      id: 'n1',
      status: 'CLAIMED',
    });
    await expect(service.claim('u1', { postId: POST })).rejects.toThrow(
      'đã nhận',
    );

    prisma.narrationClaim.findUnique.mockResolvedValueOnce({
      id: 'n1',
      status: 'WITHDRAWN',
    });
    await service.claim('u1', { postId: POST });
    expect(prisma.narrationClaim.update.mock.calls[0][0].data.status).toBe(
      'CLAIMED',
    );
  });

  it('nộp bản thu: đúng chủ, đúng trạng thái, file trong kho Auralis', async () => {
    const { prisma, storage, service } = setup();
    const input = { audioUrl: 'https://cdn/a.mp3', duration: 41.6 };

    prisma.narrationClaim.findUnique.mockResolvedValueOnce({
      narratorId: 'khac',
      status: 'CLAIMED',
    });
    await expect(service.submit('u1', 'n1', input)).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    prisma.narrationClaim.findUnique.mockResolvedValueOnce({
      narratorId: 'u1',
      status: 'APPROVED',
    });
    await expect(service.submit('u1', 'n1', input)).rejects.toBeInstanceOf(
      ConflictException,
    );

    storage.ownsUrl.mockReturnValueOnce(false);
    prisma.narrationClaim.findUnique.mockResolvedValueOnce({
      narratorId: 'u1',
      status: 'CLAIMED',
    });
    await expect(service.submit('u1', 'n1', input)).rejects.toThrow(
      'kho lưu trữ',
    );

    prisma.narrationClaim.findUnique.mockResolvedValueOnce({
      narratorId: 'u1',
      status: 'REJECTED',
    });
    await service.submit('u1', 'n1', input);
    expect(prisma.narrationClaim.update.mock.calls[0][0].data).toMatchObject({
      status: 'SUBMITTED',
      duration: 42,
      rejectReason: null,
    });
  });

  it('danh sách bài cần giọng đọc kèm lượt nhận của tôi', async () => {
    const { prisma, service } = setup();
    prisma.post.findMany.mockResolvedValue([
      {
        id: POST,
        slug: 's',
        title: 'T',
        summary: null,
        moodTag: 'CALM',
        author: { displayName: 'A' },
        content: { wordCount: 120 },
        narrations: [
          { id: 'n1', status: 'CLAIMED', narratorId: 'u1' },
          { id: 'n2', status: 'SUBMITTED', narratorId: 'u2' },
        ],
      },
    ]);
    const [post] = await service.listOpen('u1');
    expect(post).toMatchObject({
      wordCount: 120,
      claimCount: 2,
      myClaim: { id: 'n1', status: 'CLAIMED' },
    });
    expect(post).not.toHaveProperty('narrations');
  });
});
