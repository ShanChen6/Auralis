import { S3Client } from '@aws-sdk/client-s3';

export const S3_CLIENT = Symbol('S3_CLIENT');
export const STORAGE_CONFIG = Symbol('STORAGE_CONFIG');

export interface StorageConfig {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  /** Domain CDN công khai của bucket, VD: https://cdn.auralis.vn (không có "/" cuối) */
  publicUrl: string;
  /** Thời hạn của Presigned URL (giây) */
  presignExpiresIn: number;
  /** Ghi đè endpoint S3 (VD: emulator local). Mặc định là endpoint R2 theo account. */
  endpoint?: string;
}

const REQUIRED_ENV = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
  'R2_PUBLIC_URL',
] as const;

/** Trả về null khi R2 chưa được cấu hình, để app vẫn khởi động được ở local. */
export function loadStorageConfig(
  env: NodeJS.ProcessEnv = process.env,
): StorageConfig | null {
  if (REQUIRED_ENV.some((name) => !env[name])) {
    return null;
  }
  return {
    accountId: env.R2_ACCOUNT_ID!,
    accessKeyId: env.R2_ACCESS_KEY_ID!,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
    bucket: env.R2_BUCKET!,
    publicUrl: env.R2_PUBLIC_URL!.replace(/\/+$/, ''),
    presignExpiresIn: Number(env.R2_PRESIGN_EXPIRES_IN ?? 600),
    ...(env.R2_ENDPOINT ? { endpoint: env.R2_ENDPOINT } : {}),
  };
}

export function r2Endpoint(accountId: string): string {
  return `https://${accountId}.r2.cloudflarestorage.com`;
}

export function createS3Client(config: StorageConfig): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: config.endpoint ?? r2Endpoint(config.accountId),
    // Emulator S3 local thường chỉ hỗ trợ path-style URL
    forcePathStyle: Boolean(config.endpoint),
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}
