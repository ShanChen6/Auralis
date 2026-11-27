export type UploadKind = 'cover' | 'audio';

export interface UploadRule {
  folder: string;
  maxBytes: number;
  /** MIME type được phép -> phần mở rộng file */
  mimeTypes: Record<string, string>;
}

const MB = 1024 * 1024;

export const UPLOAD_RULES: Record<UploadKind, UploadRule> = {
  cover: {
    folder: 'covers',
    maxBytes: 5 * MB,
    mimeTypes: {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/avif': 'avif',
    },
  },
  audio: {
    folder: 'audio',
    maxBytes: 50 * MB,
    mimeTypes: {
      'audio/mpeg': 'mp3',
      'audio/wav': 'wav',
      'audio/x-wav': 'wav',
      'audio/mp4': 'm4a',
      'audio/aac': 'aac',
    },
  },
};

export function isUploadKind(value: unknown): value is UploadKind {
  return typeof value === 'string' && value in UPLOAD_RULES;
}
