/**
 * Kiểm tra kết nối Cloudflare R2 thật bằng chính StorageService của API.
 *
 *   pnpm r2:check
 *
 * Đọc biến R2_* từ auralis-api/.env. Script tự xóa mọi file test đã tạo.
 */
import 'dotenv/config';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import {
  createS3Client,
  loadStorageConfig,
} from '../src/storage/storage.config.js';
import { StorageService } from '../src/storage/storage.service.js';

type Check = { name: string; ok: boolean; detail: string };

const config = loadStorageConfig();
if (!config) {
  console.error(
    '✗ Thiếu biến môi trường. Cần: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL',
  );
  process.exit(1);
}

const s3 = createS3Client(config);
const storage = new StorageService(s3, config);
const checks: Check[] = [];
const createdKeys: string[] = [];

async function check(name: string, run: () => Promise<string>): Promise<void> {
  try {
    checks.push({ name, ok: true, detail: await run() });
  } catch (error) {
    checks.push({
      name,
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

function expectStatus(
  actual: number,
  expected: (status: number) => boolean,
  label: string,
): string {
  if (!expected(actual)) throw new Error(`HTTP ${actual} (mong đợi ${label})`);
  return `HTTP ${actual}`;
}

const audio = Buffer.from(`auralis-r2-check ${new Date().toISOString()}`);
const presigned = await storage.createPresignedUpload({
  kind: 'audio',
  contentType: 'audio/mpeg',
  contentLength: audio.byteLength,
});
createdKeys.push(presigned.key);
const putPresigned = (headers: Record<string, string>, body: Buffer) =>
  fetch(presigned.uploadUrl, {
    method: 'PUT',
    headers,
    body: new Uint8Array(body),
  }).then((r) => r.status);

await check('Presigned PUT với đúng header', async () =>
  expectStatus(
    await putPresigned(presigned.headers, audio),
    (s) => s === 200,
    '200',
  ),
);

await check('Đọc lại object qua S3 API', async () => {
  const object = await s3.send(
    new GetObjectCommand({ Bucket: config.bucket, Key: presigned.key }),
  );
  const body = Buffer.from(await object.Body!.transformToByteArray());
  if (!body.equals(audio)) throw new Error('Nội dung không khớp');
  return `${object.ContentType}, ${object.ContentLength} bytes`;
});

await check('Link CDN công khai (R2_PUBLIC_URL)', async () => {
  const response = await fetch(presigned.publicUrl);
  return `${expectStatus(response.status, (s) => s === 200, '200')} ${presigned.publicUrl}`;
});

await check('R2 chặn PUT sai Content-Type', async () =>
  expectStatus(
    await putPresigned({ 'Content-Type': 'text/html' }, audio),
    (s) => s >= 400,
    '4xx',
  ),
);

await check('R2 chặn PUT sai dung lượng', async () =>
  expectStatus(
    await putPresigned(
      presigned.headers,
      Buffer.concat([audio, Buffer.from('!')]),
    ),
    (s) => s >= 400,
    '4xx',
  ),
);

await check('R2 chặn chữ ký giả', async () => {
  const forged = presigned.uploadUrl.replace(
    /X-Amz-Signature=[0-9a-f]{8}/,
    'X-Amz-Signature=00000000',
  );
  const status = await fetch(forged, {
    method: 'PUT',
    headers: presigned.headers,
    body: new Uint8Array(audio),
  }).then((r) => r.status);
  return expectStatus(status, (s) => s === 403, '403');
});

await check(
  'CORS cho trình duyệt (preflight từ http://localhost:3000)',
  async () => {
    const response = await fetch(presigned.uploadUrl, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:3000',
        'Access-Control-Request-Method': 'PUT',
        'Access-Control-Request-Headers': 'content-type',
      },
    });
    const allowOrigin = response.headers.get('access-control-allow-origin');
    if (!response.ok || !allowOrigin) {
      throw new Error(
        `HTTP ${response.status}, chưa cấu hình CORS Policy cho bucket`,
      );
    }
    return `Allow-Origin: ${allowOrigin}`;
  },
);

await check('uploadBuffer từ server', async () => {
  const uploaded = await storage.uploadBuffer({
    kind: 'cover',
    contentType: 'image/png',
    body: Buffer.from('auralis-r2-check'),
  });
  createdKeys.push(uploaded.key);
  return uploaded.publicUrl;
});

await check('Dọn file test (deleteObject)', async () => {
  await Promise.all(createdKeys.map((key) => storage.deleteObject(key)));
  return `đã xóa ${createdKeys.length} file`;
});

console.log(`\nKiểm tra R2: bucket "${config.bucket}"\n`);
for (const { name, ok, detail } of checks) {
  console.log(`${ok ? '✓' : '✗'} ${name}\n    ${detail}`);
}
const failed = checks.filter((c) => !c.ok).length;
console.log(
  failed
    ? `\n${failed}/${checks.length} mục lỗi`
    : `\nTất cả ${checks.length} mục đều đạt`,
);
process.exit(failed ? 1 : 0);
