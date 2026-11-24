import { mkdirSync } from 'node:fs';
import {
  type INestApplication,
  StandardSchemaValidationPipe,
} from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { loadStorageConfig } from './storage/storage.config.js';
import { localMediaDir } from './storage/storage.module.js';

/** Cấu hình dùng chung cho main.ts và test */
export function configureApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix('api');
  // Header bảo mật; cho phép web ở domain khác phát file trong /media
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cookieParser());
  app.useGlobalPipes(new StandardSchemaValidationPipe());
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  });
  // Phục vụ file của kho local (chỉ khi chưa cấu hình R2)
  const express = app as NestExpressApplication;
  // Chạy sau proxy (Render, Vercel rewrites): lấy IP thật từ X-Forwarded-For để rate limit đúng
  const trustProxy =
    process.env.TRUST_PROXY ??
    (process.env.NODE_ENV === 'production' ? '2' : 'loopback');
  if (typeof express.set === 'function') {
    express.set(
      'trust proxy',
      /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy,
    );
  }
  if (!loadStorageConfig() && typeof express.useStaticAssets === 'function') {
    const dir = localMediaDir();
    mkdirSync(dir, { recursive: true });
    express.useStaticAssets(dir, {
      prefix: '/media/',
      maxAge: '1y',
      immutable: true,
    });
  }
  return app;
}
