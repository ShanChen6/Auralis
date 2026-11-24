import {
  INestApplication,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { S3Client } from '@aws-sdk/client-s3';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import {
  S3_CLIENT,
  STORAGE_CONFIG,
  r2Endpoint,
  type StorageConfig,
} from './storage.config.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { LOCAL_MEDIA } from './local-media.store.js';
import { StorageModule } from './storage.module.js';

/** Guard giả: có header x-test-user thì coi như đã đăng nhập */
const fakeAuthGuard = {
  canActivate(context: ExecutionContext) {
    const req = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string> }>();
    if (!req.headers['x-test-user']) throw new UnauthorizedException();
    return true;
  },
};

const config: StorageConfig = {
  accountId: 'test-account',
  accessKeyId: 'test-key',
  secretAccessKey: 'test-secret',
  bucket: 'auralis-media',
  publicUrl: 'https://cdn.auralis.test',
  presignExpiresIn: 300,
};

async function createApp(withStorage: boolean): Promise<INestApplication<App>> {
  const moduleRef = await Test.createTestingModule({ imports: [StorageModule] })
    .overrideGuard(AuthGuard)
    .useValue(fakeAuthGuard)
    .overrideProvider(STORAGE_CONFIG)
    .useValue(withStorage ? config : null)
    .overrideProvider(LOCAL_MEDIA)
    .useValue(null)
    .overrideProvider(S3_CLIENT)
    .useValue(
      withStorage
        ? new S3Client({
            region: 'auto',
            endpoint: r2Endpoint(config.accountId),
            credentials: {
              accessKeyId: 'test-key',
              secretAccessKey: 'test-secret',
            },
          })
        : null,
    )
    .compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  app.setGlobalPrefix('api');
  await app.init();
  return app;
}

describe('StorageController', () => {
  describe('khi đã cấu hình R2', () => {
    let app: INestApplication<App>;
    beforeAll(async () => {
      app = await createApp(true);
    });
    afterAll(async () => {
      await app.close();
    });

    it('POST /api/storage/presigned-upload trả về URL đã ký', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/storage/presigned-upload')
        .set('x-test-user', 'u1')
        .send({ kind: 'audio', contentType: 'audio/mpeg', contentLength: 1024 })
        .expect(201);

      expect(res.body).toMatchObject({
        method: 'PUT',
        headers: { 'Content-Type': 'audio/mpeg' },
        expiresIn: 300,
      });
      expect(res.body.key).toMatch(/^audio\/.+\.mp3$/);
      expect(res.body.uploadUrl).toContain('X-Amz-Signature=');
      expect(res.body.publicUrl).toBe(
        `https://cdn.auralis.test/${res.body.key}`,
      );
    });

    it.each([
      [{}, 400],
      [{ kind: 'video', contentType: 'video/mp4', contentLength: 1 }, 400],
      [{ kind: 'cover', contentLength: 1 }, 400],
      [{ kind: 'cover', contentType: 'image/png', contentLength: '1' }, 400],
      [{ kind: 'cover', contentType: 'image/gif', contentLength: 1 }, 415],
      [
        {
          kind: 'cover',
          contentType: 'image/png',
          contentLength: 6 * 1024 * 1024,
        },
        413,
      ],
    ])('từ chối body %j với mã %i', async (body, status) => {
      await request(app.getHttpServer())
        .post('/api/storage/presigned-upload')
        .set('x-test-user', 'u1')
        .send(body)
        .expect(status);
    });
  });

  it('trả về 503 khi chưa cấu hình R2', async () => {
    const app = await createApp(false);
    await request(app.getHttpServer())
      .post('/api/storage/presigned-upload')
      .set('x-test-user', 'u1')
      .send({ kind: 'cover', contentType: 'image/png', contentLength: 1 })
      .expect(503);
    await app.close();
  });

  it('trả về 401 khi chưa đăng nhập', async () => {
    const app = await createApp(true);
    await request(app.getHttpServer())
      .post('/api/storage/presigned-upload')
      .send({ kind: 'cover', contentType: 'image/png', contentLength: 1 })
      .expect(401);
    await app.close();
  });
});
