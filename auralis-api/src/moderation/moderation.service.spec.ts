import { ConflictException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { RadioQueueService } from '../radio-queue/radio-queue.service.js';
import type { ContentEvents } from '../security/web-revalidator.service.js';
import type { StorageService } from '../storage/storage.service.js';
import { ModerationService } from './moderation.service.js';

function setup() {
  const tx = {
    post: { update: vi.fn() },
    narrationClaim: {
      updateMany: vi.fn(),
      update: vi
        .fn()
        .mockResolvedValue({ id: 'n1', post: { slug: 'cho-giong-doc' } }),
    },
  };
  const prisma = {
    post: {
      findUnique: vi.fn(),
      update: vi
        .fn()
        .mockResolvedValue({ slug: 'bai-viet', status: 'PUBLISHED' }),
      count: vi.fn(),
    },
    narrationClaim: { findUnique: vi.fn(), update: vi.fn(), count: vi.fn() },
    $transaction: vi.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  const events = { postsChanged: vi.fn().mockResolvedValue(undefined) };
  const storage = { ownsUrl: vi.fn().mockReturnValue(true) };
  const queue = { enqueue: vi.fn().mockResolvedValue(undefined) };
  return {
    prisma,
    tx,
    events,
    storage,
    queue,
    service: new ModerationService(
      prisma as unknown as PrismaService,
      events as unknown as ContentEvents,
      storage as unknown as StorageService,
      queue as unknown as RadioQueueService,
    ),
  };
}

describe('ModerationService – bài viết', () => {
  it('duyệt: PENDING → PUBLISHED, ghi người duyệt, sửa tâm trạng, làm mới cache/trang', async () => {
    const { prisma, events, service } = setup();
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
    expect(events.postsChanged).toHaveBeenCalledWith(['bai-viet']);
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

  it('từ chối kèm lý do (không cần làm mới trang công khai)', async () => {
    const { prisma, events, service } = setup();
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
    expect(events.postsChanged).not.toHaveBeenCalled();
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

describe('ModerationService – ban biên tập tạo giọng đọc', () => {
  const textPost = {
    audioStatus: 'TEXT_ONLY',
    content: { content: 'Đoạn một.\n\nĐoạn hai dài hơn.' },
  };

  it('Radio AI: PROCESSING, bỏ gắn CTV cũ, đưa job vào hàng đợi', async () => {
    const { prisma, queue, events, service } = setup();
    prisma.post.findUnique.mockResolvedValue(textPost);
    await service.attachAudio('p1', {
      mode: 'ai',
      voice: 'female_warm',
      music: 'piano_rain',
    });
    expect(prisma.post.update.mock.calls[0][0].data).toMatchObject({
      audioSource: 'AI_EDGE',
      audioStatus: 'PROCESSING',
      voiceName: 'vi-VN-HoaiMyNeural',
      backgroundMusic: 'piano_rain',
      narrator: { disconnect: true },
    });
    expect(queue.enqueue).toHaveBeenCalledWith({
      postId: 'p1',
      voice: 'female_warm',
      music: 'piano_rain',
    });
    // Trang công khai chỉ làm mới khi Radio tạo xong (worker), không phải lúc này
    expect(events.postsChanged).not.toHaveBeenCalled();
  });

  it('bản thu tải lên: READY + timestamps ước lượng, làm mới trang nếu đã xuất bản', async () => {
    const { prisma, events, service } = setup();
    prisma.post.findUnique.mockResolvedValue(textPost);
    await service.attachAudio('p1', {
      mode: 'upload',
      audioUrl: 'https://cdn/a.mp3',
      duration: 40,
    });
    const data = prisma.post.update.mock.calls[0][0].data;
    expect(data).toMatchObject({
      audioSource: 'UPLOAD',
      audioStatus: 'READY',
      duration: 40,
    });
    expect(data.content.update.timestamps).toHaveLength(2);
    expect(events.postsChanged).toHaveBeenCalledWith(['bai-viet']);
  });

  it('chặn khi đang tạo Radio, link ngoài, hoặc bài không tồn tại; hàng đợi lỗi → FAILED', async () => {
    const { prisma, storage, queue, service } = setup();
    prisma.post.findUnique.mockResolvedValueOnce({
      ...textPost,
      audioStatus: 'PROCESSING',
    });
    await expect(
      service.attachAudio('p1', {
        mode: 'ai',
        voice: 'male_deep',
        music: null,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    storage.ownsUrl.mockReturnValueOnce(false);
    prisma.post.findUnique.mockResolvedValueOnce(textPost);
    await expect(
      service.attachAudio('p1', {
        mode: 'upload',
        audioUrl: 'https://evil/a.mp3',
        duration: 3,
      }),
    ).rejects.toThrow('kho lưu trữ');

    prisma.post.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.attachAudio('x', { mode: 'ai', voice: 'male_deep', music: null }),
    ).rejects.toThrow('Không tìm thấy');

    queue.enqueue.mockRejectedValueOnce(new Error('queue off'));
    prisma.post.findUnique.mockResolvedValueOnce(textPost);
    await expect(
      service.attachAudio('p1', {
        mode: 'ai',
        voice: 'male_deep',
        music: null,
      }),
    ).rejects.toThrow('queue off');
    expect(prisma.post.update).toHaveBeenLastCalledWith({
      where: { id: 'p1' },
      data: { audioStatus: 'FAILED' },
    });
  });
});
