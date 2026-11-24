"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { api } from "@/lib/client-api";
import {
  type ChatMessage,
  type LiveRoomState,
  type ReactionType,
  estimateClockOffset,
  livePosition,
  socketUrl,
} from "@/lib/live";
import { usePlayer } from "@/store/player";

const DRIFT_TOLERANCE_S = 1;
const DRIFT_CHECK_MS = 5_000;
const RESYNC_MS = 30_000;

type JoinResponse = LiveRoomState & { messages: ChatMessage[]; me: { username: string } | null };

export interface FloatingReaction {
  id: string;
  type: ReactionType;
}

/**
 * Kết nối phòng nghe chung: đồng bộ tiến độ phát với máy chủ, chat và cảm xúc thời gian thực.
 * `listening` = người dùng đã bấm vào nghe (trình duyệt yêu cầu thao tác người dùng để phát âm thanh).
 */
export function useLiveRoom(slug: string, loggedIn: boolean) {
  const socketRef = useRef<Socket | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const offsetRef = useRef(0);
  const [room, setRoom] = useState<LiveRoomState | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [canChat, setCanChat] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [position, setPosition] = useState(0);
  const roomRef = useRef<LiveRoomState | null>(null);
  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  /** Đưa thẻ audio về đúng bài + đúng giây mọi người đang nghe */
  const alignAudio = useCallback((force = false) => {
    const audio = audioRef.current;
    const state = roomRef.current;
    if (!audio || !state?.track || state.startedAt === null) return;
    const target = livePosition(state.startedAt, offsetRef.current);
    const src = new URL(state.track.audioUrl, window.location.href).href;
    if (audio.src !== src) {
      audio.src = src;
      force = true;
    }
    if (target >= state.track.duration) {
      audio.pause(); // khoảng nghỉ giữa hai bài
      return;
    }
    if (force || Math.abs(audio.currentTime - target) > DRIFT_TOLERANCE_S) audio.currentTime = target;
    if (audio.paused) void audio.play().catch(() => setListening(false));
  }, []);

  useEffect(() => {
    let disposed = false;
    let socket: Socket | null = null;

    async function connect() {
      const token = loggedIn
        ? await api<{ token: string }>("/auth/socket-token").then((r) => r.token).catch(() => undefined)
        : undefined;
      if (disposed) return;
      socket = io(`${socketUrl()}/live`, { auth: token ? { token } : {}, transports: ["websocket", "polling"] });
      socketRef.current = socket;

      const join = async () => {
        const sentAt = Date.now();
        try {
          const res = (await socket!.timeout(8000).emitWithAck("join_room", { slug })) as JoinResponse;
          offsetRef.current = estimateClockOffset(sentAt, Date.now(), res.serverTime);
          setRoom(res);
          setMessages(res.messages);
          setCanChat(Boolean(res.me));
          setError(null);
        } catch {
          setError("Không vào được phòng. Đang thử lại…");
        }
      };

      socket.on("connect", () => {
        setConnected(true);
        void join();
      });
      socket.on("disconnect", () => setConnected(false));
      socket.on("exception", (e: { message?: string }) => setError(e.message ?? "Có lỗi xảy ra"));
      socket.on("presence", ({ listeners }: { listeners: number }) =>
        setRoom((r) => (r ? { ...r, listeners } : r)),
      );
      socket.on("track_changed", (patch: Pick<LiveRoomState, "track" | "nextTrack" | "startedAt" | "endsAt" | "serverTime">) => {
        setRoom((r) => (r ? { ...r, ...patch } : r));
      });
      socket.on("message", (message: ChatMessage) => setMessages((list) => [...list, message].slice(-100)));
      socket.on("reaction", (reaction: FloatingReaction) => {
        setReactions((list) => [...list, reaction].slice(-40));
        setTimeout(() => setReactions((list) => list.filter((r) => r.id !== reaction.id)), 3200);
      });
    }

    void connect();
    return () => {
      disposed = true;
      socket?.emit("leave_room");
      socket?.disconnect();
      socketRef.current = null;
    };
  }, [slug, loggedIn]);

  // Thẻ audio riêng cho phòng (không dùng chung trình phát cá nhân)
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "auto";
    audioRef.current = audio;
    return () => {
      audio.pause();
      audio.src = "";
      audioRef.current = null;
    };
  }, []);

  // Khi đổi bài (track_changed) hoặc vừa vào nghe → căn lại
  useEffect(() => {
    if (listening) alignAudio(true);
  }, [listening, room?.track?.postId, room?.startedAt, alignAudio]);

  // Đồng hồ hiển thị + hiệu chỉnh lệch định kỳ
  useEffect(() => {
    const tick = setInterval(() => {
      const state = roomRef.current;
      if (state?.startedAt != null) setPosition(livePosition(state.startedAt, offsetRef.current));
    }, 500);
    const drift = setInterval(() => listening && alignAudio(), DRIFT_CHECK_MS);
    const resync = setInterval(async () => {
      const socket = socketRef.current;
      if (!socket?.connected) return;
      const sentAt = Date.now();
      try {
        const res = (await socket.timeout(5000).emitWithAck("sync")) as {
          startedAt: number | null;
          serverTime: number;
        };
        offsetRef.current = estimateClockOffset(sentAt, Date.now(), res.serverTime);
        setRoom((r) => (r && res.startedAt !== r.startedAt ? { ...r, startedAt: res.startedAt } : r));
      } catch {
        // bỏ qua, lần sau thử lại
      }
    }, RESYNC_MS);
    return () => {
      clearInterval(tick);
      clearInterval(drift);
      clearInterval(resync);
    };
  }, [listening, alignAudio]);

  const startListening = useCallback(() => {
    usePlayer.getState().pause(); // tạm dừng trình phát cá nhân
    setListening(true);
  }, []);

  const stopListening = useCallback(() => {
    audioRef.current?.pause();
    setListening(false);
  }, []);

  const setVolume = useCallback((volume: number) => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    const socket = socketRef.current;
    if (!socket) return;
    await socket.timeout(5000).emitWithAck("send_message", { text });
  }, []);

  const sendReaction = useCallback((type: ReactionType) => {
    socketRef.current?.emit("send_reaction", { type });
  }, []);

  return {
    room,
    messages,
    reactions,
    canChat,
    connected,
    error,
    listening,
    position,
    startListening,
    stopListening,
    setVolume,
    sendMessage,
    sendReaction,
  };
}
