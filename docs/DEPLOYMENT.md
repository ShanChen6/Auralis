# Triển khai Auralis lên Production

| Thành phần | Nền tảng đề xuất | Ghi chú |
| --- | --- | --- |
| `auralis-web` (Next.js) | **Vercel** | ISR / Cache Components, proxy `/backend/*` tới API |
| `auralis-api` (NestJS) | **Render** hoặc Railway | Dockerfile `auralis-api/Dockerfile`, cần hỗ trợ WebSocket |
| `auralis-audio-ai` (FastAPI) | **Hugging Face Spaces** (Docker, CPU) hoặc Render | Dockerfile `auralis-audio-ai/Dockerfile`, cổng 7860 |
| PostgreSQL | **Supabase** hoặc **Neon** | Bật connection pooling |
| Redis | **Upstash** | Cache, rate limit, quota, hàng đợi BullMQ |
| File ảnh / MP3 | **Cloudflare R2** + custom domain | Xem [STORAGE.md](STORAGE.md) |

## Thứ tự triển khai

1. **Cloudflare R2:** tạo bucket, gắn custom domain (VD: `cdn.auralis.vn`), tạo API token, cấu hình CORS (chi tiết trong `docs/STORAGE.md`). Sau đó kiểm tra bằng `pnpm r2:check`.
2. **PostgreSQL:**
   - **Supabase:** Project Settings → Database. Dùng chuỗi *Transaction pooler* (cổng `6543`) cho `DATABASE_URL` và chuỗi *Direct connection* (cổng `5432`) cho `DIRECT_URL`.
   - **Neon:** dùng endpoint có hậu tố `-pooler` cho `DATABASE_URL` và endpoint thường cho `DIRECT_URL`.
   - Migration chạy qua `DIRECT_URL`, còn ứng dụng chạy qua pooler (PgBouncer) để chịu được nhiều kết nối đồng thời.
3. **Upstash Redis:** tạo database (chọn region gần API). Dùng chuỗi `rediss://default:<password>@<host>:6379` cho `REDIS_URL`.
4. **auralis-audio-ai trên Hugging Face Spaces:**
   - Tạo Space, chọn SDK **Docker** (CPU Basic là đủ).
   - Đẩy nội dung thư mục `auralis-audio-ai/` lên repo của Space, và thay `README.md` bằng `deploy/huggingface/README.md` (có sẵn `app_port: 7860`).
   - Đặt các biến trong Settings → Variables and secrets.
   - URL dịch vụ có dạng `https://<user>-<space>.hf.space`.
5. **auralis-api trên Render:** New → Blueprint → chọn repo (dùng `render.yaml`), rồi điền các biến bên dưới.
   - Khi khởi động, container tự chạy `prisma migrate deploy`. Nếu muốn dùng Pre-Deploy Command riêng thì đặt `RUN_MIGRATIONS=false`.
   - Gói Free của Render sẽ ngủ sau 15 phút không có truy cập, làm WebSocket và hàng đợi bị gián đoạn. Nên dùng gói Starter trở lên.
6. **auralis-web trên Vercel:** Import repo, đặt *Root Directory* = `auralis-web` (Vercel tự nhận pnpm workspace), rồi điền các biến bên dưới.
7. **Seed (tùy chọn):** chỉ tạo chuyên mục. Không chạy `pnpm db:seed` trên production, vì seed chứa tài khoản mẫu với mật khẩu công khai.

## Biến môi trường

### auralis-web (Vercel)

| Biến | Ví dụ | Mô tả |
| --- | --- | --- |
| `API_URL` | `https://auralis-api.onrender.com/api` | Server components và proxy `/backend/*` |
| `NEXT_PUBLIC_SOCKET_URL` | `https://auralis-api.onrender.com` | Socket.io (phòng nghe chung) |
| `REVALIDATE_SECRET` | chuỗi ngẫu nhiên ≥ 32 ký tự | Phải trùng với API |

### auralis-api (Render / Railway)

| Biến | Ví dụ | Bắt buộc |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql://…:6543/postgres?pgbouncer=true` (Supabase pooler) | ✓ |
| `DIRECT_URL` | `postgresql://…:5432/postgres` | ✓ (cho migration) |
| `REDIS_URL` | `rediss://default:…@….upstash.io:6379` | ✓ |
| `REDIS_KEY_PREFIX` | `auralis:prod:` | nên đặt nếu dùng chung Redis với staging |
| `JWT_SECRET` | ≥ 32 ký tự ngẫu nhiên | ✓ (thiếu thì API không khởi động) |
| `WEB_ORIGIN` | `https://auralis.vn` | ✓ (CORS + Socket.io) |
| `WEB_URL` | `https://auralis.vn` | ✓ (gọi `/api/revalidate`) |
| `REVALIDATE_SECRET` | trùng với web | ✓ |
| `API_PUBLIC_URL` | `https://auralis-api.onrender.com` | |
| `AUDIO_AI_URL` | `https://<user>-<space>.hf.space` | ✓ |
| `AUDIO_AI_API_KEY` | trùng với audio-ai | ✓ |
| `AUDIO_AI_TIMEOUT_MS` | `900000` | |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL` | | ✓ |
| `STORAGE_LOCAL_FALLBACK` | `false` | đặt `false` ở production |
| `POST_DAILY_LIMIT` | `5` | Số bài người dùng thường được đăng mỗi ngày |
| `RATE_LIMIT_PER_MINUTE` | `120` | |
| `TRUST_PROXY` | `2` | Số proxy phía trước: Render (1) + Vercel rewrite (1) |
| `RADIO_MAX_WORDS` | `3000` | |
| `VOICESTUDIO_VOICE` | `auralis-studio` | |

### auralis-audio-ai (Hugging Face Spaces / Render)

| Biến | Ví dụ | Bắt buộc |
| --- | --- | --- |
| `AUDIO_AI_API_KEY` | trùng với API | ✓ |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL` | | ✓ |
| `CORS_ORIGINS` | `["https://auralis.vn"]` | |
| `VOICESTUDIO_URL` | `https://voicestudio.<tunnel>.trycloudflare.com` | nếu dùng giọng Studio qua Cloudflare Tunnel |
| `RADIO_MAX_WORDS`, `RADIO_MAX_CONCURRENT` | `3000`, `2` | |

## Hiệu năng

- **Trang công khai:** dữ liệu được cache theo giờ bằng `'use cache'` và làm mới **ngay khi biên tập viên duyệt hoặc sửa bài** (On-Demand ISR qua `POST /api/revalidate`). Đo ở môi trường local, trang chi tiết đã cache trả về trong khoảng 3 ms.
- **API:** dùng Redis cache cho số nổi bật, danh sách, chi tiết, chuyên mục và xếp hạng tuần (TTL 10 phút). Toàn bộ cache được xóa bằng cách tăng phiên bản khi nội dung thay đổi.
- **Xếp hạng tuần:** lượt nghe được đếm vào Redis (chống đếm lặp trong 1 giờ), xếp hạng theo tuần ISO giờ Việt Nam.

## Bảo mật

- Rate limit (Redis, dùng chung nhiều instance): mặc định 120 request/phút cho mỗi người dùng hoặc IP; đăng nhập và đăng ký tối đa 10 lần/phút.
- **Phân quyền tạo âm thanh:** chỉ biên tập viên và quản trị viên được tạo audio (Radio AI, tải bản thu, lồng tiếng). Người dùng thường chỉ đăng bài chữ, tối đa `POST_DAILY_LIMIT` bài/ngày (mặc định 5, reset 0h giờ Việt Nam) và 3 bài/phút. Kịch bản tối đa 3.000 từ.
- Upload: ảnh bìa ≤ 5MB, MP3 ≤ 50MB, kiểm tra MIME; `Content-Type` và `Content-Length` được ký vào Presigned URL.
- Header bảo mật bằng `helmet`, cookie phiên `httpOnly` + `SameSite=Lax` + `Secure` ở production. Dịch vụ audio-ai yêu cầu `X-API-Key`.

## Kiểm tra sau khi deploy

- [ ] `GET <API>/api/health` và `GET <AUDIO_AI>/api/v1/health` trả `ok`; `storage` của audio-ai là `r2`.
- [ ] `pnpm r2:check` (chạy với biến của production) đạt đủ 9/9 mục.
- [ ] Đăng ký → viết bài Radio AI → bài chuyển sang `READY` → biên tập viên duyệt → trang chủ cập nhật ngay.
- [ ] Phòng nghe chung: mở 2 thiết bị, kiểm tra cùng tiến độ, chat và thả cảm xúc.
- [ ] Thử trên **iOS Safari** và **Android Chrome**: phát nhạc nền khi khóa màn hình (Media Session), hẹn giờ tắt, mini-player không che nội dung.
- [ ] Lighthouse (mobile) cho trang chủ và trang chi tiết.

## Giới hạn hiện tại

- Lịch sử chat (50 tin) và số người nghe trong phòng live được giữ trong bộ nhớ của **một** instance API. Nếu muốn chạy nhiều instance, cần thêm `@socket.io/redis-adapter`.
- Image `auralis-audio-ai` khoảng 1 GB (phần lớn là ffmpeg), `auralis-api` khoảng 840 MB (gồm Prisma CLI để chạy migration).
