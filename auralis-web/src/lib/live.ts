import type { MoodTag } from "./format";

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
  status: "SCHEDULED" | "LIVE" | "ENDED";
  scheduledAt: string | null;
  host: { username: string; displayName: string };
  track: LiveTrack | null;
  nextTrack: { title: string } | null;
  startedAt: number | null;
  endsAt: number | null;
  serverTime: number;
  listeners: number;
}

export interface ChatMessage {
  id: string;
  text: string;
  at: number;
  user: { username: string; displayName: string };
}

export type ReactionType = "heart" | "tea" | "star";

/** Địa chỉ Socket.io của auralis-api (WebSocket đi thẳng tới API, không qua proxy Next) */
export function socketUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SOCKET_URL;
  if (configured) return configured.replace(/\/$/, "");
  return `${window.location.protocol}//${window.location.hostname}:4000`;
}

/**
 * Ước lượng độ lệch đồng hồ máy chủ so với máy khách (ms) từ một lần hỏi–đáp:
 * máy chủ trả serverTime ở khoảng giữa chuyến đi, nên offset ≈ serverTime + RTT/2 − lúc nhận.
 */
export function estimateClockOffset(sentAt: number, receivedAt: number, serverTime: number): number {
  const latency = (receivedAt - sentAt) / 2;
  return serverTime + latency - receivedAt;
}

/** Vị trí phát (giây) mà mọi người trong phòng đang nghe, theo đồng hồ máy chủ */
export function livePosition(startedAt: number, clockOffset: number, now = Date.now()): number {
  return Math.max(0, (now + clockOffset - startedAt) / 1000);
}
