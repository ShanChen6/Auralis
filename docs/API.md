# API Auralis (NestJS)

Tất cả endpoint có tiền tố `/api`. Frontend gọi qua proxy `/backend/*` (Next.js rewrite), nên cookie đăng nhập là cookie first-party.

## Đăng nhập & phân quyền

Phiên đăng nhập là JWT (7 ngày) trong cookie httpOnly `auralis_session`. Có thể dùng `Authorization: Bearer <token>` thay cho cookie. Mật khẩu được băm bằng scrypt.

| Method | Đường dẫn | Mô tả |
| --- | --- | --- |
| POST | `/auth/register` | `{ email, username, displayName, password }`, tạo tài khoản vai trò `AUTHOR` |
| POST | `/auth/login` | `{ login (email hoặc username), password }` |
| POST | `/auth/logout` | Xóa cookie |
| GET | `/auth/me` | Người dùng hiện tại |
| GET | `/auth/socket-token` | Token 5 phút để kết nối Socket.io |

Vai trò: `LISTENER`, `AUTHOR` (mặc định khi đăng ký), `EDITOR`, `ADMIN`.

| Quyền | Người dùng (`AUTHOR`, `LISTENER`) | Ban biên tập (`EDITOR`, `ADMIN`) |
| --- | --- | --- |
| Đăng bài chữ | ✓ tối đa `POST_DAILY_LIMIT` bài/ngày (mặc định 5) và 3 bài/phút | ✓ không giới hạn |
| Tạo audio: Radio AI, tải bản thu, lồng tiếng | ✗ (403) | ✓ |
| Xin URL upload `kind: "audio"` | ✗ (403); ảnh bìa vẫn được | ✓ |
| Kiểm duyệt `/admin/*`, `/narrations/*` | ✗ (403) | ✓ |

## Bài viết công khai

| Method | Đường dẫn | Mô tả |
| --- | --- | --- |
| GET | `/posts/featured?limit=5` | Số Radio nổi bật |
| GET | `/posts?mood=&category=&limit=&cursor=` | Danh sách đã xuất bản, phân trang bằng cursor |
| GET | `/posts/:slug` | Chi tiết: `paragraphs` và `timestamps` |
| GET | `/categories` | Danh sách chuyên mục |

## Creator Studio (cần đăng nhập)

| Method | Đường dẫn | Mô tả |
| --- | --- | --- |
| POST | `/storage/presigned-upload` | `{ kind: "audio" \| "cover", contentType, contentLength }`, trả về URL để PUT file lên R2 (audio: chỉ ban biên tập) |
| POST | `/studio/posts` | Tạo bài ở trạng thái `PENDING`. Người dùng thường bỏ trống `audio` (chỉ đăng chữ) |
| GET | `/studio/posts` | Bài của tôi, kèm `status`, `audioStatus`, `rejectReason` |
| GET | `/studio/quota` | `{ limit, used, remaining, canCreateAudio }` (ban biên tập: `limit` = `null`) |
| POST | `/studio/posts/:id/retry-audio` | Tạo lại Radio AI khi lần trước lỗi (`FAILED`), chỉ ban biên tập |

`audio` có 3 dạng (2 dạng đầu chỉ dành cho ban biên tập):

```jsonc
{ "mode": "upload", "audioUrl": "<publicUrl từ presigned-upload>", "duration": 41.2 } // tự thu âm
{ "mode": "ai", "voice": "female_warm" | "male_deep" | "studio", "music": "piano_rain" | "lofi_warm" | "acoustic_night" | null }
{ "mode": "none" } // chỉ đăng chữ (mặc định), ban biên tập tạo giọng đọc sau
```

- **Radio AI:** bài được đưa vào hàng đợi BullMQ (Redis). Worker gọi `auralis-audio-ai` `POST /api/v1/generate-radio`, rồi cập nhật `audioUrl`, `duration`, `timestamps`. `audioStatus` đi theo `PROCESSING → READY`, hoặc `FAILED` sau 2 lần thử.
- **Tự thu âm:** `timestamps` được ước lượng theo độ dài từng đoạn văn.
- **Khi chưa cấu hình R2:** `presigned-upload` trả về URL tới chính API (`PUT /storage/local-upload?...`, ký HMAC, hết hạn sau 10 phút), và file được phục vụ ở `/media/...`.

## Kiểm duyệt (`EDITOR` / `ADMIN`)

| Method | Đường dẫn | Mô tả |
| --- | --- | --- |
| GET | `/admin/stats` | `{ pendingPosts, submittedNarrations }` |
| GET | `/admin/posts?status=PENDING` | Danh sách theo trạng thái |
| PATCH | `/admin/posts/:id/approve` | `{ moodTag?, isFeatured? }`, chuyển `PENDING → PUBLISHED` |
| PATCH | `/admin/posts/:id/reject` | `{ reason }`, chuyển sang `REJECTED`; tác giả thấy lý do trong Studio |
| PATCH | `/admin/posts/:id` | `{ moodTag?, isFeatured? }` |
| POST | `/admin/posts/:id/audio` | Tạo hoặc thay giọng đọc: `{ mode: "ai", voice, music }` hoặc `{ mode: "upload", audioUrl, duration }` |
| GET | `/admin/narrations?status=SUBMITTED` | Bản lồng tiếng chờ duyệt |
| PATCH | `/admin/narrations/:id/approve` | Gắn audio và CTV vào bài; các bản khác của bài đó bị từ chối |
| PATCH | `/admin/narrations/:id/reject` | `{ reason }` |

## Lồng tiếng (chỉ ban biên tập)

| Method | Đường dẫn | Mô tả |
| --- | --- | --- |
| GET | `/narrations/open` | Bài đã xuất bản nhưng chỉ có chữ |
| GET | `/narrations/mine` | Lượt nhận lồng tiếng của tôi |
| POST | `/narrations` | `{ postId }`, nhận lồng tiếng |
| POST | `/narrations/:id/submit` | `{ audioUrl, duration, note? }`, nộp bản thu |
| POST | `/narrations/:id/withdraw` | Rút lui |

## Phòng nghe chung

REST: `GET /live-rooms`, `GET /live-rooms/:slug`.

Socket.io namespace `/live`. Nếu muốn chat, client gửi `auth: { token }` (lấy từ `/auth/socket-token`) khi kết nối. Chỉ nghe thì không cần đăng nhập.

| Sự kiện (client → server) | Payload | Phản hồi (ack) |
| --- | --- | --- |
| `join_room` | `{ slug }` | Trạng thái phòng: `track`, `startedAt`, `serverTime`, `endsAt`, `listeners`, `messages`, `me` |
| `sync` | — | `{ postId, startedAt, serverTime }` |
| `send_message` | `{ text }` (≤ 300 ký tự, tối đa 1 tin/giây) | `{ ok }` |
| `send_reaction` | `{ type: "heart" \| "tea" \| "star" }` | `{ ok }` |
| `leave_room` | — | `{ ok }` |

| Sự kiện (server → client) | Payload |
| --- | --- |
| `track_changed` | `{ track, nextTrack, startedAt, endsAt, serverTime }` |
| `presence` | `{ listeners }` |
| `message` | `{ id, text, at, user: { username, displayName } }` |
| `reaction` | `{ id, type }` |
| `exception` | `{ status: "error", message }` |

**Đồng bộ tiến độ nghe:**
- Máy chủ lưu `startedAt` của số Radio đang phát. Playlist của phòng phát lần lượt và lặp lại (`resolvePlayback`).
- Khi vào phòng, client đo thời gian khứ hồi (RTT) và tính độ lệch đồng hồ: `offset = serverTime + RTT/2 − lúc nhận`.
- Vị trí phát = `(now + offset − startedAt) / 1000`.
- Client kiểm tra lệch mỗi 5 giây (lệch quá 1 giây thì tua lại) và gọi `sync` mỗi 30 giây.
- Thử nghiệm với 2 trình duyệt cho thấy hai người nghe chỉ lệch nhau khoảng 0,02 giây.

Phòng chỉ hẹn giờ chuyển bài khi còn người nghe. Lịch sử chat (50 tin gần nhất) và số người nghe được giữ trong bộ nhớ của tiến trình. Khi chạy nhiều instance, cần dùng Socket.io Redis adapter (Giai đoạn 5).
