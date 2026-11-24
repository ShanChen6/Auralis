"use client";

import { AudioLines, Loader2, Mic, PenLine, Send, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Alert, Field, Input, Select, Textarea } from "@/components/ui/input";
import { api } from "@/lib/client-api";
import { MOODS, type MoodTag } from "@/lib/format";
import { AI_MUSIC, AI_VOICES, countWords, estimateMinutes, splitParagraphs } from "@/lib/studio";
import { cn } from "@/lib/utils";
import { AudioUpload, type UploadedAudio } from "./audio-upload";
import { ChoiceCard } from "./choice-card";

type AudioMode = "ai" | "upload" | "none";
type Voice = (typeof AI_VOICES)[number]["id"];
type Music = (typeof AI_MUSIC)[number]["id"];

const MAX_WORDS = 3000;

export function CreatorEditor() {
  const router = useRouter();
  const [categories, setCategories] = useState<{ slug: string; name: string }[]>([]);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [mood, setMood] = useState<MoodTag>("CALM");
  const [category, setCategory] = useState("");
  const [content, setContent] = useState("");
  const [mode, setMode] = useState<AudioMode>("ai");
  const [voice, setVoice] = useState<Voice>("female_warm");
  const [music, setMusic] = useState<Music>("piano_rain");
  const [upload, setUpload] = useState<UploadedAudio | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const [quota, setQuota] = useState<{ limit: number | null; remaining: number | null } | null>(null);

  useEffect(() => {
    api<{ slug: string; name: string }[]>("/categories").then(setCategories).catch(() => setCategories([]));
    api<{ limit: number | null; remaining: number | null }>("/studio/quota").then(setQuota).catch(() => setQuota(null));
  }, []);

  // JSON không có Infinity → biên tập viên/quản trị nhận null (không giới hạn)
  const aiExhausted = quota?.remaining === 0;

  const paragraphs = useMemo(() => splitParagraphs(content), [content]);
  const words = useMemo(() => countWords(content), [content]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (mode === "upload" && !upload) {
      setError("Hãy tải lên file thu âm trước khi gửi duyệt");
      return;
    }
    setPending(true);
    setError(null);
    const audio =
      mode === "ai"
        ? { mode, voice, music }
        : mode === "upload"
          ? { mode, audioUrl: upload!.publicUrl, duration: upload!.duration }
          : { mode };
    try {
      await api("/studio/posts", {
        method: "POST",
        json: {
          title,
          summary: summary || undefined,
          moodTag: mood,
          categorySlug: category || undefined,
          content,
          audio,
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
        <section className="glass space-y-4 rounded-[28px] p-5">
          <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-secondary">Giọng đọc cho số Radio</h2>
          <div role="radiogroup" aria-label="Cách tạo âm thanh" className="grid gap-2">
            <ChoiceCard
              selected={mode === "ai"}
              onSelect={() => setMode("ai")}
              icon={<Sparkles className="size-4" />}
              title="Tạo Radio AI tự động"
              description={
                quota?.limit != null
                  ? `Giọng đọc AI + nhạc nền, tự hậu kỳ. Còn ${quota.remaining}/${quota.limit} lượt hôm nay.`
                  : "Giọng đọc AI + nhạc nền, tự hậu kỳ."
              }
            />
            <ChoiceCard
              selected={mode === "upload"}
              onSelect={() => setMode("upload")}
              icon={<Mic className="size-4" />}
              title="Tự thu âm & tải lên"
              description="Dùng giọng đọc của chính bạn."
            />
            <ChoiceCard
              selected={mode === "none"}
              onSelect={() => setMode("none")}
              icon={<PenLine className="size-4" />}
              title="Chỉ đăng chữ"
              description="Mời cộng đồng lồng tiếng sau khi bài được duyệt."
            />
          </div>

          {mode === "ai" && (
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-sm text-foreground">Giọng đọc</p>
                <div role="radiogroup" aria-label="Giọng đọc" className="grid gap-2">
                  {AI_VOICES.map((v) => (
                    <ChoiceCard
                      key={v.id}
                      selected={voice === v.id}
                      onSelect={() => setVoice(v.id)}
                      icon={<AudioLines className="size-4" />}
                      title={v.label}
                      description={v.detail}
                      className="p-3"
                    />
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm text-foreground">Nhạc nền</p>
                <div role="radiogroup" aria-label="Nhạc nền" className="grid grid-cols-2 gap-2">
                  {AI_MUSIC.map((m) => (
                    <ChoiceCard
                      key={m.label}
                      selected={music === m.id}
                      onSelect={() => setMusic(m.id)}
                      title={m.label}
                      className="p-3"
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {mode === "ai" && aiExhausted && (
            <Alert tone="info">Bạn đã dùng hết lượt tạo Radio AI hôm nay. Hãy tự thu âm, hoặc quay lại vào ngày mai nhé.</Alert>
          )}
          {mode === "upload" && <AudioUpload value={upload} onChange={setUpload} />}
        </section>

        {error && <Alert>{error}</Alert>}
        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={pending || words > MAX_WORDS || (mode === "ai" && aiExhausted)}
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          Gửi duyệt
        </Button>
        <p className="text-center text-xs text-muted">Bài viết sẽ được biên tập viên xem trước khi lên sóng.</p>
      </aside>
    </form>
  );
}
