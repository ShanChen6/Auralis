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

## Quy trình nhánh

- `main` — nhánh ổn định, chỉ nhận merge từ `develop`.
- `develop` — nhánh phát triển, commit trực tiếp.

## Tài liệu

- [Lộ trình triển khai](docs/ROADMAP.md)
