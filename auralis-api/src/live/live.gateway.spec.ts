import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AddressInfo } from 'node:net';
import { io, type Socket } from 'socket.io-client';
import { AuthService } from '../auth/auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { LiveRoomsService, type LiveRoomState } from './live-rooms.service.js';
import { LiveGateway } from './live.gateway.js';
import { PresenceRegistry } from './presence.registry.js';

const track = (id: string) => ({
  postId: id,
  slug: id,
  title: `Bài ${id}`,
  artist: 'Auralis',
  audioUrl: `/demo/${id}.mp3`,
  duration: 1,
  moodTag: 'CALM' as const,
  coverUrl: null,
});

let current = 0;
function state(): LiveRoomState {
  const now = Date.now();
  return {
    id: 'room-1',
    slug: 'tram-dem-mua-22h',
    name: 'Trạm Đêm Mưa 22h',
    description: null,
    coverUrl: null,
    status: 'LIVE',
    scheduledAt: null,
    host: { username: 'auralis', displayName: 'Trạm Auralis' },
    track: track(current === 0 ? 'a' : 'b'),
    nextTrack: null,
    startedAt: now - 200,
    endsAt: now + 300,
    serverTime: now,
    listeners: 0,
  };
}

describe('LiveGateway (Socket.io thật)', () => {
  let app: INestApplication;
  let url: string;
  const sockets: Socket[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        LiveGateway,
        PresenceRegistry,
        {
          provide: LiveRoomsService,
          useValue: {
            getState: vi.fn(async (slug: string) => {
              if (slug !== 'tram-dem-mua-22h') throw new Error('not found');
              return state();
            }),
          },
        },
        {
          provide: AuthService,
          useValue: {
            verifyToken: vi.fn(async (t: string) =>
              t === 'valid'
                ? { sub: 'u1', role: 'AUTHOR', username: 'shan' }
                : null,
            ),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: vi.fn(async () => ({
                id: 'u1',
                username: 'shan',
                displayName: 'Shan',
              })),
            },
          },
        },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.listen(0);
    const { port } = app.getHttpServer().address() as AddressInfo;
    url = `http://localhost:${port}/live`;
  });

  afterEach(() => {
    sockets.splice(0).forEach((s) => s.disconnect());
    current = 0;
  });

  afterAll(async () => {
    await app.close();
  });

  async function connect(token?: string): Promise<Socket> {
    const socket = io(url, {
      auth: token ? { token } : {},
      transports: ['websocket'],
      forceNew: true,
    });
    sockets.push(socket);
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('connect_error', reject);
    });
    return socket;
  }

  const emit = <T>(socket: Socket, event: string, data?: unknown) =>
    socket.timeout(2000).emitWithAck(event, data) as Promise<T>;

  it('join_room trả về bài đang phát, startedAt, serverTime và lịch sử chat', async () => {
    const socket = await connect();
    const res = await emit<
      LiveRoomState & { messages: unknown[]; me: unknown }
    >(socket, 'join_room', {
      slug: 'tram-dem-mua-22h',
    });
    expect(res.track?.postId).toBe('a');
    expect(res.serverTime - (res.startedAt ?? 0)).toBeGreaterThanOrEqual(200);
    expect(res.listeners).toBe(1);
    expect(res.me).toBeNull();
    expect(res.messages).toEqual([]);
  });

  it('phòng không tồn tại → lỗi', async () => {
    const socket = await connect();
    const error = new Promise((resolve) => socket.once('exception', resolve));
    socket.emit('join_room', { slug: 'khong-co' });
    await expect(error).resolves.toMatchObject({
      message: 'Phòng không tồn tại',
    });
  });

  it('chat cần đăng nhập; tin nhắn tới mọi người trong phòng; chặn gửi quá nhanh', async () => {
    const guest = await connect();
    const member = await connect('valid');
    await emit(guest, 'join_room', { slug: 'tram-dem-mua-22h' });
    await emit(member, 'join_room', { slug: 'tram-dem-mua-22h' });

    const guestError = new Promise((resolve) =>
      guest.once('exception', resolve),
    );
    guest.emit('send_message', { text: 'xin chào' });
    await expect(guestError).resolves.toMatchObject({
      message: 'Đăng nhập để trò chuyện',
    });

    const received = new Promise((resolve) => guest.once('message', resolve));
    await emit(member, 'send_message', { text: '  Chào   cả nhà  ' });
    await expect(received).resolves.toMatchObject({
      text: 'Chào cả nhà',
      user: { username: 'shan', displayName: 'Shan' },
    });

    const tooFast = new Promise((resolve) => member.once('exception', resolve));
    member.emit('send_message', { text: 'lần nữa' });
    await expect(tooFast).resolves.toMatchObject({
      message: expect.stringContaining('nhanh'),
    });
  });

  it('thả cảm xúc tới cả phòng; loại không hợp lệ bị từ chối', async () => {
    const a = await connect();
    const b = await connect();
    await emit(a, 'join_room', { slug: 'tram-dem-mua-22h' });
    await emit(b, 'join_room', { slug: 'tram-dem-mua-22h' });
    const reaction = new Promise((resolve) => b.once('reaction', resolve));
    await emit(a, 'send_reaction', { type: 'tea' });
    await expect(reaction).resolves.toMatchObject({ type: 'tea' });

    const invalid = new Promise((resolve) => a.once('exception', resolve));
    await new Promise((r) => setTimeout(r, 300));
    a.emit('send_reaction', { type: 'bomb' });
    await expect(invalid).resolves.toMatchObject({
      message: 'Dữ liệu không hợp lệ',
    });
  });

  it('cập nhật số người nghe và tự phát track_changed khi hết bài', async () => {
    const a = await connect();
    await emit(a, 'join_room', { slug: 'tram-dem-mua-22h' });
    const presence = new Promise((resolve) => a.once('presence', resolve));
    const b = await connect();
    await emit(b, 'join_room', { slug: 'tram-dem-mua-22h' });
    await expect(presence).resolves.toEqual({ listeners: 2 });

    current = 1; // lần gọi getState tiếp theo trả về bài b
    const changed = await new Promise<{ track: { postId: string } }>(
      (resolve) => a.once('track_changed', resolve),
    );
    expect(changed.track.postId).toBe('b');
  });
});
