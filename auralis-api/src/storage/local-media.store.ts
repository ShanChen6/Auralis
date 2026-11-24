import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';

export const LOCAL_MEDIA = Symbol('LOCAL_MEDIA');

export interface LocalUploadTicket {
  key: string;
  contentType: string;
  contentLength: number;
}

/**
 * Kho lưu trữ local cho môi trường phát triển khi chưa cấu hình R2:
 * "presigned URL" là URL tới chính API, ký HMAC kèm hạn dùng, kích thước và MIME.
 */
export class LocalMediaStore {
  readonly directory: string;

  constructor(
    directory: string,
    private readonly apiPublicUrl: string,
    private readonly secret: string,
  ) {
    this.directory = resolve(directory);
  }

  publicUrl(key: string): string {
    return `${this.apiPublicUrl.replace(/\/+$/, '')}/media/${key.split('/').map(encodeURIComponent).join('/')}`;
  }

  createUploadUrl(
    ticket: LocalUploadTicket,
    expiresInSeconds: number,
    now = Date.now(),
  ): string {
    const exp = Math.floor(now / 1000) + expiresInSeconds;
    const params = new URLSearchParams({
      key: ticket.key,
      ct: ticket.contentType,
      len: String(ticket.contentLength),
      exp: String(exp),
    });
    params.set('sig', this.sign(params));
    return `${this.apiPublicUrl.replace(/\/+$/, '')}/api/storage/local-upload?${params}`;
  }

  /** Trả về thông tin upload nếu chữ ký hợp lệ và còn hạn, ngược lại null */
  verify(
    query: Record<string, unknown>,
    now = Date.now(),
  ): LocalUploadTicket | null {
    const { key, ct, len, exp, sig } = query;
    if ([key, ct, len, exp, sig].some((v) => typeof v !== 'string'))
      return null;
    const params = new URLSearchParams({
      key: key as string,
      ct: ct as string,
      len: len as string,
      exp: exp as string,
    });
    const expected = Buffer.from(this.sign(params));
    const actual = Buffer.from(sig as string);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
      return null;
    if (Number(exp) * 1000 < now) return null;
    return {
      key: key as string,
      contentType: ct as string,
      contentLength: Number(len),
    };
  }

  async write(key: string, data: Uint8Array): Promise<void> {
    const path = this.resolveKey(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolveKey(key), { force: true });
  }

  ownsUrl(url: string): boolean {
    return url.startsWith(`${this.apiPublicUrl.replace(/\/+$/, '')}/media/`);
  }

  private resolveKey(key: string): string {
    const path = resolve(this.directory, key);
    if (!path.startsWith(this.directory + sep))
      throw new Error(`Key không hợp lệ: ${key}`);
    return path;
  }

  private sign(params: URLSearchParams): string {
    return createHmac('sha256', this.secret)
      .update(params.toString())
      .digest('hex');
  }
}
