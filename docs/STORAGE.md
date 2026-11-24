# Lưu trữ Cloudflare R2

Module: [`auralis-api/src/storage/`](../auralis-api/src/storage/) (dùng `@aws-sdk/client-s3`, vì R2 tương thích S3)

## Luồng tải file từ trình duyệt (Presigned URL)

```
Frontend ──POST /api/storage/presigned-upload──▶ NestJS   (kiểm tra loại, MIME, dung lượng)
Frontend ◀── { uploadUrl, headers, key, publicUrl } ──┘
Frontend ──PUT uploadUrl (file + headers)──▶ Cloudflare R2   (không đi qua server)
Frontend ── lưu publicUrl vào bài viết ──▶ NestJS
```

Request:

```json
{ "kind": "audio", "contentType": "audio/mpeg", "contentLength": 7340032 }
```

Response (201):

```json
{
  "uploadUrl": "https://auralis-media.<account>.r2.cloudflarestorage.com/audio/2026/11/<uuid>.mp3?X-Amz-...",
  "method": "PUT",
  "headers": { "Content-Type": "audio/mpeg" },
  "key": "audio/2026/11/<uuid>.mp3",
  "publicUrl": "https://cdn.example.com/audio/2026/11/<uuid>.mp3",
  "expiresIn": 600
}
```

`Content-Type` và `Content-Length` được **ký vào URL**. Nếu client PUT file khác định dạng hoặc khác dung lượng đã khai báo, R2 sẽ từ chối.

| `kind` | MIME cho phép | Tối đa | Thư mục |
| --- | --- | --- | --- |
| `cover` | image/jpeg, image/png, image/webp, image/avif | 5MB | `covers/YYYY/MM/` |
| `audio` | audio/mpeg, audio/wav, audio/x-wav, audio/mp4, audio/aac | 50MB | `audio/YYYY/MM/` |

Mã lỗi: `400` (body sai), `415` (MIME không hỗ trợ), `413` (quá dung lượng), `503` (chưa cấu hình R2).

## Upload từ server

Các module khác inject `StorageService`:

```ts
const { key, publicUrl } = await storage.uploadBuffer({
  kind: 'audio',
  contentType: 'audio/mpeg',
  body: buffer,
  key: `audio/radio/${postId}.mp3`, // tùy chọn
});
```

File upload từ server có `Cache-Control: public, max-age=31536000, immutable`, vì key luôn là duy nhất.

## Cấu hình R2

1. Cloudflare Dashboard → R2 → tạo bucket (VD: `auralis-media`).
2. Bucket → Settings → **Custom Domain** (VD: `cdn.auralis.vn`) để có link CDN công khai. Có thể tạm dùng `r2.dev`.
3. R2 → **Manage API Tokens** → tạo token quyền *Object Read & Write* cho bucket, lấy Access Key ID / Secret.
4. Bucket → Settings → **CORS Policy**, cho phép trình duyệt PUT trực tiếp:

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://auralis.vn"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

5. Điền vào `auralis-api/.env`:

```
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=auralis-media
R2_PUBLIC_URL=https://cdn.auralis.vn
R2_PRESIGN_EXPIRES_IN=600
```

Khi thiếu biến `R2_*`, API vẫn khởi động bình thường, chỉ các endpoint storage trả `503`.

> ⚠️ Endpoint presigned-upload **chưa có xác thực**. Cần gắn AuthGuard khi làm đăng nhập (Giai đoạn 4).
