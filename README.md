<p align="center">
  <img src="docs/assets/auralis-logo.webp" alt="Auralis" width="320" />
</p>

# Auralis – Trạm Thanh Âm & Cảm Xúc

Nền tảng Blog tản văn & Radio/Podcast cộng đồng thế hệ mới: AI chuyển văn bản thành giọng đọc truyền cảm,
giao diện kể chuyện tương tác chiều sâu không gian (Spatial UI) và phòng phát thanh nghe chung theo thời gian thực.

## Kiến trúc

| Phân hệ | Công nghệ |
| --- | --- |
| `auralis-web` | Next.js (App Router + ISR), TailwindCSS, Shadcn/UI, Framer Motion, Zustand, Howler.js / Web Audio API |
| `auralis-api` | NestJS, Prisma ORM, Socket.io, Redis (Upstash) |
| `auralis-audio-ai` | Python FastAPI, edge-tts, VoiceStudio Local API, pydub + FFmpeg |
| Lưu trữ | PostgreSQL + Cloudflare R2 |

## Chạy local

Yêu cầu: Node.js ≥ 22, pnpm 10, [uv](https://docs.astral.sh/uv/) (Python 3.11), Docker.

```bash
cp .env.example .env
pnpm install
pnpm db:up                                  # PostgreSQL :5432 + Redis :6379
cp auralis-api/.env.example auralis-api/.env
pnpm db:migrate                             # áp migration Prisma
pnpm db:seed                                # dữ liệu mẫu (chuyên mục, 5 số Radio)
(cd auralis-audio-ai && uv sync)
```

Để có đủ tính năng Giai đoạn 4 (Radio AI qua hàng đợi), chạy cả 3 dịch vụ cùng PostgreSQL + Redis.

### Tài khoản mẫu (chỉ dùng ở môi trường local, tạo bởi `pnpm db:seed`)

| Vai trò | Tên đăng nhập | Mật khẩu |
| --- | --- | --- |
| Quản trị | `admin` | `auralis-admin` |
| Biên tập viên | `bientap` | `auralis-editor` |
| Tác giả | `auralis` | `auralis-tacgia` |
| Cộng tác viên giọng đọc | `giongdoc` | `auralis-giongdoc` |

| Lệnh | Dịch vụ | Địa chỉ |
| --- | --- | --- |
| `pnpm dev:web` | Next.js | http://localhost:3000 (cần API chạy để có dữ liệu) |
| `pnpm dev:api` | NestJS | http://localhost:4000/api/health |
| `pnpm dev:audio` | FastAPI | http://localhost:8000/api/v1/health |

Kiểm thử: `pnpm build`, `pnpm lint`, `pnpm test`, `cd auralis-audio-ai && uv run pytest`.

## Docker

```bash
# Toàn bộ backend (PostgreSQL, Redis, API, audio-ai) – cần JWT_SECRET và AUDIO_AI_API_KEY trong .env
docker compose -f docker-compose.full.yml up -d --build
```

## Quy trình nhánh

- `main` — nhánh ổn định, chỉ nhận merge từ `develop`.
- `develop` — nhánh phát triển, commit trực tiếp.

## Tài liệu

- [Lộ trình triển khai](docs/ROADMAP.md)
- [Thiết kế cơ sở dữ liệu](docs/DATABASE.md)
- [Lưu trữ Cloudflare R2](docs/STORAGE.md)
- [API & sự kiện Socket.io](docs/API.md)
- [Triển khai Production](docs/DEPLOYMENT.md)
