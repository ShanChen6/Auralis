"use client";

import { FileAudio, Loader2, Upload, X } from "lucide-react";
import { useId, useState } from "react";
import { Alert } from "@/components/ui/input";
import { formatTime } from "@/lib/format";
import { AUDIO_TYPES, uploadAudio } from "@/lib/upload";

export interface UploadedAudio {
  publicUrl: string;
  duration: number;
  name: string;
}

/** Chọn file → tải thẳng lên R2 qua Presigned URL, có tiến độ và nghe thử */
export function AudioUpload({
  value,
  onChange,
}: {
  value: UploadedAudio | null;
  onChange: (value: UploadedAudio | null) => void;
}) {
  const id = useId();
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setProgress(0);
    try {
      const result = await uploadAudio(file, setProgress);
      onChange({ ...result, name: file.name });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setProgress(null);
    }
  }

  if (value) {
    return (
      <div className="space-y-3 rounded-2xl border border-border bg-surface/60 p-4">
        <div className="flex items-center gap-3">
          <FileAudio className="size-5 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-foreground">{value.name}</p>
            <p className="text-xs text-muted">{formatTime(value.duration)} · đã tải lên</p>
          </div>
          <button type="button" onClick={() => onChange(null)} aria-label="Chọn file khác" className="text-muted hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>
        <audio src={value.publicUrl} controls preload="metadata" className="w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label
        htmlFor={id}
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-surface/40 px-6 py-10 text-center transition-colors hover:border-primary/50"
      >
        {progress !== null ? (
          <>
            <Loader2 className="size-6 animate-spin text-primary" />
            <span className="text-sm text-foreground">Đang tải lên… {Math.round(progress * 100)}%</span>
            <span className="h-1 w-48 overflow-hidden rounded-full bg-foreground/10">
              <span className="block h-full bg-primary transition-[width]" style={{ width: `${progress * 100}%` }} />
            </span>
          </>
        ) : (
          <>
            <Upload className="size-6 text-muted" />
            <span className="text-sm text-foreground">Chọn file thu âm của bạn</span>
            <span className="text-xs text-muted">MP3, WAV, M4A hoặc AAC · tối đa 50MB</span>
          </>
        )}
        <input
          id={id}
          type="file"
          accept={AUDIO_TYPES.join(",")}
          className="sr-only"
          disabled={progress !== null}
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
      </label>
      {error && <Alert>{error}</Alert>}
    </div>
  );
}
