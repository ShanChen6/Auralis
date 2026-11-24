"use client";

import { Loader2, Send, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Alert, Field, Input, Select, Textarea } from "@/components/ui/input";
import { api } from "@/lib/client-api";
import { MOODS, type MoodTag } from "@/lib/format";
import { countWords, estimateMinutes, splitParagraphs } from "@/lib/studio";
import { cn } from "@/lib/utils";
import { AudioChoice, type AudioChoiceValue, DEFAULT_AUDIO_CHOICE, audioPayload } from "./audio-choice";

const MAX_WORDS = 3000;

interface StudioQuota {
  limit: number | null;
  used: number;
  remaining: number | null;
  canCreateAudio: boolean;
}

export function CreatorEditor() {
  const router = useRouter();
  const [categories, setCategories] = useState<{ slug: string; name: string }[]>([]);
  const [quota, setQuota] = useState<StudioQuota | null>(null);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [mood, setMood] = useState<MoodTag>("CALM");
  const [category, setCategory] = useState("");
  const [content, setContent] = useState("");
  const [audio, setAudio] = useState<AudioChoiceValue>(DEFAULT_AUDIO_CHOICE);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    api<{ slug: string; name: string }[]>("/categories").then(setCategories).catch(() => setCategories([]));
    api<StudioQuota>("/studio/quota").then(setQuota).catch(() => setQuota(null));
  }, []);

  const paragraphs = useMemo(() => splitParagraphs(content), [content]);
  const words = useMemo(() => countWords(content), [content]);
  const isStaff = quota?.canCreateAudio ?? false;
  const outOfPosts = quota?.remaining === 0;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    // Người dùng thường chỉ đăng chữ; ban biên tập có thể kèm giọng đọc
    const payload = isStaff ? audioPayload(audio) : { mode: "none" as const };
    if (!payload) {
      setError("Hãy tải bản thu lên trước khi gửi");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await api("/studio/posts", {
        method: "POST",
        json: {
          title,
          summary: summary || undefined,
          moodTag: mood,
          categorySlug: category || undefined,
          content,
          audio: payload,
        },
      });
      router.push("/studio?da-gui=1");
    } catch (err) {
      setError((err as Error).message);
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        <Field label="Tiêu đề" htmlFor="title">
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            minLength={3}
            maxLength={200}
            placeholder="Một cái tên dịu dàng cho câu chuyện của bạn"
            className="h-14 font-serif text-xl"
          />
        </Field>

        <Field label="Tâm trạng">
          <div role="radiogroup" aria-label="Tâm trạng" className="flex flex-wrap gap-2">
            {(Object.keys(MOODS) as MoodTag[]).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mood === m}
                onClick={() => setMood(m)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                  mood === m ? "border-primary/60 bg-highlight text-primary" : "border-border text-muted hover:text-foreground",
                )}
              >
                {MOODS[m].label}
              </button>
            ))}
          </div>
        </Field>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Chuyên mục" htmlFor="category">
            <Select id="category" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">— Chọn chuyên mục —</option>
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tóm tắt" htmlFor="summary" hint="Hiển thị trên thẻ Radio (không bắt buộc)">
            <Input id="summary" value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={500} />
          </Field>
        </div>

        <Field
          label="Nội dung"
          htmlFor="content"
          hint="Mỗi đoạn văn cách nhau bằng một dòng trống. Khi phát, đoạn đang đọc sẽ được bôi sáng."
          error={words > MAX_WORDS ? `Nội dung tối đa ${MAX_WORDS} từ` : null}
        >
          <div className="overflow-hidden rounded-2xl border border-border bg-surface/60 focus-within:border-primary/60">
            <div className="flex items-center justify-between border-b border-border px-4 py-2 text-xs text-muted">
              <span>
                {paragraphs.length} đoạn · {words} từ · ~{estimateMinutes(words)} phút nghe
              </span>
              <button
                type="button"
                className="rounded-full px-2 py-1 text-primary hover:bg-highlight"
                onClick={() => setContent((c) => `${c.trimEnd()}\n\n`)}
              >
                + Ngắt đoạn
              </button>
            </div>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              minLength={20}
              rows={14}
              className="rounded-none border-0 bg-transparent font-serif text-lg"
              placeholder={"Đêm nay trời lại mưa...\n\nMột đoạn văn mới bắt đầu sau dòng trống."}
            />
          </div>
        </Field>
      </div>

      <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
        {isStaff ? (
          <section className="glass space-y-4 rounded-[28px] p-5">
            <h2 className="flex items-center gap-2 text-xs font-medium tracking-[0.2em] text-secondary uppercase">
              <ShieldCheck className="size-4" />
              Giọng đọc (ban biên tập)
            </h2>
            <AudioChoice value={audio} onChange={setAudio} />
          </section>
        ) : (
          <section className="glass space-y-3 rounded-[28px] p-5">
            <h2 className="text-xs font-medium tracking-[0.2em] text-secondary uppercase">Sau khi gửi</h2>
            <p className="text-sm leading-relaxed text-foreground/90">
              Ban biên tập sẽ đọc bài, chọn giọng đọc và nhạc nền phù hợp rồi đưa số Radio của bạn lên sóng.
            </p>
            {quota?.limit != null && (
              <p className="text-xs text-muted">
                Hôm nay bạn còn <span className="text-primary">{quota.remaining}</span>/{quota.limit} lượt đăng bài.
              </p>
            )}
          </section>
        )}

        {outOfPosts && (
          <Alert tone="info">Bạn đã đăng đủ số bài cho hôm nay. Hãy lưu bản nháp và quay lại vào ngày mai nhé.</Alert>
        )}
        {error && <Alert>{error}</Alert>}
        <Button type="submit" size="lg" className="w-full" disabled={pending || words > MAX_WORDS || outOfPosts}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          Gửi duyệt
        </Button>
        <p className="text-center text-xs text-muted">Bài viết sẽ được biên tập viên xem trước khi lên sóng.</p>
      </aside>
    </form>
  );
}
