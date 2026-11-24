import Link from "next/link";
import { MOODS, formatDurationLabel } from "@/lib/format";
import type { PostCard } from "@/lib/types";
import { CoverArt } from "./cover-art";
import { PlayPostButton } from "./play-post-button";

export function PostTile({ post, queue }: { post: PostCard; queue: PostCard[] }) {
  return (
    <article className="group glass flex gap-4 rounded-3xl p-3 transition-colors duration-500 hover:border-primary/30">
      <Link href={`/radio/${post.slug}`} className="size-24 shrink-0 overflow-hidden rounded-2xl sm:size-28">
        <CoverArt
          slug={post.slug}
          mood={post.moodTag}
          coverUrl={post.coverUrl}
          title={post.title}
          className="transition-transform duration-700 ease-calm group-hover:scale-105"
        />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col py-1">
        <p className="text-xs text-muted">
          {MOODS[post.moodTag]?.label} · {formatDurationLabel(post.duration)}
        </p>
        <Link href={`/radio/${post.slug}`} className="mt-1 font-serif text-lg leading-snug text-foreground hover:text-primary">
          {post.title}
        </Link>
        <p className="mt-1 line-clamp-2 text-sm text-muted">{post.summary}</p>
      </div>
      <PlayPostButton post={post} queue={queue} variant="glass" size="icon" className="self-center" />
    </article>
  );
}
