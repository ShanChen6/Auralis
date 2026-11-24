"use client";

import { AudioLines, Mic, PenLine, Sparkles } from "lucide-react";
import { AI_MUSIC, AI_VOICES } from "@/lib/studio";
import { AudioUpload, type UploadedAudio } from "./audio-upload";
import { ChoiceCard } from "./choice-card";

export type AudioMode = "ai" | "upload" | "none";
export type Voice = (typeof AI_VOICES)[number]["id"];
export type Music = (typeof AI_MUSIC)[number]["id"];

export interface AudioChoiceValue {
  mode: AudioMode;
  voice: Voice;
  music: Music;
  upload: UploadedAudio | null;
}

export const DEFAULT_AUDIO_CHOICE: AudioChoiceValue = {
  mode: "ai",
  voice: "female_warm",
  music: "piano_rain",
  upload: null,
};

/** Payload gửi API; null nếu chọn tải lên nhưng chưa có file */
export function audioPayload(value: AudioChoiceValue) {
  if (value.mode === "ai") return { mode: "ai" as const, voice: value.voice, music: value.music };
  if (value.mode === "upload") {
    return value.upload
      ? { mode: "upload" as const, audioUrl: value.upload.publicUrl, duration: value.upload.duration }
      : null;
  }
  return { mode: "none" as const };
}

/** Chọn cách tạo giọng đọc – chỉ hiển thị cho ban biên tập */
export function AudioChoice({
  value,
  onChange,
  allowNone = true,
}: {
  value: AudioChoiceValue;
  onChange: (value: AudioChoiceValue) => void;
  allowNone?: boolean;
}) {
  const set = (patch: Partial<AudioChoiceValue>) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="Cách tạo âm thanh" className="grid gap-2">
        <ChoiceCard
          selected={value.mode === "ai"}
          onSelect={() => set({ mode: "ai" })}
          icon={<Sparkles className="size-4" />}
          title="Tạo Radio AI tự động"
          description="Giọng đọc AI + nhạc nền, tự hậu kỳ."
        />
        <ChoiceCard
          selected={value.mode === "upload"}
          onSelect={() => set({ mode: "upload" })}
          icon={<Mic className="size-4" />}
          title="Tải bản thu lên"
          description="Bản thu của biên tập viên hoặc cộng tác viên."
        />
        {allowNone && (
          <ChoiceCard
            selected={value.mode === "none"}
            onSelect={() => set({ mode: "none" })}
            icon={<PenLine className="size-4" />}
            title="Chỉ đăng chữ"
            description="Tạo giọng đọc sau trong trang kiểm duyệt."
          />
        )}
      </div>

      {value.mode === "ai" && (
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm text-foreground">Giọng đọc</p>
            <div role="radiogroup" aria-label="Giọng đọc" className="grid gap-2">
              {AI_VOICES.map((v) => (
                <ChoiceCard
                  key={v.id}
                  selected={value.voice === v.id}
                  onSelect={() => set({ voice: v.id })}
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
                  selected={value.music === m.id}
                  onSelect={() => set({ music: m.id })}
                  title={m.label}
                  className="p-3"
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {value.mode === "upload" && <AudioUpload value={value.upload} onChange={(upload) => set({ upload })} />}
    </div>
  );
}
