import { Injectable } from '@nestjs/common';

export interface GenerateRadioRequest {
  script: string;
  engine: 'edge' | 'voicestudio';
  voice: string;
  music: string | null;
  postId: string;
}

export interface GenerateRadioResponse {
  audioUrl: string;
  key: string;
  duration: number;
  timestamps: { index: number; start: number; end: number }[];
  engine: string;
  requestedEngine: string;
  fallbackReason: string | null;
  voice: string;
  music: string | null;
}

export class AudioAiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

/** Gọi dịch vụ Python auralis-audio-ai: POST /api/v1/generate-radio */
@Injectable()
export class AudioAiClient {
  private readonly baseUrl = (
    process.env.AUDIO_AI_URL ?? 'http://localhost:8000'
  ).replace(/\/+$/, '');
  private readonly apiKey = process.env.AUDIO_AI_API_KEY;
  private readonly timeoutMs = Number(
    process.env.AUDIO_AI_TIMEOUT_MS ?? 15 * 60_000,
  );

  async generateRadio(
    body: GenerateRadioRequest,
  ): Promise<GenerateRadioResponse> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/api/v1/generate-radio`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(this.apiKey ? { 'x-api-key': this.apiKey } : {}),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      throw new AudioAiError(
        `Không gọi được auralis-audio-ai: ${(error as Error).message}`,
      );
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new AudioAiError(
        `auralis-audio-ai trả lỗi ${res.status}: ${detail.slice(0, 300)}`,
        res.status,
      );
    }
    return (await res.json()) as GenerateRadioResponse;
  }
}
