export type MoodTag =
  | "CALM"
  | "HEALING"
  | "NOSTALGIC"
  | "MELANCHOLY"
  | "ROMANTIC"
  | "HOPEFUL"
  | "LONELY"
  | "MOTIVATED";

/** Nhãn tiếng Việt + sắc độ (hue) dùng cho ảnh bìa sinh tự động */
export const MOODS: Record<MoodTag, { label: string; hue: number; accent: number }> = {
  CALM: { label: "Bình yên", hue: 222, accent: 38 },
  HEALING: { label: "Chữa lành", hue: 160, accent: 45 },
  NOSTALGIC: { label: "Hoài niệm", hue: 28, accent: 265 },
  MELANCHOLY: { label: "Man mác", hue: 235, accent: 260 },
  ROMANTIC: { label: "Lãng mạn", hue: 330, accent: 38 },
  HOPEFUL: { label: "Hy vọng", hue: 42, accent: 200 },
  LONELY: { label: "Cô đơn", hue: 250, accent: 220 },
  MOTIVATED: { label: "Tiếp lửa", hue: 15, accent: 45 },
};

export const MUSIC_LABELS: Record<string, string> = {
  piano_rain: "Piano mưa",
  lofi_warm: "Lo-fi ấm áp",
  acoustic_night: "Guitar mộc",
};

const VOICE_LABELS: Record<string, string> = {
  "vi-VN-HoaiMyNeural": "Hoài My · Nữ trầm ấm",
  "vi-VN-NamMinhNeural": "Nam Minh · Nam sâu lắng",
  VoiceStudio: "Giọng Studio",
};

export function voiceLabel(voiceName: string | null, isAi: boolean): string {
  if (!voiceName) return "Chưa có giọng đọc";
  const label = VOICE_LABELS[voiceName] ?? voiceName;
  return isAi ? `Giọng AI · ${label}` : label;
}

export function musicLabel(id: string | null): string {
  return id ? (MUSIC_LABELS[id] ?? id) : "Không nhạc nền";
}

/** 83 → "1:23", 3725 → "1:02:05" */
export function formatTime(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null || !Number.isFinite(totalSeconds) || totalSeconds < 0) return "0:00";
  const s = Math.floor(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

export function formatDurationLabel(seconds: number | null | undefined): string {
  if (!seconds) return "—";
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} phút`;
}

export function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("vi-VN", { day: "numeric", month: "long", year: "numeric" }).format(
    new Date(iso),
  );
}

/** "Radio đêm · Bình yên"; bỏ lặp khi tên chuyên mục trùng nhãn tâm trạng */
export function categoryMoodLabel(category: string | null | undefined, mood: MoodTag): string {
  const moodLabel = MOODS[mood]?.label ?? "";
  if (!category || category.toLowerCase() === moodLabel.toLowerCase()) return moodLabel;
  return `${category} · ${moodLabel}`;
}
