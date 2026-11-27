import { Headphones } from "lucide-react";
import Link from "next/link";
import { MOODS, formatDurationLabel } from "@/lib/format";
import type { RankedPost } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CoverArt } from "./cover-art";
import { PlayPostButton } from "./play-post-button";

/** "Nghe nhiều trong tuần" – bảng xếp hạng theo lượt nghe tuần này */
export function TopOfWeek({ posts }: { posts: RankedPost[] }) {
  if (posts.length === 0) return null;
  return (
    <ol className="glass divide-y divide-border rounded-[28px] p-2">
      {posts.map((post, i) => (
        <li key={post.id} className="flex items-center gap-4 rounded-2xl px-3 py-3">
          <span className={cn("w-6 text-center font-serif text-2xl tabular-nums", i === 0 ? "text-primary" : "text-muted")}>
            {i + 1}
          </span>
          <div className="size-12 shrink-0 overflow-hidden rounded-xl">
            <CoverArt slug={post.slug} mood={post.moodTag} coverUrl={post.coverUrl} title={post.title} />
          </div>
          <div className="min-w-0 flex-1">
            <Link href={`/radio/${post.slug}`} className="block truncate font-serif text-foreground hover:text-primary">
              {post.title}
            </Link>
            <p className="flex items-center gap-1.5 text-xs text-muted">
              {MOODS[post.moodTag]?.label} · {formatDurationLabel(post.duration)}
              {post.weeklyListens > 0 && (
                <>
                  {" · "}
                  <Headphones className="size-3" />
                  {post.weeklyListens} lượt tuần này
                </>
              )}
            </p>
          </div>
          <PlayPostButton post={post} queue={posts} variant="ghost" size="icon-sm" />
        </li>
      ))}
    </ol>
  );
}
