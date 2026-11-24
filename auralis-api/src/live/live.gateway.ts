import { Logger, type OnModuleDestroy } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { randomUUID } from 'node:crypto';
import type { Namespace, Socket } from 'socket.io';
import { z } from 'zod';
import { AuthService } from '../auth/auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { type LiveRoomState, LiveRoomsService } from './live-rooms.service.js';
import { PresenceRegistry } from './presence.registry.js';

export const REACTIONS = ['heart', 'tea', 'star'] as const;
export type Reaction = (typeof REACTIONS)[number];

export interface ChatMessage {
  id: string;
  text: string;
  at: number;
  user: { username: string; displayName: string };
}

interface SocketData {
  user?: { id: string; username: string; displayName: string };
  roomId?: string;
  roomSlug?: string;
  lastMessageAt?: number;
  lastReactionAt?: number;
}

type LiveSocket = Socket<
  Record<string, never>,
  Record<string, never>,
  Record<string, never>,
  SocketData
>;

const MESSAGE_INTERVAL_MS = 1000;
const REACTION_INTERVAL_MS = 250;
const HISTORY_SIZE = 50;

const joinSchema = z.object({ slug: z.string().min(1).max(170) });
const messageSchema = z.object({ text: z.string().trim().min(1).max(300) });
const reactionSchema = z.object({ type: z.enum(REACTIONS) });

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new WsException('Dữ liệu không hợp lệ');
  return result.data;
}

export const roomKey = (roomId: string) => `room_${roomId}`;

/**
 * Phòng nghe chung thời gian thực.
 * Đồng bộ: server giữ `startedAt` của số Radio hiện tại; client nhận `startedAt` + `serverTime`
 * rồi tự tính vị trí phát = (serverTime - startedAt) + độ trễ mạng.
 */
@WebSocketGateway({
  namespace: '/live',
  cors: {
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  },
})
export class LiveGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy
{
  @WebSocketServer() private server!: Namespace;
  private readonly logger = new Logger(LiveGateway.name);
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private readonly history = new Map<string, ChatMessage[]>();

  constructor(
    private readonly rooms: LiveRoomsService,
    private readonly presence: PresenceRegistry,
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  /** Nghe thì không cần đăng nhập; chat cần token (lấy từ GET /api/auth/socket-token) */
  async handleConnection(socket: LiveSocket): Promise<void> {
    const token = (socket.handshake.auth as { token?: unknown } | undefined)
      ?.token;
    if (typeof token !== 'string') return;
    const session = await this.auth.verifyToken(token);
    if (!session) return;
    const user = await this.prisma.user.findUnique({
      where: { id: session.sub },
      select: { id: true, username: true, displayName: true },
    });
    if (user) socket.data.user = user;
  }

  handleDisconnect(socket: LiveSocket): void {
    if (socket.data.roomId) this.updatePresence(socket.data.roomId);
  }

  onModuleDestroy(): void {
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
  }

  @SubscribeMessage('join_room')
  async join(
    @ConnectedSocket() socket: LiveSocket,
    @MessageBody() body: unknown,
  ) {
    const { slug } = parse(joinSchema, body);
    let state: LiveRoomState;
    try {
      state = await this.rooms.getState(slug);
    } catch {
      throw new WsException('Phòng không tồn tại');
    }
    this.leaveCurrent(socket);
    await socket.join(roomKey(state.id));
    socket.data.roomId = state.id;
    socket.data.roomSlug = state.slug;
    const listeners = this.updatePresence(state.id);
    this.schedule(state);
    return {
      ...state,
      listeners,
      me: socket.data.user ? { username: socket.data.user.username } : null,
      messages: this.history.get(state.id) ?? [],
    };
  }

  @SubscribeMessage('leave_room')
  leave(@ConnectedSocket() socket: LiveSocket) {
    this.leaveCurrent(socket);
    return { ok: true };
  }

  /** Client gọi định kỳ để hiệu chỉnh lệch giờ / lệch tiến độ */
  @SubscribeMessage('sync')
  async sync(@ConnectedSocket() socket: LiveSocket) {
    if (!socket.data.roomSlug) throw new WsException('Bạn chưa vào phòng');
    const state = await this.rooms.getState(socket.data.roomSlug);
    return {
      postId: state.track?.postId ?? null,
      startedAt: state.startedAt,
      serverTime: state.serverTime,
    };
  }

  @SubscribeMessage('send_message')
  sendMessage(
    @ConnectedSocket() socket: LiveSocket,
    @MessageBody() body: unknown,
  ) {
    const { user, roomId } = socket.data;
    if (!roomId) throw new WsException('Bạn chưa vào phòng');
    if (!user) throw new WsException('Đăng nhập để trò chuyện');
    const now = Date.now();
    if (now - (socket.data.lastMessageAt ?? 0) < MESSAGE_INTERVAL_MS) {
      throw new WsException('Bạn gửi hơi nhanh, chậm lại một chút nhé');
    }
    const { text } = parse(messageSchema, body);
    socket.data.lastMessageAt = now;

    const message: ChatMessage = {
      id: randomUUID(),
      text: text.replace(/\s+/g, ' '),
      at: now,
      user: { username: user.username, displayName: user.displayName },
    };
    const history = [...(this.history.get(roomId) ?? []), message].slice(
      -HISTORY_SIZE,
    );
    this.history.set(roomId, history);
    this.server.to(roomKey(roomId)).emit('message', message);
    return { ok: true };
  }

  @SubscribeMessage('send_reaction')
  sendReaction(
    @ConnectedSocket() socket: LiveSocket,
    @MessageBody() body: unknown,
  ) {
    const { roomId } = socket.data;
    if (!roomId) throw new WsException('Bạn chưa vào phòng');
    const now = Date.now();
    if (now - (socket.data.lastReactionAt ?? 0) < REACTION_INTERVAL_MS)
      return { ok: false };
    const { type } = parse(reactionSchema, body);
    socket.data.lastReactionAt = now;
    this.server
      .to(roomKey(roomId))
      .emit('reaction', { id: randomUUID(), type });
    return { ok: true };
  }

  private leaveCurrent(socket: LiveSocket): void {
    const { roomId } = socket.data;
    if (!roomId) return;
    void socket.leave(roomKey(roomId));
    socket.data.roomId = undefined;
    socket.data.roomSlug = undefined;
    this.updatePresence(roomId);
  }

  private updatePresence(roomId: string): number {
    const listeners = this.server.adapter.rooms.get(roomKey(roomId))?.size ?? 0;
    this.presence.set(roomId, listeners);
    this.server.to(roomKey(roomId)).emit('presence', { listeners });
    if (listeners === 0) this.clearTimer(roomId);
    return listeners;
  }

  /** Hẹn giờ chuyển bài, chỉ khi phòng còn người nghe */
  private schedule(state: LiveRoomState): void {
    if (!state.endsAt || this.timers.has(state.id)) return;
    const delay = Math.max(0, state.endsAt - Date.now()) + 50;
    const timer = setTimeout(() => {
      this.timers.delete(state.id);
      void this.advance(state.slug, state.id);
    }, delay);
    timer.unref();
    this.timers.set(state.id, timer);
  }

  private async advance(slug: string, roomId: string): Promise<void> {
    if ((this.server.adapter.rooms.get(roomKey(roomId))?.size ?? 0) === 0)
      return;
    try {
      const state = await this.rooms.getState(slug);
      this.server.to(roomKey(roomId)).emit('track_changed', {
        track: state.track,
        nextTrack: state.nextTrack,
        startedAt: state.startedAt,
        endsAt: state.endsAt,
        serverTime: state.serverTime,
      });
      this.schedule(state);
    } catch (error) {
      this.logger.error(
        `Không chuyển bài được cho phòng ${slug}: ${(error as Error).message}`,
      );
    }
  }

  private clearTimer(roomId: string): void {
    const timer = this.timers.get(roomId);
    if (timer) clearTimeout(timer);
    this.timers.delete(roomId);
  }
}
