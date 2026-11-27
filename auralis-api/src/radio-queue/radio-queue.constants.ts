export const RADIO_QUEUE = 'radio-generation';

export type AiVoice = 'female_warm' | 'male_deep' | 'studio';
export type MusicId = 'piano_rain' | 'lofi_warm' | 'acoustic_night';

export interface RadioJobData {
  postId: string;
  voice: AiVoice;
  music: MusicId | null;
}

export const RADIO_JOB_ATTEMPTS = 2;

/** Giọng hiển thị lưu vào posts.voice_name */
export const EDGE_VOICE_NAMES: Record<Exclude<AiVoice, 'studio'>, string> = {
  female_warm: 'vi-VN-HoaiMyNeural',
  male_deep: 'vi-VN-NamMinhNeural',
};

export function voiceFromName(voiceName: string | null): AiVoice {
  if (voiceName === EDGE_VOICE_NAMES.male_deep) return 'male_deep';
  if (voiceName === 'VoiceStudio') return 'studio';
  return 'female_warm';
}

/** Giọng Studio đọc bằng VoiceStudio (giọng nhân bản), các giọng khác bằng edge-tts */
export function engineRequest(
  voice: AiVoice,
  env: NodeJS.ProcessEnv = process.env,
) {
  return voice === 'studio'
    ? {
        engine: 'voicestudio' as const,
        voice: env.VOICESTUDIO_VOICE ?? 'auralis-studio',
      }
    : { engine: 'edge' as const, voice };
}

export function redisConnection(
  url = process.env.REDIS_URL ?? 'redis://localhost:6379',
) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    username: parsed.username || undefined,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    tls: parsed.protocol === 'rediss:' ? {} : undefined,
  };
}
