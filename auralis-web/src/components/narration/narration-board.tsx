"use client";

import { ChevronDown, Loader2, Mic, Send, Users } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AudioUpload, type UploadedAudio } from "@/components/studio/audio-upload";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, Input } from "@/components/ui/input";
import { api } from "@/lib/client-api";
import { MOODS, type MoodTag } from "@/lib/format";
import { NARRATION_STATUS, type NarrationStatus, estimateMinutes, splitParagraphs } from "@/lib/studio";
import { cn } from "@/lib/utils";
import { useSession } from "@/store/session";

interface OpenPost {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  moodTag: MoodTag;
  wordCount: number;
  author: { displayName: string };
  claimCount: number;
  myClaim: { id: string; status: NarrationStatus } | null;
}

interface MyNarration {
  id: string;
  status: NarrationStatus;
  rejectReason: string | null;
  post: { id: string; content: { content: string } | null };
}

/** Ghép cặp cộng đồng: bài chỉ có chữ chờ những giọng đọc hay */
export function NarrationBoard() {
  const user = useSession((s) => s.user);
  const status = useSession((s) => s.status);
  const load = useSession((s) => s.load);
  const [posts, setPosts] = useState<OpenPost[] | null>(null);
  const [mine, setMine] = useState<MyNarration[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    () =>
      Promise.all([
        api<OpenPost[]>("/narrations/open"),
        useSession.getState().user ? api<MyNarration[]>("/narrations/mine") : Promise.resolve([]),
      ]).then(
        ([open, my]) => {
          setPosts(open);
          setMine(my);
        },
        (err: Error) => setError(err.message),
      ),
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (status === "ready") refresh();
  }, [status, user, refresh]);

  if (posts === null) {
    return (
      <div className="flex justify-center py-16 text-muted">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <Alert>{error}</Alert>}
      {posts.length === 0 && (
        <p className="rounded-3xl border border-dashed border-border p-10 text-center text-muted">
          Hiện chưa có bài nào cần giọng đọc. Cảm ơn bạn đã ghé!
        </p>
      )}
      {posts.map((post) => (
        <OpenPostCard
          key={post.id}
          post={post}
          loggedIn={Boolean(user)}
          claim={mine.find((n) => n.post.id === post.id) ?? null}
          onChange={refresh}
        />
      ))}
    </div>
  );
}

function OpenPostCard({
  post,
  loggedIn,
  claim,
  onChange,
}: {
  post: OpenPost;
  loggedIn: boolean;
  claim: MyNarration | null;
  onChange: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [upload, setUpload] = useState<UploadedAudio | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const content = claim?.post.content?.content;
  const status = claim?.status ?? post.myClaim?.status;

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await onChange();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const canRecord = claim && (claim.status === "CLAIMED" || claim.status === "REJECTED");

  return (
    <article className="glass rounded-3xl p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <Badge tone="lavender">{MOODS[post.moodTag]?.label}</Badge>
        <span>{post.author.displayName}</span>
        <span>· {post.wordCount} từ · ~{estimateMinutes(post.wordCount)} phút đọc</span>
        <span className="flex items-center gap-1">
          · <Users className="size-3" /> {post.claimCount} người đang thu
        </span>
        {status && <Badge tone={NARRATION_STATUS[status].tone}>{NARRATION_STATUS[status].label}</Badge>}
      </div>
      <h3 className="mt-2 font-serif text-2xl text-foreground">{post.title}</h3>
      {post.summary && <p className="mt-1 text-sm text-muted italic">{post.summary}</p>}

      {content && (
        <div className="mt-4">
          <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 text-sm text-primary" aria-expanded={open}>
            <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
            {open ? "Thu gọn kịch bản" : "Xem kịch bản để thu âm"}
          </button>
          {open && (
            <div className="mt-3 space-y-3 rounded-2xl bg-surface/50 p-4 font-serif leading-relaxed text-foreground/90">
              {splitParagraphs(content).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {claim?.status === "REJECTED" && claim.rejectReason && (
        <p className="mt-3 text-sm text-red-300">Phản hồi: {claim.rejectReason}</p>
      )}

      {canRecord && (
        <div className="mt-5 space-y-3">
          <AudioUpload value={upload} onChange={setUpload} />
          <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Lời nhắn cho biên tập viên (không bắt buộc)" aria-label="Lời nhắn" />
        </div>
      )}

      {error && (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        {!loggedIn ? (
          <Button asChild variant="outline">
            <Link href="/dang-nhap?next=/long-tieng">Đăng nhập</Link>
          </Button>
        ) : !status || status === "WITHDRAWN" ? (
          <Button disabled={busy} onClick={() => void run(() => api("/narrations", { method: "POST", json: { postId: post.id } }))}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Mic className="size-4" />}
            Nhận lồng tiếng
          </Button>
        ) : canRecord ? (
          <>
            <Button
              disabled={busy || !upload}
              onClick={() =>
                void run(() =>
                  api(`/narrations/${claim!.id}/submit`, {
                    method: "POST",
                    json: { audioUrl: upload!.publicUrl, duration: upload!.duration, note: note || undefined },
                  }),
                )
              }
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Nộp bản thu
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => void run(() => api(`/narrations/${claim!.id}/withdraw`, { method: "POST" }))}>
              Rút lui
            </Button>
          </>
        ) : status === "SUBMITTED" ? (
          <p className="text-sm text-muted">Bản thu của bạn đang chờ biên tập viên nghe. Cảm ơn bạn!</p>
        ) : null}
      </div>
    </article>
  );
}
