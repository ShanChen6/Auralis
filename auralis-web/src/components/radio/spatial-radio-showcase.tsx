"use client";

import { ChevronLeft, ChevronRight, Clock3, Mic2, Music2, PenLine } from "lucide-react";
import { AnimatePresence, motion, type PanInfo } from "motion/react";
import Link from "next/link";
import { useCallback, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { MOODS, categoryMoodLabel, formatDurationLabel, musicLabel, voiceLabel } from "@/lib/format";
import type { PostCard } from "@/lib/types";
import { cn } from "@/lib/utils";
import { usePlayer } from "@/store/player";
import { CoverArt } from "./cover-art";
import { Equalizer } from "./equalizer";
import { PlayPostButton } from "./play-post-button";

const SPRING = { type: "spring", stiffness: 180, damping: 26, mass: 0.9 } as const;

/** Khoảng cách vòng tròn từ thẻ i tới thẻ đang chọn: -2..2 với 5 thẻ */
function circularOffset(i: number, active: number, count: number) {
  let offset = i - active;
  const half = Math.floor(count / 2);
  if (offset > half) offset -= count;
  if (offset < -half) offset += count;
  return offset;
}

export function SpatialRadioShowcase({ posts }: { posts: PostCard[] }) {
  const [active, setActive] = useState(0);
  const count = posts.length;
  const go = useCallback((delta: number) => setActive((a) => (a + delta + count) % count), [count]);

  if (count === 0) {
    return (
      <div className="glass rounded-3xl p-10 text-center text-muted">
        Chưa có số Radio nổi bật nào. Hãy kiểm tra API (<code>pnpm dev:api</code>) và dữ liệu mẫu (
        <code>pnpm db:seed</code>).
      </div>
    );
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") go(1);
    if (e.key === "ArrowLeft") go(-1);
  };
  const onPanEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -50) go(1);
    else if (info.offset.x > 50) go(-1);
  };

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Số Radio nổi bật"
      className="grid items-center gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-12"
    >
      {/* Băng chuyền chiều sâu */}
      <div className="relative" onKeyDown={onKeyDown}>
        <motion.div
          className="relative h-[360px] touch-pan-y sm:h-[460px]"
          style={{ perspective: 1200 }}
          onPanEnd={onPanEnd}
        >
          {posts.map((post, i) => {
            const offset = circularOffset(i, active, count);
            const distance = Math.abs(offset);
            const isCenter = offset === 0;
            return (
              <motion.button
                key={post.id}
                type="button"
                aria-label={isCenter ? `${post.title} (đang chọn)` : `Chọn ${post.title}`}
                aria-current={isCenter}
                tabIndex={isCenter ? 0 : -1}
                onClick={() => (isCenter ? undefined : setActive(i))}
                className={cn(
                  "absolute top-1/2 left-1/2 aspect-[3/4] w-[58%] max-w-[300px] overflow-hidden rounded-[28px] text-left",
                  "outline-offset-4",
                  isCenter ? "cursor-default" : "cursor-pointer",
                )}
                initial={false}
                animate={{
                  x: `calc(-50% + ${offset * 58}%)`,
                  y: "-50%",
                  scale: 1 - distance * 0.13,
                  rotateY: offset * -16,
                  opacity: distance > 2 ? 0 : 1 - distance * 0.3,
                  filter: `blur(${distance * 3}px) brightness(${1 - distance * 0.18})`,
                  zIndex: 10 - distance,
                  boxShadow: isCenter
                    ? "0 30px 80px -20px rgb(245 158 11 / 0.45), 0 0 0 1px rgb(245 158 11 / 0.35)"
                    : "0 20px 50px -25px rgb(0 0 0 / 0.6), 0 0 0 1px rgb(248 250 252 / 0.06)",
                }}
                transition={SPRING}
              >
                <CoverArt slug={post.slug} mood={post.moodTag} coverUrl={post.coverUrl} title={post.title} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                  <span className="mb-2 inline-block rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] backdrop-blur">
                    {MOODS[post.moodTag]?.label}
                  </span>
                  <p className="font-serif text-xl leading-snug sm:text-2xl">{post.title}</p>
                  <p className="mt-1 text-xs text-white/70">{formatDurationLabel(post.duration)}</p>
                </div>
              </motion.button>
            );
          })}
        </motion.div>

        <div className="mt-2 flex items-center justify-center gap-4">
          <Button variant="glass" size="icon-sm" onClick={() => go(-1)} aria-label="Số trước">
            <ChevronLeft className="size-4" />
          </Button>
          <div className="flex gap-2" role="tablist" aria-label="Chọn số Radio">
            {posts.map((post, i) => (
              <button
                key={post.id}
                role="tab"
                aria-selected={i === active}
                aria-label={post.title}
                onClick={() => setActive(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-500 ease-calm",
                  i === active ? "w-6 bg-primary" : "w-1.5 bg-foreground/20 hover:bg-foreground/40",
                )}
              />
            ))}
          </div>
          <Button variant="glass" size="icon-sm" onClick={() => go(1)} aria-label="Số tiếp theo">
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* Bảng kính mờ "Trong số Radio này" */}
      <InThisEpisode post={posts[active]} queue={posts} />
    </section>
  );
}

function InThisEpisode({ post, queue }: { post: PostCard; queue: PostCard[] }) {
  const isCurrent = usePlayer((s) => s.queue[s.index]?.id === post.id);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const isAi = post.voiceName?.endsWith("Neural") ?? false;
  const startIndex = queue.findIndex((p) => p.id === post.id);
  const orderedQueue = [...queue.slice(startIndex), ...queue.slice(0, startIndex)];

  const rows = [
    { icon: PenLine, label: "Tác giả", value: post.author.displayName },
    {
      icon: Mic2,
      label: "Giọng đọc",
      value: post.narrator ? `CTV · ${post.narrator.displayName}` : voiceLabel(post.voiceName, isAi),
    },
    { icon: Music2, label: "Nhạc nền", value: musicLabel(post.backgroundMusic) },
    { icon: Clock3, label: "Thời lượng", value: formatDurationLabel(post.duration) },
  ];

  return (
    <aside className="glass relative overflow-hidden rounded-[32px] p-6 sm:p-8" aria-live="polite">
      <div className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full bg-primary/10 blur-3xl" />
      <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-primary">
        {isCurrent && <Equalizer playing={isPlaying} />}
        Trong số Radio này
      </p>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={post.id}
          initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -8, filter: "blur(6px)" }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="mt-5 text-xs text-muted">
            {categoryMoodLabel(post.category?.name, post.moodTag)}
          </p>
          <h2 className="mt-1 font-serif text-3xl leading-tight text-foreground sm:text-4xl">{post.title}</h2>

          <dl className="mt-6 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            {rows.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-start gap-3">
                <Icon className="mt-0.5 size-4 shrink-0 text-secondary" />
                <div className="min-w-0">
                  <dt className="text-xs text-muted">{label}</dt>
                  <dd className="truncate text-foreground">{value}</dd>
                </div>
              </div>
            ))}
          </dl>

          {post.summary && (
            <blockquote className="mt-6 border-l-2 border-primary/60 pl-4 font-serif text-base leading-relaxed text-foreground/80 italic">
              “{post.summary}”
            </blockquote>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            <PlayPostButton post={post} queue={orderedQueue} label="Phát trọn số này" size="lg" />
            <Button asChild variant="outline" size="lg">
              <Link href={`/radio/${post.slug}`}>Đọc &amp; nghe</Link>
            </Button>
          </div>
        </motion.div>
      </AnimatePresence>
    </aside>
  );
}
