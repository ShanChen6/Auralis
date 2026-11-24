import { estimateTimestamps } from '../common/text.js';
import { AudioSource, AudioStatus } from '../generated/prisma/enums.js';
import type { AudioInput } from '../studio/studio.schemas.js';
import { EDGE_VOICE_NAMES } from './radio-queue.constants.js';

/** Các cột audio của bài viết ứng với cách tạo audio đã chọn */
export function audioFields(audio: AudioInput, paragraphs: string[]) {
  switch (audio.mode) {
    case 'upload':
      return {
        post: {
          audioUrl: audio.audioUrl,
          duration: Math.round(audio.duration),
          audioSource: AudioSource.UPLOAD,
          audioStatus: AudioStatus.READY,
          voiceName: null,
          backgroundMusic: null,
        },
        // Bản thu không có dữ liệu căn chỉnh → ước lượng theo độ dài từng đoạn
        timestamps: estimateTimestamps(paragraphs, audio.duration),
      };
    case 'ai':
      return {
        post: {
          audioSource:
            audio.voice === 'studio'
              ? AudioSource.AI_VOICESTUDIO
              : AudioSource.AI_EDGE,
          audioStatus: AudioStatus.PROCESSING,
          voiceName:
            audio.voice === 'studio'
              ? 'VoiceStudio'
              : EDGE_VOICE_NAMES[audio.voice],
          backgroundMusic: audio.music,
        },
        timestamps: null,
      };
    case 'none':
      return {
        post: {
          audioSource: AudioSource.NONE,
          audioStatus: AudioStatus.TEXT_ONLY,
        },
        timestamps: null,
      };
  }
}

export type AudioFields = ReturnType<typeof audioFields>;
