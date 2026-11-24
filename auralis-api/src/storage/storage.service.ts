import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  Optional,
  PayloadTooLargeException,
  ServiceUnavailableException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  S3_CLIENT,
  STORAGE_CONFIG,
  type StorageConfig,
} from './storage.config.js';
import { UPLOAD_RULES, type UploadKind } from './storage.constants.js';
import { LOCAL_MEDIA, type LocalMediaStore } from './local-media.store.js';

const LOCAL_PRESIGN_EXPIRES_IN = 600;

export interface PresignedUploadRequest {
  kind: UploadKind;
  contentType: string;
  /** Dung lượng file (byte) – được ký vào URL nên client phải gửi đúng kích thước */
  contentLength: number;
}

export interface PresignedUpload {
  uploadUrl: string;
  method: 'PUT';
  /** Header client bắt buộc gửi kèm khi PUT lên R2 */
  headers: Record<string, string>;
  key: string;
  publicUrl: string;
  expiresIn: number;
}

export interface UploadBufferRequest {
  kind: UploadKind;
  contentType: string;
  body: Buffer | Uint8Array;
  /** Ghi đè key tự sinh (VD: audio/radio/<postId>.mp3) */
  key?: string;
}

export interface UploadedObject {
  key: string;
  publicUrl: string;
  size: number;
}

@Injectable()
export class StorageService {
  constructor(
    @Optional() @Inject(S3_CLIENT) private readonly s3: S3Client | null,
    @Optional()
    @Inject(STORAGE_CONFIG)
    private readonly config: StorageConfig | null,
    @Optional()
    @Inject(LOCAL_MEDIA)
    private readonly local: LocalMediaStore | null = null,
  ) {}

  get isConfigured(): boolean {
    return Boolean(this.s3 && this.config);
  }

  /** "r2" khi đã cấu hình R2, "local" khi dùng kho local (dev), "none" khi không có gì */
  get mode(): 'r2' | 'local' | 'none' {
    if (this.isConfigured) return 'r2';
    return this.local ? 'local' : 'none';
  }

  /** URL có thuộc kho lưu trữ của Auralis không (chặn gắn link ngoài vào bài viết) */
  ownsUrl(url: string): boolean {
    if (this.config && url.startsWith(`${this.config.publicUrl}/`)) return true;
    return this.local?.ownsUrl(url) ?? false;
  }

  /** Tạo Presigned PUT URL để Frontend tải ảnh bìa / MP3 thẳng lên R2. */
  async createPresignedUpload(
    request: PresignedUploadRequest,
  ): Promise<PresignedUpload> {
    const extension = this.validate(
      request.kind,
      request.contentType,
      request.contentLength,
    );
    const key = this.buildKey(request.kind, extension);

    if (!this.isConfigured && this.local) {
      const expiresIn = LOCAL_PRESIGN_EXPIRES_IN;
      return {
        uploadUrl: this.local.createUploadUrl(
          {
            key,
            contentType: request.contentType,
            contentLength: request.contentLength,
          },
          expiresIn,
        ),
        method: 'PUT',
        headers: { 'Content-Type': request.contentType },
        key,
        publicUrl: this.local.publicUrl(key),
        expiresIn,
      };
    }
    const { s3, config } = this.requireStorage();

    const command = new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      ContentType: request.contentType,
      ContentLength: request.contentLength,
    });
    const uploadUrl = await getSignedUrl(s3, command, {
      expiresIn: config.presignExpiresIn,
      // Ký cả Content-Type để client không thể đổi định dạng file khi PUT
      signableHeaders: new Set(['content-type']),
    });

    return {
      uploadUrl,
      method: 'PUT',
      headers: { 'Content-Type': request.contentType },
      key,
      publicUrl: this.getPublicUrl(key),
      expiresIn: config.presignExpiresIn,
    };
  }

  /** Upload buffer từ server (VD: file đã xử lý) lên R2 và trả về link CDN công khai. */
  async uploadBuffer(request: UploadBufferRequest): Promise<UploadedObject> {
    const size = request.body.byteLength;
    const extension = this.validate(request.kind, request.contentType, size);
    const key = request.key ?? this.buildKey(request.kind, extension);

    if (!this.isConfigured && this.local) {
      await this.local.write(key, request.body);
      return { key, publicUrl: this.local.publicUrl(key), size };
    }
    const { s3, config } = this.requireStorage();

    await s3.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: request.body,
        ContentType: request.contentType,
        ContentLength: size,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );

    return { key, publicUrl: this.getPublicUrl(key), size };
  }

  async deleteObject(key: string): Promise<void> {
    if (!this.isConfigured && this.local) return this.local.delete(key);
    const { s3, config } = this.requireStorage();
    await s3.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
  }

  getPublicUrl(key: string): string {
    if (!this.isConfigured && this.local) return this.local.publicUrl(key);
    const { config } = this.requireStorage();
    const path = key.split('/').map(encodeURIComponent).join('/');
    return `${config.publicUrl}/${path}`;
  }

  private validate(
    kind: UploadKind,
    contentType: string,
    size: number,
  ): string {
    const rule = UPLOAD_RULES[kind];
    if (!rule) {
      throw new BadRequestException(
        `Loại upload không hợp lệ: ${String(kind)}`,
      );
    }
    const extension = rule.mimeTypes[contentType];
    if (!extension) {
      throw new UnsupportedMediaTypeException(
        `Định dạng ${contentType} không được hỗ trợ cho ${kind}. Cho phép: ${Object.keys(rule.mimeTypes).join(', ')}`,
      );
    }
    if (!Number.isInteger(size) || size <= 0) {
      throw new BadRequestException('Dung lượng file không hợp lệ');
    }
    if (size > rule.maxBytes) {
      throw new PayloadTooLargeException(
        `File ${kind} tối đa ${rule.maxBytes / (1024 * 1024)}MB`,
      );
    }
    return extension;
  }

  private buildKey(kind: UploadKind, extension: string): string {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    return `${UPLOAD_RULES[kind].folder}/${year}/${month}/${randomUUID()}.${extension}`;
  }

  private requireStorage(): { s3: S3Client; config: StorageConfig } {
    if (!this.s3 || !this.config) {
      throw new ServiceUnavailableException(
        'Cloudflare R2 chưa được cấu hình (thiếu biến môi trường R2_*)',
      );
    }
    return { s3: this.s3, config: this.config };
  }
}
