import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AudioStatus,
  LiveRoomStatus,
  PostStatus,
} from '../generated/prisma/enums.js';
import type { MoodTag } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PresenceRegistry } from './presence.registry.js';
import {
  type ClockTrack,
  nextChangeAt,
  resolvePlayback,
} from './room-clock.js';

export interface LiveTrack {
  postId: string;
  slug: string;
  title: string;
  artist: string;
  audioUrl: string;
  duration: number;
  moodTag: MoodTag;
  coverUrl: string | null;
}

export interface LiveRoomState {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  status: LiveRoomStatus;
  scheduledAt: string | null;
  host: { username: string; displayName: string };
  track: LiveTrack | null;
  nextTrack: { title: string } | null;
  /** epoch ms */
  startedAt: number | null;
  /** epoch ms – thời điểm sẽ chuyển bài */
  endsAt: number | null;
  /** epoch ms – giờ máy chủ khi tạo payload, dùng để client bù độ trễ */
  serverTime: number;
  listeners: number;
}

const trackSelect = {
  id: true,
  slug: true,
  title: true,
  audioUrl: true,
  duration: true,
  moodTag: true,
  coverUrl: true,
  author: { select: { displayName: true } },
  narrator: { select: { displayName: true } },
} as const;

@Injectable()
export class LiveRoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly presence: PresenceRegistry,
  ) {}

  async list(): Promise<LiveRoomState[]> {
    const rooms = await this.prisma.liveRoom.findMany({
      where: {
        status: { in: [LiveRoomStatus.LIVE, LiveRoomStatus.SCHEDULED] },
      },
      orderBy: [
        { status: 'asc' },
        { scheduledAt: 'asc' },
        { createdAt: 'asc' },
      ],
      select: { slug: true },
    });
    const states = await Promise.all(rooms.map((r) => this.getState(r.slug)));
    // Phòng đang phát lên trước, rồi tới phòng sắp lên sóng
    return states.sort(
      (a, b) => Number(b.status === 'LIVE') - Number(a.status === 'LIVE'),
    );
  }

  /** Trạng thái phòng tại thời điểm hiện tại; tự chuyển bài (và lưu lại) khi bài trước đã hết */
  async getState(slug: string, now = Date.now()): Promise<LiveRoomState> {
    const room = await this.prisma.liveRoom.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        coverUrl: true,
        status: true,
        scheduledAt: true,
        currentPostId: true,
        startedAt: true,
        playlistId: true,
        host: { select: { username: true, displayName: true } },
      },
    });
    if (!room || room.status === LiveRoomStatus.ENDED) {
      throw new NotFoundException(`Không tìm thấy phòng "${slug}"`);
    }

    const base = {
      id: room.id,
      slug: room.slug,
      name: room.name,
      description: room.description,
      coverUrl: room.coverUrl,
      status: room.status,
      scheduledAt: room.scheduledAt?.toISOString() ?? null,
      host: room.host,
      serverTime: now,
      listeners: this.presence.get(room.id),
    };
    const idle = {
      ...base,
      track: null,
      nextTrack: null,
      startedAt: null,
      endsAt: null,
    };
    if (room.status !== LiveRoomStatus.LIVE) return idle;

    const tracks = await this.loadTracks(room.playlistId);
    const clock: ClockTrack[] = tracks.map((t) => ({
      postId: t.postId,
      duration: t.duration,
    }));
    const playback = resolvePlayback(
      clock,
      room.currentPostId,
      room.startedAt?.getTime() ?? null,
      now,
    );
    if (!playback) return idle;

    const track = tracks[playback.index];
    if (
      track.postId !== room.currentPostId ||
      playback.startedAt !== room.startedAt?.getTime()
    ) {
      await this.prisma.liveRoom.update({
        where: { id: room.id },
        data: {
          currentPostId: track.postId,
          startedAt: new Date(playback.startedAt),
        },
      });
    }
    return {
      ...base,
      track,
      nextTrack:
        tracks.length > 1
          ? { title: tracks[(playback.index + 1) % tracks.length].title }
          : null,
      startedAt: playback.startedAt,
      endsAt: nextChangeAt(clock[playback.index], playback.startedAt),
    };
  }

  /** Playlist của phòng; phòng chưa gắn playlist thì phát các số nổi bật */
  private async loadTracks(playlistId: string | null): Promise<LiveTrack[]> {
    const playable = {
      status: PostStatus.PUBLISHED,
      audioStatus: AudioStatus.READY,
      audioUrl: { not: null },
      duration: { gt: 0 },
    };
    const posts = playlistId
      ? (
          await this.prisma.playlistItem.findMany({
            where: { playlistId, post: playable },
            orderBy: { position: 'asc' },
            select: { post: { select: trackSelect } },
          })
        ).map((item) => item.post)
      : await this.prisma.post.findMany({
          where: { ...playable, isFeatured: true },
          orderBy: { publishedAt: 'desc' },
          take: 10,
          select: trackSelect,
        });

    return posts.map((p) => ({
      postId: p.id,
      slug: p.slug,
      title: p.title,
      artist: p.narrator?.displayName ?? p.author.displayName,
      audioUrl: p.audioUrl!,
      duration: p.duration!,
      moodTag: p.moodTag,
      coverUrl: p.coverUrl,
    }));
  }
}
