import { randomBytes } from 'node:crypto';

/** "Trạm đêm mưa – Số 1!" → "tram-dem-mua-so-1" */
export function slugify(text: string, maxLength = 80): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/, '');
}

export function randomSuffix(length = 6): string {
  return randomBytes(8)
    .toString('base64url')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase()
    .slice(0, length);
}

/** Tách đoạn giống dịch vụ TTS: các đoạn cách nhau bằng dòng trống */
export function splitParagraphs(content: string): string[] {
  return content
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function countWords(content: string): number {
  return content.split(/\s+/).filter(Boolean).length;
}

export type Timestamp = {
  index: number;
  start: number;
  end: number;
};

/**
 * Ước lượng mốc thời gian từng đoạn cho audio tự thu (không có dữ liệu căn chỉnh):
 * chia thời lượng theo tỉ lệ số ký tự của mỗi đoạn.
 */
export function estimateTimestamps(
  paragraphs: string[],
  durationSeconds: number,
): Timestamp[] {
  const lengths = paragraphs.map((p) => Math.max(p.length, 1));
  const total = lengths.reduce((a, b) => a + b, 0);
  let cursor = 0;
  return lengths.map((length, index) => {
    const span = (length / total) * durationSeconds;
    const stamp = {
      index,
      start: Math.round(cursor * 1000) / 1000,
      end: Math.round((cursor + span) * 1000) / 1000,
    };
    cursor += span;
    return stamp;
  });
}
