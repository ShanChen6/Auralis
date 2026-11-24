import {
  BadRequestException,
  PayloadTooLargeException,
  ServiceUnavailableException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { mockClient } from 'aws-sdk-client-mock';
import { r2Endpoint, type StorageConfig } from './storage.config.js';
import { StorageService } from './storage.service.js';

const config: StorageConfig = {
  accountId: 'test-account',
  accessKeyId: 'test-key',
  secretAccessKey: 'test-secret',
  bucket: 'auralis-media',
  publicUrl: 'https://cdn.auralis.test',
  presignExpiresIn: 600,
};

const MB = 1024 * 1024;

function createS3Client(): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: r2Endpoint(config.accountId),
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

describe('StorageService', () => {
  let s3: S3Client;
  let s3Mock: ReturnType<typeof mockClient>;
  let service: StorageService;

  beforeEach(() => {
    s3 = createS3Client();
    s3Mock = mockClient(s3);
    service = new StorageService(s3, config);
  });

  afterEach(() => {
    s3Mock.restore();
  });

  describe('createPresignedUpload', () => {
    it('ký một PUT URL tới bucket R2 với key theo loại file', async () => {
      const result = await service.createPresignedUpload({
        kind: 'cover',
        contentType: 'image/webp',
        contentLength: 200_000,
      });

      const url = new URL(result.uploadUrl);
      expect(url.host).toBe(
        'auralis-media.test-account.r2.cloudflarestorage.com',
      );
      expect(result.key).toMatch(/^covers\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.webp$/);
      expect(url.pathname).toBe(`/${result.key}`);
      expect(url.searchParams.get('X-Amz-Expires')).toBe('600');
      expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);
      // Content-Type và Content-Length được ký: client không thể đổi loại/kích thước file
      expect(url.searchParams.get('X-Amz-SignedHeaders')).toContain(
        'content-length',
      );
      expect(url.searchParams.get('X-Amz-SignedHeaders')).toContain(
        'content-type',
      );

      expect(result).toMatchObject({
        method: 'PUT',
        headers: { 'Content-Type': 'image/webp' },
        publicUrl: `https://cdn.auralis.test/${result.key}`,
        expiresIn: 600,
      });
      // Presign chạy offline, không gọi S3
      expect(s3Mock.calls()).toHaveLength(0);
    });

    it('sinh key audio với phần mở rộng theo MIME', async () => {
      const result = await service.createPresignedUpload({
        kind: 'audio',
        contentType: 'audio/mpeg',
        contentLength: 10 * MB,
      });
      expect(result.key).toMatch(/^audio\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.mp3$/);
    });

    it('mỗi lần gọi sinh một key khác nhau', async () => {
      const request = {
        kind: 'cover' as const,
        contentType: 'image/png',
        contentLength: 1000,
      };
      const [a, b] = await Promise.all([
        service.createPresignedUpload(request),
        service.createPresignedUpload(request),
      ]);
      expect(a.key).not.toBe(b.key);
    });

    it('từ chối MIME type không được phép', async () => {
      await expect(
        service.createPresignedUpload({
          kind: 'cover',
          contentType: 'image/gif',
          contentLength: 1000,
        }),
      ).rejects.toBeInstanceOf(UnsupportedMediaTypeException);
      await expect(
        service.createPresignedUpload({
          kind: 'audio',
          contentType: 'image/png',
          contentLength: 1000,
        }),
      ).rejects.toBeInstanceOf(UnsupportedMediaTypeException);
    });

    it('giới hạn ảnh bìa 5MB và audio 50MB', async () => {
      await expect(
        service.createPresignedUpload({
          kind: 'cover',
          contentType: 'image/jpeg',
          contentLength: 5 * MB,
        }),
      ).resolves.toBeDefined();
      await expect(
        service.createPresignedUpload({
          kind: 'cover',
          contentType: 'image/jpeg',
          contentLength: 5 * MB + 1,
        }),
      ).rejects.toBeInstanceOf(PayloadTooLargeException);
      await expect(
        service.createPresignedUpload({
          kind: 'audio',
          contentType: 'audio/mpeg',
          contentLength: 50 * MB + 1,
        }),
      ).rejects.toBeInstanceOf(PayloadTooLargeException);
    });

    it('từ chối dung lượng không hợp lệ', async () => {
      for (const contentLength of [0, -1, 1.5, Number.NaN]) {
        await expect(
          service.createPresignedUpload({
            kind: 'cover',
            contentType: 'image/png',
            contentLength,
          }),
        ).rejects.toBeInstanceOf(BadRequestException);
      }
    });
  });

  describe('uploadBuffer', () => {
    it('gửi PutObjectCommand và trả về link CDN', async () => {
      s3Mock.on(PutObjectCommand).resolves({ ETag: '"etag"' });
      const body = Buffer.from('fake-mp3-bytes');

      const result = await service.uploadBuffer({
        kind: 'audio',
        contentType: 'audio/mpeg',
        body,
      });

      expect(result.key).toMatch(/^audio\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.mp3$/);
      expect(result).toMatchObject({
        publicUrl: `https://cdn.auralis.test/${result.key}`,
        size: body.byteLength,
      });

      const calls = s3Mock.commandCalls(PutObjectCommand);
      expect(calls).toHaveLength(1);
      expect(calls[0].args[0].input).toMatchObject({
        Bucket: 'auralis-media',
        Key: result.key,
        Body: body,
        ContentType: 'audio/mpeg',
        ContentLength: body.byteLength,
        CacheControl: 'public, max-age=31536000, immutable',
      });
    });

    it('dùng key truyền vào và encode link công khai', async () => {
      s3Mock.on(PutObjectCommand).resolves({});
      const result = await service.uploadBuffer({
        kind: 'audio',
        contentType: 'audio/mpeg',
        body: Buffer.from('x'),
        key: 'audio/radio/trạm đêm mưa.mp3',
      });
      expect(result.key).toBe('audio/radio/trạm đêm mưa.mp3');
      expect(result.publicUrl).toBe(
        'https://cdn.auralis.test/audio/radio/tr%E1%BA%A1m%20%C4%91%C3%AAm%20m%C6%B0a.mp3',
      );
    });

    it('kiểm tra định dạng và dung lượng trước khi upload', async () => {
      await expect(
        service.uploadBuffer({
          kind: 'cover',
          contentType: 'image/png',
          body: Buffer.alloc(5 * MB + 1),
        }),
      ).rejects.toBeInstanceOf(PayloadTooLargeException);
      await expect(
        service.uploadBuffer({
          kind: 'cover',
          contentType: 'text/html',
          body: Buffer.from('<p>'),
        }),
      ).rejects.toBeInstanceOf(UnsupportedMediaTypeException);
      expect(s3Mock.calls()).toHaveLength(0);
    });

    it('ném lỗi của R2 ra ngoài', async () => {
      s3Mock.on(PutObjectCommand).rejects(new Error('R2 unavailable'));
      await expect(
        service.uploadBuffer({
          kind: 'audio',
          contentType: 'audio/mpeg',
          body: Buffer.from('x'),
        }),
      ).rejects.toThrow('R2 unavailable');
    });
  });

  it('deleteObject gửi DeleteObjectCommand', async () => {
    s3Mock.on(DeleteObjectCommand).resolves({});
    await service.deleteObject('covers/2026/11/a.webp');
    expect(s3Mock.commandCalls(DeleteObjectCommand)[0].args[0].input).toEqual({
      Bucket: 'auralis-media',
      Key: 'covers/2026/11/a.webp',
    });
  });

  it('báo 503 khi R2 chưa được cấu hình', async () => {
    const unconfigured = new StorageService(null, null);
    expect(unconfigured.isConfigured).toBe(false);
    await expect(
      unconfigured.createPresignedUpload({
        kind: 'cover',
        contentType: 'image/png',
        contentLength: 1,
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(
      unconfigured.uploadBuffer({
        kind: 'cover',
        contentType: 'image/png',
        body: Buffer.from('x'),
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
