"use client";

import { Coffee, Headphones, Heart, Loader2, Send, SkipForward, Star, Users, VolumeX } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { CoverArt } from "@/components/radio/cover-art";
import { Button } from "@/components/ui/button";
import { Alert, Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { formatTime } from "@/lib/format";
import type { ReactionType } from "@/lib/live";
import { cn } from "@/lib/utils";
import { useSession } from "@/store/session";
import { type FloatingReaction, useLiveRoom } from "./use-live-room";

const REACTIONS: { type: ReactionType; label: string; icon: typeof Heart; color: string }[] = [
  { type: "heart", label: "Thả tim", icon: Heart, color: "text-rose-400" },
  { type: "tea", label: "Mời tách trà ấm", icon: Coffee, color: "text-amber-400" },
  { type: "star", label: "Tặng ngôi sao", icon: Star, color: "text-yellow-300" },
];

export function LiveRoom({ slug }: { slug: string }) {
  const user = useSession((s) => s.user);
  const status = useSession((s) => s.status);
  const load = useSession((s) => s.load);
  useEffect(() => {
    void load();
  }, [load]);

  if (status !== "ready") {
    return (
      <div className="flex justify-center py-32 text-muted">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }
  return <Room slug={slug} loggedIn={Boolean(user)} />;
}

function Room({ slug, loggedIn }: { slug: string; loggedIn: boolean }) {
  const live = useLiveRoom(slug, loggedIn);
  const { room, listening, position } = live;
  const [volume, setVolume] = useState(0.9);

  if (!room) {
    return (
      <div className="flex flex-col items-center gap-3 py-32 text-muted">
        <Loader2 className="size-6 animate-spin" />
        {live.error ?? "Đang kết nối phòng nghe…"}
      </div>
    );
  }

  const track = room.track;
  const progress = track ? Math.min(1, position / track.duration) : 0;
  const inGap = track ? position >= track.duration : false;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section className="glass relative overflow-hidden rounded-[32px] p-6 sm:p-8">
        <ReactionLayer reactions={live.reactions} />

        <div className="flex flex-wrap items-center gap-3 text-xs">
          {room.status === "LIVE" ? (
            <span className="flex items-center gap-2 rounded-full bg-rose-500/15 px-3 py-1 font-medium tracking-widest text-rose-300 uppercase">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-rose-400" />
              </span>
              Trực tiếp
            </span>
          ) : (
            <span className="rounded-full bg-secondary/15 px-3 py-1 text-secondary">Sắp lên sóng</span>
          )}
          <span className="flex items-center gap-1.5 text-muted">
            <Users className="size-3.5" />
            {room.listeners} người đang nghe
          </span>
          {!live.connected && <span className="text-amber-300">Mất kết nối, đang nối lại…</span>}
        </div>

        <h1 className="mt-4 font-serif text-3xl text-foreground sm:text-4xl">{room.name}</h1>
        {room.description && <p className="mt-2 text-muted">{room.description}</p>}

        {track ? (
          <div className="mt-8 grid items-center gap-6 sm:grid-cols-[200px_1fr]">
            <motion.div
              key={track.postId}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className={cn(
                "aspect-square w-40 overflow-hidden rounded-[28px] sm:w-full",
                listening && !inGap && "shadow-glow",
              )}
            >
              <CoverArt slug={track.slug} mood={track.moodTag} coverUrl={track.coverUrl} title={track.title} />
            </motion.div>
            <div className="min-w-0">
              <p className="text-xs tracking-[0.2em] text-primary uppercase">Đang phát</p>
              <Link href={`/radio/${track.slug}`} className="mt-1 block font-serif text-2xl text-foreground hover:text-primary">
                {track.title}
              </Link>
              <p className="text-sm text-muted">{track.artist}</p>

              <div className="mt-5" aria-label="Tiến độ phát chung">
                <div className="h-1 overflow-hidden rounded-full bg-foreground/10">
                  <div className="h-full rounded-full bg-primary transition-[width] duration-500 ease-linear" style={{ width: `${progress * 100}%` }} />
                </div>
                <div className="mt-1.5 flex justify-between text-[11px] text-muted tabular-nums">
                  <span>{formatTime(Math.min(position, track.duration))}</span>
                  <span>{formatTime(track.duration)}</span>
                </div>
              </div>
              {room.nextTrack && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
                  <SkipForward className="size-3.5" />
                  Tiếp theo: {room.nextTrack.title}
                </p>
              )}

              <div className="mt-6 flex flex-wrap items-center gap-3">
                {listening ? (
                  <>
                    <Button variant="outline" onClick={live.stopListening}>
                      <VolumeX className="size-4" />
                      Tắt tiếng phòng
                    </Button>
                    <Slider
                      aria-label="Âm lượng phòng"
                      className="w-32"
                      min={0}
                      max={1}
                      step={0.01}
                      value={[volume]}
                      onValueChange={([v]) => {
                        setVolume(v);
                        live.setVolume(v);
                      }}
                    />
                  </>
                ) : (
                  <Button size="lg" onClick={live.startListening}>
                    <Headphones className="size-4" />
                    Vào nghe cùng mọi người
                  </Button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-8 rounded-2xl border border-dashed border-border p-8 text-center text-muted">
            {room.status === "SCHEDULED" && room.scheduledAt
              ? `Phòng sẽ lên sóng lúc ${new Intl.DateTimeFormat("vi-VN", { dateStyle: "full", timeStyle: "short" }).format(new Date(room.scheduledAt))}.`
              : "Phòng chưa có số Radio nào để phát."}
          </p>
        )}

        <div className="mt-8 flex items-center gap-2 border-t border-border pt-5">
          <span className="mr-1 text-xs text-muted">Gửi cảm xúc</span>
          {REACTIONS.map(({ type, label, icon: Icon, color }) => (
            <motion.button
              key={type}
              whileTap={{ scale: 0.85 }}
              onClick={() => live.sendReaction(type)}
              aria-label={label}
              className="flex size-11 items-center justify-center rounded-2xl border border-border transition-colors hover:bg-foreground/5"
            >
              <Icon className={cn("size-5", color)} />
            </motion.button>
          ))}
        </div>
      </section>

      <ChatPanel
        messages={live.messages}
        canChat={live.canChat}
        loggedIn={loggedIn}
        slug={slug}
        error={live.error}
        onSend={live.sendMessage}
      />
    </div>
  );
}

/** Biểu tượng cảm xúc bay nhẹ lên rồi tan dần */
function ReactionLayer({ reactions }: { reactions: FloatingReaction[] }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <AnimatePresence>
        {reactions.map((r) => {
          const { icon: Icon, color } = REACTIONS.find((x) => x.type === r.type) ?? REACTIONS[0];
          const seed = parseInt(r.id.slice(0, 6), 16) || 0;
          const left = 55 + (seed % 40);
          const drift = ((seed >> 4) % 60) - 30;
          return (
            <motion.span
              key={r.id}
              className={cn("absolute bottom-16", color)}
              style={{ left: `${left}%` }}
              initial={{ y: 0, x: 0, opacity: 0, scale: 0.6 }}
              animate={{ y: -320, x: drift, opacity: [0, 1, 1, 0], scale: [0.6, 1.2, 1, 0.9] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 3, ease: "easeOut" }}
            >
              <Icon className="size-7 fill-current drop-shadow-[0_0_12px_currentColor]" />
            </motion.span>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

function ChatPanel({
  messages,
  canChat,
  loggedIn,
  slug,
  error,
  onSend,
}: {
  messages: { id: string; text: string; at: number; user: { displayName: string } }[];
  canChat: boolean;
  loggedIn: boolean;
  slug: string;
  error: string | null;
  onSend: (text: string) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    setSendError(null);
    try {
      await onSend(text.trim());
      setText("");
    } catch {
      setSendError("Chưa gửi được, bạn thử lại sau giây lát nhé");
    } finally {
      setSending(false);
    }
  }

  return (
    <aside className="glass flex h-[520px] flex-col rounded-[32px] p-5 lg:h-auto lg:max-h-[640px]" aria-label="Trò chuyện trong phòng">
      <h2 className="text-xs font-medium tracking-[0.2em] text-secondary uppercase">Trò chuyện</h2>
      <ol ref={listRef} className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1" aria-live="polite">
        {messages.length === 0 && <li className="text-sm text-muted">Chưa có ai lên tiếng. Gửi lời chào đầu tiên nhé!</li>}
        {messages.map((m) => (
          <li key={m.id} className="text-sm leading-relaxed">
            <span className="font-medium text-primary">{m.user.displayName}</span>{" "}
            <span className="text-foreground/90">{m.text}</span>
          </li>
        ))}
      </ol>
      {(sendError || error) && (
        <div className="mt-3">
          <Alert>{sendError ?? error}</Alert>
        </div>
      )}
      {canChat ? (
        <form onSubmit={submit} className="mt-4 flex gap-2">
          <Input value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder="Nhắn gì đó thật dịu dàng…" aria-label="Tin nhắn" />
          <Button type="submit" size="icon" disabled={sending || !text.trim()} aria-label="Gửi">
            <Send className="size-4" />
          </Button>
        </form>
      ) : (
        <p className="mt-4 text-sm text-muted">
          {loggedIn ? (
            "Đang kết nối trò chuyện…"
          ) : (
            <>
              <Link href={`/dang-nhap?next=/phong-nghe/${slug}`} className="text-primary hover:underline">
                Đăng nhập
              </Link>{" "}
              để trò chuyện cùng mọi người.
            </>
          )}
        </p>
      )}
    </aside>
  );
}
