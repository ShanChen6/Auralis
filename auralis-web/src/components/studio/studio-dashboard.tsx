"use client";

import { AlertTriangle, ExternalLink, Loader2, PenLine, RotateCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CoverArt } from "@/components/radio/cover-art";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/input";
import { api } from "@/lib/client-api";
import { MOODS, formatDate, formatTime } from "@/lib/format";
import { NARRATION_STATUS, type NarrationStatus, POST_STATUS, type StudioPost } from "@/lib/studio";

interface MyNarration {
  id: string;
  status: NarrationStatus;
  rejectReason: string | null;
  updatedAt: string;
  post: { slug: string; title: string };
}

export function StudioDashboard({ justSubmitted }: { justSubmitted: boolean }) {
  const [posts, setPosts] = useState<StudioPost[] | null>(null);
  const [narrations, setNarrations] = useState<MyNarration[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    () =>
      Promise.all([api<StudioPost[]>("/studio/posts"), api<MyNarration[]>("/narrations/mine")]).then(
        ([p, n]) => {
          setPosts(p);
          setNarrations(n);
        },
        (err: Error) => setError(err.message),
      ),
    [],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Theo dõi bài đang tạo Radio AI để cập nhật trạng thái
  const processing = posts?.some((p) => p.audioStatus === "PROCESSING");
  useEffect(() => {
    if (!processing) return;
    const id = setInterval(refresh, 4000);
    return () => clearInterval(id);
  }, [processing, refresh]);

  async function retry(id: string) {
    try {
      await api(`/studio/posts/${id}/retry-audio`, { method: "POST" });
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="space-y-10">
      {justSubmitted && (
        <Alert tone="success">Đã gửi bài! Biên tập viên sẽ xem và phản hồi sớm. Trạng thái được cập nhật ngay tại đây.</Alert>
      )}
      {error && <Alert>{error}</Alert>}

      <section>
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-serif text-2xl text-foreground">Bài viết của tôi</h2>
          <Button asChild>
            <Link href="/studio/viet-bai">
              <PenLine className="size-4" />
              Viết bài mới
            </Link>
          </Button>
        </div>

        {posts === null ? (
          <div className="flex justify-center py-16 text-muted">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : posts.length === 0 ? (
          <p className="mt-6 rounded-3xl border border-dashed border-border p-10 text-center text-muted">
            Bạn chưa có bài viết nào. Hãy bắt đầu câu chuyện đầu tiên nhé.
          </p>
        ) : (
          <ul className="mt-6 space-y-3">
            {posts.map((post) => {
              const status = POST_STATUS[post.status];
              return (
                <li key={post.id} className="glass flex flex-col gap-4 rounded-3xl p-4 sm:flex-row sm:items-center">
                  <div className="size-16 shrink-0 overflow-hidden rounded-2xl">
                    <CoverArt slug={post.slug} mood={post.moodTag} title={post.title} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={status.tone}>{status.label}</Badge>
                      <AudioBadge post={post} />
                      <span className="text-xs text-muted">
                        {MOODS[post.moodTag]?.label} · {formatDate(post.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1.5 truncate font-serif text-lg text-foreground">{post.title}</p>
                    {post.status === "REJECTED" && post.rejectReason && (
                      <p className="mt-1 text-sm text-red-300">Lý do: {post.rejectReason}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {post.audioStatus === "FAILED" && (
                      <Button size="sm" variant="outline" onClick={() => void retry(post.id)}>
                        <RotateCw className="size-3.5" />
                        Tạo lại Radio
                      </Button>
                    )}
                    {post.status === "PUBLISHED" && (
                      <Button asChild size="sm" variant="glass">
                        <Link href={`/radio/${post.slug}`}>
                          Xem bài
                          <ExternalLink className="size-3.5" />
                        </Link>
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {narrations.length > 0 && (
        <section>
          <h2 className="font-serif text-2xl text-foreground">Lồng tiếng của tôi</h2>
          <ul className="mt-4 space-y-2">
            {narrations.map((n) => (
              <li key={n.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border px-4 py-3">
                <Badge tone={NARRATION_STATUS[n.status].tone}>{NARRATION_STATUS[n.status].label}</Badge>
                <span className="text-foreground">{n.post.title}</span>
                {n.rejectReason && <span className="text-xs text-muted">— {n.rejectReason}</span>}
              </li>
            ))}
          </ul>
          <Link href="/long-tieng" className="mt-3 inline-block text-sm text-primary hover:underline">
            Tới trang lồng tiếng cộng đồng →
          </Link>
        </section>
      )}
    </div>
  );
}

function AudioBadge({ post }: { post: StudioPost }) {
  switch (post.audioStatus) {
    case "PROCESSING":
      return (
        <Badge tone="lavender">
          <Loader2 className="size-3 animate-spin" />
          Đang tạo Radio…
        </Badge>
      );
    case "READY":
      return <Badge tone="lavender">Radio {formatTime(post.duration)}</Badge>;
    case "FAILED":
      return (
        <Badge tone="red">
          <AlertTriangle className="size-3" />
          Tạo Radio lỗi
        </Badge>
      );
    default:
      return <Badge>{post.narrator ? `Giọng: ${post.narrator.displayName}` : "Chờ lồng tiếng"}</Badge>;
  }
}
