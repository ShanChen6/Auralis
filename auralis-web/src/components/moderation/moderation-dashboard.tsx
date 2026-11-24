"use client";

import { Check, ChevronDown, Loader2, Star, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, Select, Textarea } from "@/components/ui/input";
import { api } from "@/lib/client-api";
import { MOODS, type MoodTag, formatDate, formatTime, musicLabel, voiceLabel } from "@/lib/format";
import { POST_STATUS, type PostStatus, splitParagraphs } from "@/lib/studio";
import { cn } from "@/lib/utils";

interface ReviewPost {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  moodTag: MoodTag;
  status: PostStatus;
  audioSource: string;
  audioStatus: string;
  audioUrl: string | null;
  duration: number | null;
  voiceName: string | null;
  backgroundMusic: string | null;
  isFeatured: boolean;
  rejectReason: string | null;
  createdAt: string;
  author: { username: string; displayName: string };
  narrator: { displayName: string } | null;
  category: { name: string } | null;
  content: { content: string; wordCount: number } | null;
}

interface ReviewNarration {
  id: string;
  audioUrl: string | null;
  duration: number | null;
  note: string | null;
  updatedAt: string;
  narrator: { username: string; displayName: string };
  post: { slug: string; title: string; content: { content: string } | null };
}

type Tab = "PENDING" | "NARRATIONS" | "REJECTED" | "PUBLISHED";

export function ModerationDashboard() {
  const [tab, setTab] = useState<Tab>("PENDING");
  const [stats, setStats] = useState({ pendingPosts: 0, submittedNarrations: 0 });
  const [posts, setPosts] = useState<ReviewPost[] | null>(null);
  const [narrations, setNarrations] = useState<ReviewNarration[] | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const load = useCallback(
    () =>
      Promise.all([
        api<typeof stats>("/admin/stats"),
        tab === "NARRATIONS"
          ? api<ReviewNarration[]>("/admin/narrations?status=SUBMITTED")
          : api<ReviewPost[]>(`/admin/posts?status=${tab}`),
      ]).then(
        ([nextStats, items]) => {
          setStats(nextStats);
          if (tab === "NARRATIONS") setNarrations(items as ReviewNarration[]);
          else setPosts(items as ReviewPost[]);
        },
        (err: Error) => setMessage({ tone: "error", text: err.message }),
      ),
    [tab],
  );

  useEffect(() => {
    load();
  }, [load]);

  function selectTab(next: Tab) {
    if (next === tab) return;
    setPosts(null);
    setNarrations(null);
    setMessage(null);
    setTab(next);
  }

  async function act(path: string, body: unknown, success: string) {
    try {
      await api(path, { method: "PATCH", json: body });
      await load();
      setMessage({ tone: "success", text: success });
    } catch (err) {
      setMessage({ tone: "error", text: (err as Error).message });
    }
  }

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "PENDING", label: "Bài chờ duyệt", count: stats.pendingPosts },
    { id: "NARRATIONS", label: "Lồng tiếng chờ duyệt", count: stats.submittedNarrations },
    { id: "REJECTED", label: "Đã từ chối" },
    { id: "PUBLISHED", label: "Đã xuất bản" },
  ];

  const list = tab === "NARRATIONS" ? narrations : posts;

  return (
    <div>
      <div role="tablist" aria-label="Danh sách kiểm duyệt" className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => selectTab(t.id)}
            className={cn(
              "flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors",
              tab === t.id ? "border-primary/60 bg-highlight text-primary" : "border-border text-muted hover:text-foreground",
            )}
          >
            {t.label}
            {t.count ? <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">{t.count}</span> : null}
          </button>
        ))}
      </div>

      {message && (
        <div className="mt-6">
          <Alert tone={message.tone}>{message.text}</Alert>
        </div>
      )}

      <div className="mt-6 space-y-4">
        {list === null ? (
          <div className="flex justify-center py-16 text-muted">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : list.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-border p-10 text-center text-muted">Không có mục nào ở đây.</p>
        ) : tab === "NARRATIONS" ? (
          narrations!.map((n) => (
            <NarrationReview
              key={n.id}
              narration={n}
              onApprove={() => act(`/admin/narrations/${n.id}/approve`, {}, `Đã chọn giọng ${n.narrator.displayName} cho "${n.post.title}"`)}
              onReject={(reason) => act(`/admin/narrations/${n.id}/reject`, { reason }, "Đã từ chối bản lồng tiếng")}
            />
          ))
        ) : (
          posts!.map((p) => (
            <PostReview
              key={p.id}
              post={p}
              onApprove={(input) => act(`/admin/posts/${p.id}/approve`, input, `Đã xuất bản "${p.title}"`)}
              onReject={(reason) => act(`/admin/posts/${p.id}/reject`, { reason }, `Đã từ chối "${p.title}"`)}
              onUpdate={(input) => act(`/admin/posts/${p.id}`, input, "Đã cập nhật")}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ContentPreview({ content }: { content: string }) {
  const [open, setOpen] = useState(false);
  const paragraphs = splitParagraphs(content);
  return (
    <div className="mt-4">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 text-sm text-primary" aria-expanded={open}>
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
        {open ? "Thu gọn nội dung" : `Đọc toàn bộ (${paragraphs.length} đoạn)`}
      </button>
      <div className={cn("mt-3 space-y-3 font-serif leading-relaxed text-foreground/90", !open && "line-clamp-3")}>
        {(open ? paragraphs : paragraphs.slice(0, 1)).map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </div>
  );
}

function RejectForm({ onReject }: { onReject: (reason: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <X className="size-3.5" />
        Từ chối
      </Button>
    );
  }
  return (
    <div className="w-full space-y-2">
      <Textarea
        autoFocus
        rows={2}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Lý do từ chối (tác giả sẽ thấy lời nhắn này)"
        aria-label="Lý do từ chối"
      />
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={reason.trim().length < 5} onClick={() => void onReject(reason.trim())}>
          Xác nhận từ chối
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Hủy
        </Button>
      </div>
    </div>
  );
}

function PostReview({
  post,
  onApprove,
  onReject,
  onUpdate,
}: {
  post: ReviewPost;
  onApprove: (input: { moodTag: MoodTag; isFeatured: boolean }) => Promise<void>;
  onReject: (reason: string) => Promise<void>;
  onUpdate: (input: { moodTag?: MoodTag; isFeatured?: boolean }) => Promise<void>;
}) {
  const [mood, setMood] = useState<MoodTag>(post.moodTag);
  const [featured, setFeatured] = useState(post.isFeatured);
  const status = POST_STATUS[post.status];
  const pending = post.status === "PENDING";

  return (
    <article className="glass rounded-3xl p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <Badge tone={status.tone}>{status.label}</Badge>
        {post.category && <span>{post.category.name}</span>}
        <span>· {post.author.displayName}</span>
        <span>· {formatDate(post.createdAt)}</span>
        <span>· {post.content?.wordCount ?? 0} từ</span>
      </div>
      <h3 className="mt-2 font-serif text-2xl text-foreground">{post.title}</h3>
      {post.summary && <p className="mt-1 text-sm text-muted italic">{post.summary}</p>}

      <div className="mt-4 rounded-2xl border border-border bg-surface/50 p-3">
        {post.audioUrl ? (
          <>
            <p className="mb-2 text-xs text-muted">
              {post.narrator
                ? `Giọng: ${post.narrator.displayName}`
                : post.voiceName
                  ? voiceLabel(post.voiceName, post.audioSource !== "UPLOAD")
                  : "Tự thu âm"}{" "}
              ·{" "}
              {musicLabel(post.backgroundMusic)} · {formatTime(post.duration)}
            </p>
            <audio src={post.audioUrl} controls preload="none" className="w-full" />
          </>
        ) : (
          <p className="text-sm text-muted">
            {post.audioStatus === "PROCESSING"
              ? "Radio AI đang được tạo…"
              : post.audioStatus === "FAILED"
                ? "Tạo Radio AI lỗi – tác giả có thể tạo lại."
                : "Bài chỉ có chữ – sau khi xuất bản sẽ mở cho cộng đồng lồng tiếng."}
          </p>
        )}
      </div>

      {post.content && <ContentPreview content={post.content.content} />}
      {post.rejectReason && <p className="mt-3 text-sm text-red-300">Lý do từ chối: {post.rejectReason}</p>}

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <label className="flex items-center gap-2 text-sm text-muted">
          Tâm trạng
          <Select
            value={mood}
            onChange={(e) => {
              const value = e.target.value as MoodTag;
              setMood(value);
              if (!pending) void onUpdate({ moodTag: value });
            }}
            className="h-9 w-40 rounded-full text-sm"
            aria-label="Thẻ tâm trạng"
          >
            {(Object.keys(MOODS) as MoodTag[]).map((m) => (
              <option key={m} value={m}>
                {MOODS[m].label}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={featured}
            onChange={(e) => {
              setFeatured(e.target.checked);
              if (!pending) void onUpdate({ isFeatured: e.target.checked });
            }}
            className="size-4 accent-[var(--primary)]"
          />
          <Star className="size-3.5" />
          Nổi bật trên trang chủ
        </label>
        {pending && (
          <div className="ml-auto flex flex-wrap gap-2">
            <RejectForm onReject={onReject} />
            <Button size="sm" disabled={post.audioStatus === "PROCESSING"} onClick={() => void onApprove({ moodTag: mood, isFeatured: featured })}>
              <Check className="size-3.5" />
              Duyệt & xuất bản
            </Button>
          </div>
        )}
      </div>
    </article>
  );
}

function NarrationReview({
  narration,
  onApprove,
  onReject,
}: {
  narration: ReviewNarration;
  onApprove: () => Promise<void>;
  onReject: (reason: string) => Promise<void>;
}) {
  return (
    <article className="glass rounded-3xl p-5 sm:p-6">
      <p className="text-xs text-muted">
        Bản lồng tiếng của <span className="text-foreground">{narration.narrator.displayName}</span> ·{" "}
        {formatDate(narration.updatedAt)}
      </p>
      <h3 className="mt-2 font-serif text-2xl text-foreground">{narration.post.title}</h3>
      {narration.note && <p className="mt-1 text-sm text-muted italic">“{narration.note}”</p>}
      {narration.audioUrl && (
        <div className="mt-4 rounded-2xl border border-border bg-surface/50 p-3">
          <p className="mb-2 text-xs text-muted">{formatTime(narration.duration)}</p>
          <audio src={narration.audioUrl} controls preload="none" className="w-full" />
        </div>
      )}
      {narration.post.content && <ContentPreview content={narration.post.content.content} />}
      <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-border pt-4">
        <RejectForm onReject={onReject} />
        <Button size="sm" onClick={() => void onApprove()}>
          <Check className="size-3.5" />
          Chọn giọng đọc này
        </Button>
      </div>
    </article>
  );
}
