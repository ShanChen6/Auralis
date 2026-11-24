# Thiết kế cơ sở dữ liệu Auralis

Schema: [`auralis-api/prisma/schema.prisma`](../auralis-api/prisma/schema.prisma) · Migration: `auralis-api/prisma/migrations/`

PostgreSQL 17 + Prisma 7 (driver adapter `@prisma/adapter-pg`). Tên bảng/cột trong DB dùng `snake_case`, model Prisma dùng `camelCase`. Khóa chính là UUID v7 (tăng dần theo thời gian, nên chèn vào B-tree ít bị phân mảnh).

## Các bảng

| Bảng | Vai trò |
| --- | --- |
| `users` | Thính giả, tác giả/CTV lồng tiếng, biên tập viên, admin (`role`) |
| `categories` | Chuyên mục, sắp xếp theo `sort_order` |
| `posts` | **Chỉ metadata nhẹ** cho trang chủ, danh sách, carousel: tiêu đề, slug, tóm tắt, ảnh bìa, audio, thời lượng, tâm trạng, trạng thái, lượt xem/nghe, giọng đọc, nhạc nền |
| `post_contents` | Văn bản dài (`content`) + `timestamps` (JSONB) cho chữ chạy karaoke, quan hệ 1-1 với `posts` |
| `playlists`, `playlist_items` | Danh sách phát của người dùng, có thứ tự `position` |
| `comments` | Bình luận, trả lời qua `parent_id` |
| `live_rooms` | Phòng nghe chung: `current_post_id` + `started_at` để tính `currentTimestamp = now - startedAt` |

Vì sao tách `posts` / `post_contents`: các truy vấn danh sách chỉ đọc hàng nhỏ, nên trang dữ liệu và cache chứa được nhiều bài hơn. Văn bản dài chỉ được đọc ở trang chi tiết. Một số cột dành sẵn cho các giai đoạn sau: `audio_source`/`audio_status` (Creator Studio, bài `TEXT_ONLY`), `narrator_id` (CTV lồng tiếng) và `reviewer_id`/`reject_reason` (kiểm duyệt).

## Index

| Truy vấn | Index |
| --- | --- |
| Bài mới nhất | `posts(status, published_at DESC)` |
| Lọc theo tâm trạng / chuyên mục | `posts(status, mood_tag, published_at DESC)`, `posts(status, category_id, published_at DESC)` |
| Nghe nhiều / xem nhiều | `posts(status, listen_count DESC)`, `posts(status, view_count DESC)` |
| Carousel "Số Radio nổi bật" | partial index `posts(published_at DESC) WHERE is_featured AND status = 'PUBLISHED'` |
| Trang tác giả, hàng chờ duyệt | `posts(author_id, created_at DESC)`, `posts(status, created_at)` |
| Full-text search | GIN trên `posts.search_vector` |
| Tìm tiêu đề gần đúng | GIN trigram trên `immutable_unaccent(lower(title))` |

## Tìm kiếm tiếng Việt

PostgreSQL không có từ điển tiếng Việt, nên ta dùng cấu hình `simple` kết hợp **bỏ dấu** (extension `unaccent`). Nhờ đó gõ "mua dem" vẫn ra "Trạm đêm mưa".

- `search_vector` là **generated column** (tiêu đề trọng số A, tóm tắt trọng số B), Postgres tự cập nhật. Phần này viết bằng SQL tùy chỉnh trong migration `init`. Schema Prisma khai báo cột là `Unsupported("tsvector")` với `@default(dbgenerated())` để `migrate dev` không sinh thay đổi thừa.
- Hàm `immutable_unaccent(text)` bọc `unaccent` thành IMMUTABLE để dùng được trong generated column và index.

Ví dụ (dùng qua `prisma.$queryRaw`):

```sql
-- Full-text, xếp theo độ liên quan
SELECT id, title, ts_rank(search_vector, q) AS rank
FROM posts, plainto_tsquery('simple', immutable_unaccent(lower($1))) q
WHERE status = 'PUBLISHED' AND search_vector @@ q
ORDER BY rank DESC
LIMIT 20;

-- Tìm theo một phần tiêu đề (dùng index trigram)
SELECT id, title FROM posts
WHERE immutable_unaccent(lower(title)) ILIKE '%' || immutable_unaccent(lower($1)) || '%';
```

## Lệnh

```bash
pnpm db:up        # PostgreSQL + Redis (Docker)
pnpm db:migrate   # prisma migrate dev
pnpm db:seed      # 5 chuyên mục, 1 tác giả, 5 số Radio nổi bật
pnpm db:studio    # Prisma Studio
```
