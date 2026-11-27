"use client";

import { useEffect, useRef } from "react";
import { findActiveParagraph, paragraphProgress } from "@/lib/sync";
import { toTrack } from "@/lib/track";
import type { PostDetail } from "@/lib/types";
import { cn } from "@/lib/utils";
import { usePlayer } from "@/store/player";

const USER_SCROLL_GRACE_MS = 4000;

/**
 * Interactive Storytelling: bôi sáng đoạn MC đang đọc, làm mờ các đoạn xung quanh,
 * tự cuộn theo giọng đọc (tạm dừng khi người dùng tự cuộn), bấm vào đoạn để nghe từ đó.
 */
export function StoryReader({ post }: { post: PostDetail }) {
  const isCurrent = usePlayer((s) => s.queue[s.index]?.id === post.id);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const time = usePlayer((s) => (s.queue[s.index]?.id === post.id ? s.currentTime : -1));
  const active = isCurrent ? findActiveParagraph(post.timestamps, time) : -1;
  const focusMode = isCurrent && active >= 0;

  const refs = useRef<(HTMLParagraphElement | null)[]>([]);
  const lastUserScroll = useRef(0);

  useEffect(() => {
    const mark = () => (lastUserScroll.current = Date.now());
    window.addEventListener("wheel", mark, { passive: true });
    window.addEventListener("touchmove", mark, { passive: true });
    window.addEventListener("keydown", mark);
    return () => {
      window.removeEventListener("wheel", mark);
      window.removeEventListener("touchmove", mark);
      window.removeEventListener("keydown", mark);
    };
  }, []);

  useEffect(() => {
    if (!isPlaying || active < 0) return;
    if (Date.now() - lastUserScroll.current < USER_SCROLL_GRACE_MS) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    refs.current[active]?.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
  }, [active, isPlaying]);

  const listenFrom = (index: number) => {
    const stamp = post.timestamps.find((t) => t.index === index);
    const track = toTrack(post);
    if (!stamp || !track) return;
    const player = usePlayer.getState();
    if (!isCurrent) player.playTrack(track);
    player.seek(stamp.start);
    player.play();
  };

  const canSync = post.timestamps.length > 0 && Boolean(post.audioUrl);

  return (
    <div className="space-y-2">
      {post.paragraphs.map((text, i) => {
        const isActive = i === active;
        const stamp = post.timestamps.find((t) => t.index === i);
        return (
          <p
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            onClick={canSync ? () => listenFrom(i) : undefined}
            onKeyDown={(e) => canSync && (e.key === "Enter" || e.key === " ") && (e.preventDefault(), listenFrom(i))}
            tabIndex={canSync ? 0 : undefined}
            role={canSync ? "button" : undefined}
            aria-current={isActive ? "true" : undefined}
            aria-label={canSync ? `Nghe từ đoạn ${i + 1}` : undefined}
            className={cn(
              "relative -mx-4 rounded-2xl px-4 py-3 font-serif text-lg leading-[1.9] whitespace-pre-line transition-all duration-700 ease-calm sm:text-xl",
              canSync && "cursor-pointer",
              focusMode && !isActive && "opacity-40 blur-[0.3px] hover:opacity-70",
              isActive && "bg-highlight text-foreground shadow-[inset_3px_0_0] shadow-primary",
              !isActive && "text-foreground/90",
            )}
          >
            {text}
            {isActive && (
              <span
                aria-hidden
                className="absolute bottom-1.5 left-4 h-px bg-primary/60 transition-[width] duration-300 ease-linear"
                style={{ width: `calc((100% - 2rem) * ${paragraphProgress(stamp, time)})` }}
              />
            )}
          </p>
        );
      })}
    </div>
  );
}
