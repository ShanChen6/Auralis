import { api } from "./client-api";

interface PresignedUpload {
  uploadUrl: string;
  method: "PUT";
  headers: Record<string, string>;
  key: string;
  publicUrl: string;
}

export const AUDIO_TYPES = ["audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp4", "audio/aac"];
export const MAX_AUDIO_BYTES = 50 * 1024 * 1024;

/** Đọc thời lượng file audio ngay trên trình duyệt */
export function readAudioDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      if (Number.isFinite(audio.duration)) resolve(audio.duration);
      else reject(new Error("Không đọc được thời lượng"));
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("File audio không hợp lệ"));
    };
    audio.src = url;
  });
}

/** Xin Presigned URL rồi PUT thẳng lên R2 (hoặc kho local khi dev), có báo tiến độ */
export async function uploadAudio(
  file: File,
  onProgress?: (ratio: number) => void,
): Promise<{ publicUrl: string; duration: number }> {
  if (!AUDIO_TYPES.includes(file.type)) throw new Error("Chỉ nhận file MP3, WAV, M4A hoặc AAC");
  if (file.size > MAX_AUDIO_BYTES) throw new Error("File audio tối đa 50MB");
  const duration = await readAudioDuration(file);
  const presigned = await api<PresignedUpload>("/storage/presigned-upload", {
    method: "POST",
    json: { kind: "audio", contentType: file.type, contentLength: file.size },
  });

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", presigned.uploadUrl);
    Object.entries(presigned.headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Tải lên thất bại (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Mất kết nối khi tải lên"));
    xhr.send(file);
  });
  return { publicUrl: presigned.publicUrl, duration };
}
