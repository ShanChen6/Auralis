import { mkdirSync } from 'node:fs';
import {
  type INestApplication,
  StandardSchemaValidationPipe,
} from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { loadStorageConfig } from './storage/storage.config.js';
import { localMediaDir } from './storage/storage.module.js';

/** Cấu hình dùng chung cho main.ts và test */
export function configureApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.useGlobalPipes(new StandardSchemaValidationPipe());
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  });
  // Phục vụ file của kho local (chỉ khi chưa cấu hình R2)
  const express = app as NestExpressApplication;
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
