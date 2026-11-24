import type { MoodTag } from "./format";

export type PostStatus = "DRAFT" | "PENDING" | "PUBLISHED" | "REJECTED" | "ARCHIVED";
export type AudioStatus = "TEXT_ONLY" | "PROCESSING" | "READY" | "FAILED";
export type AudioSource = "NONE" | "UPLOAD" | "AI_EDGE" | "AI_VOICESTUDIO";
export type NarrationStatus = "CLAIMED" | "SUBMITTED" | "APPROVED" | "REJECTED" | "WITHDRAWN";

export interface StudioPost {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  moodTag: MoodTag;
  status: PostStatus;
  audioSource: AudioSource;
  audioStatus: AudioStatus;
  audioUrl: string | null;
  duration: number | null;
  voiceName: string | null;
  backgroundMusic: string | null;
  rejectReason: string | null;
  publishedAt: string | null;
  createdAt: string;
  category: { slug: string; name: string } | null;
  narrator: { username: string; displayName: string } | null;
}

export const POST_STATUS: Record<PostStatus, { label: string; tone: "amber" | "green" | "red" | "muted" }> = {
  DRAFT: { label: "Bản nháp", tone: "muted" },
  PENDING: { label: "Chờ duyệt", tone: "amber" },
  PUBLISHED: { label: "Đã xuất bản", tone: "green" },
  REJECTED: { label: "Bị từ chối", tone: "red" },
  ARCHIVED: { label: "Đã lưu trữ", tone: "muted" },
};

export const NARRATION_STATUS: Record<NarrationStatus, { label: string; tone: "amber" | "green" | "red" | "muted" | "lavender" }> = {
  CLAIMED: { label: "Đang thu âm", tone: "lavender" },
  SUBMITTED: { label: "Chờ duyệt", tone: "amber" },
  APPROVED: { label: "Đã được chọn", tone: "green" },
  REJECTED: { label: "Chưa được chọn", tone: "red" },
  WITHDRAWN: { label: "Đã rút", tone: "muted" },
};

export const AI_VOICES = [
  { id: "female_warm", label: "Nữ trầm ấm", detail: "Hoài My · edge-tts" },
  { id: "male_deep", label: "Nam sâu lắng", detail: "Nam Minh · edge-tts" },
  { id: "studio", label: "Giọng Studio", detail: "VoiceStudio nhân bản · tự chuyển sang giọng nữ nếu Studio vắng" },
] as const;

export const AI_MUSIC = [
  { id: "piano_rain", label: "Piano mưa" },
  { id: "lofi_warm", label: "Lo-fi ấm áp" },
  { id: "acoustic_night", label: "Guitar mộc" },
  { id: null, label: "Không nhạc nền" },
] as const;

/** Tốc độ đọc tiếng Việt chậm rãi ~ 150 từ/phút */
export function estimateMinutes(words: number): number {
  return Math.max(1, Math.round(words / 150));
}

export function splitParagraphs(content: string): string[] {
  return content
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function countWords(content: string): number {
  return content.split(/\s+/).filter(Boolean).length;
}
