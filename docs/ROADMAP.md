# LỘ TRÌNH TRIỂN KHAI DỰ ÁN: AURALIS – TRẠM THANH ÂM & CẢM XÚC

## 1. Tổng quan, Nhận diện & Kiến trúc hệ thống
- **Tên dự án:** Auralis – Trạm Thanh Âm & Cảm Xúc
- **Định vị sản phẩm:** Nền tảng Blog tản văn & Radio/Podcast cộng đồng thế hệ mới, kết hợp công nghệ AI chuyển thể văn bản thành giọng đọc truyền cảm tự động, giao diện kể chuyện tương tác chiều sâu không gian (Spatial UI) và phòng phát thanh nghe chung theo thời gian thực.
- **Hệ thống Nhận diện & Giao diện (Design System - Xu hướng 2026):**
  - **Phong cách chủ đạo:** Minimalism + Calm UI + Liquid Glass + Spatial Carousel (Băng chuyền chiều sâu không gian) & Interactive Storytelling (Kể chuyện tương tác đồng bộ chữ – âm thanh).
  - **Bảng mã màu (Color Palette):**
    - Nền chính (Dark Mode): Midnight Indigo (`#0B0F19`) | Light Mode: Warm Paper (`#FAF8F5`)
    - Bề mặt thẻ / Kính mờ (Surface): Deep Slate (`#131A2A` kèm `backdrop-blur-xl`)
    - Màu nhấn chính (Primary Accent): Warm Amber (`#F59E0B`)
    - Màu nhấn phụ (Secondary Accent): Soft Lavender (`#A78BFA`)
    - Chữ chính / Chữ phụ: Warm Ivory (`#F8FAFC`) / Cool Gray (`#94A3B8`)
- **Kiến trúc kỹ thuật (Tech Stack):**
  - **Frontend:** Next.js (App Router + ISR), TailwindCSS, Shadcn/UI, Framer Motion, Zustand, Howler.js / Web Audio API.
  - **Backend Web & Real-time:** Node.js (NestJS), Prisma ORM, Socket.io, Redis (Upstash).
  - **AI & Audio Pipeline (Hybrid TTS):** Python (FastAPI), `edge-tts` (Online 24/7), `VoiceStudio` Local API (Nhân bản giọng Studio), `pydub` + `FFmpeg` (Hậu kỳ âm thanh).
  - **Lưu trữ chịu tải lớn:** PostgreSQL (tách bảng tối ưu hàng trăm nghìn bài viết) + **Cloudflare R2** (Object Storage + CDN miễn phí băng thông).

---

## 2. Lộ trình triển khai chi tiết (10 Tuần)

### GIAI ĐOẠN 1: Kiến trúc Database Chịu tải lớn & Lưu trữ Cloudflare R2 (Tuần 1 – Tuần 2)
*Mục tiêu: Xây dựng hạ tầng lưu trữ hàng trăm nghìn bài blog không giật lag và kết nối Cloudflare R2 để lưu ảnh bìa/file MP3 miễn phí băng thông.*

- [x] **Task 1.1: Khởi tạo Monorepo / 3 Phân hệ**
  - Khởi tạo `auralis-web` (Next.js), `auralis-api` (NestJS), và `auralis-audio-ai` (Python FastAPI).
  - Cấu hình Docker Compose chạy PostgreSQL và Redis local.
- [ ] **Task 1.2: Thiết kế Database Tách lớp (`schema.prisma`)**
  - Tách riêng bảng `Posts` (chỉ chứa metadata nhẹ: `id`, `title`, `slug`, `summary`, `coverUrl`, `audioUrl`, `duration`, `moodTag`, `status`, `createdAt`) và bảng `PostContents` (chứa cột `content` văn bản dài và `timestampsJson` phục vụ chạy chữ Karaoke).
  - Thiết kế các bảng phụ trợ: `Users` (Thính giả, Tác giả, Admin), `Categories`, `Playlists`, `Comments`, và `LiveRooms`.
  - Tạo Index tối ưu cho tìm kiếm toàn văn (Full-Text Search) và lọc nhanh theo tâm trạng/chuyên mục.
- [ ] **Task 1.3: Tích hợp Cloudflare R2 Storage Service**
  - Viết module lưu trữ trong NestJS dùng `@aws-sdk/client-s3` kết nối Cloudflare R2.
  - Xây dựng API cấp Presigned URL để tải ảnh bìa và file âm thanh trực tiếp lên CDN mà không làm nghẽn băng thông server.

#### Prompt triển khai Giai đoạn 1:
```text
Đóng vai trò là Kiến trúc sư Cơ sở dữ liệu và Backend Developer (NestJS + Prisma + PostgreSQL). Hãy giúp tôi thiết kế hệ thống lưu trữ cho nền tảng Blog & Radio cộng đồng tên là "Auralis" có khả năng chứa hàng trăm nghìn bài viết mà vẫn truy vấn nhanh.

Yêu cầu kỹ thuật:
1. Viết file `schema.prisma` hoàn chỉnh với các bảng: `Users` (tác giả/thính giả/admin), `Categories`, `Posts` (chỉ chứa metadata hiển thị trang chủ: id, title, slug, summary, coverUrl, audioUrl, duration, moodTag, viewCount, status, createdAt), `PostContents` (tách riêng chứa cột `content` văn bản dài và `timestamps` JSON quan hệ 1-1 với `Posts`), `Playlists`, `Comments`, và `LiveRooms`.
2. Bổ sung chỉ mục (Index) tối ưu cho tìm kiếm tiêu đề, lọc theo tâm trạng/chuyên mục và sắp xếp bài viết mới/nhiều lượt nghe nhất.
3. Viết một Service hoàn chỉnh trong NestJS sử dụng `@aws-sdk/client-s3` để kết nối với **Cloudflare R2**, bao gồm hàm tạo Presigned URL cho phép Frontend tải ảnh bìa/file MP3 lên trực tiếp và hàm nhận file buffer từ server để upload lên R2 trả về link CDN công khai.
```

---

### GIAI ĐOẠN 2: Xây dựng Hybrid TTS Pipeline & Hậu kỳ Radio Tự động (Tuần 3 – Tuần 4)
*Mục tiêu: Kết hợp tốc độ siêu nhẹ của `edge-tts` (chạy online 24/7) và chất lượng cảm xúc của `VoiceStudio` (nhân bản giọng Studio) qua một lõi hậu kỳ âm thanh chung.*

- [ ] **Task 2.1: Xây dựng Lõi Tạo Giọng Đọc Đa Chế Độ (Strategy Pattern)**
  - **Chế độ Nhanh (`engine="edge"`):** Tích hợp `edge-tts` (`vi-VN-HoaiMyNeural`, `vi-VN-NamMinhNeural`), tự động tách câu theo dấu chấm/phẩy/xuống dòng để chèn khoảng lặng tự nhiên (`600ms`) và điều chỉnh nhịp đọc trầm ấm (`rate="-5%"`).
  - **Chế độ Studio (`engine="voicestudio"`):** Viết adapter gọi Local API của **VoiceStudio** (`localhost:3900` hoặc qua Cloudflare Tunnel) để xuất giọng đọc nhân bản cảm xúc cao cho các số Radio đặc biệt.
- [ ] **Task 2.2: Lõi Hậu Kỳ Âm Thanh Chuẩn Radio (`pydub` + `FFmpeg`)**
  - Tạo kho nhạc nền mẫu (`piano_rain.mp3`, `lofi_warm.mp3`, `acoustic_night.mp3`).
  - Lập trình hiệu ứng **Auto-ducking**: 3 giây Intro nhạc dạo đầu lớn (`-6dB`), tự động hạ nhỏ nhạc nền (`-18dB`) khi giọng đọc MC cất lên, và tăng nhạc kèm `fade_out` ở 4 giây Outro cuối bài.
  - Xuất kèm dữ liệu mốc thời gian từng đoạn văn (`timestamps`) để Frontend đồng bộ chữ.
- [ ] **Task 2.3: Đóng gói API FastAPI & Upload R2**
  - Xây dựng endpoint `POST /api/v1/generate-radio` nhận kịch bản, tự động hậu kỳ, đẩy file MP3 thành phẩm lên Cloudflare R2 và trả về `audioUrl`, `duration`, `timestamps`.

#### Prompt triển khai Giai đoạn 2:
```text
Đóng vai trò là Kỹ sư AI & Xử lý Âm thanh (Python FastAPI). Hãy xây dựng cho tôi một Microservice hoàn chỉnh theo kiến trúc Hybrid TTS để chuyển đổi kịch bản Blog tiếng Việt thành file Radio MP3 chuyên nghiệp cho dự án "Auralis".

Yêu cầu kỹ thuật:
1. Áp dụng Strategy Pattern hỗ trợ 2 chế độ `engine`:
   - `engine="edge"`: Sử dụng `edge-tts` (`vi-VN-HoaiMyNeural` và `vi-VN-NamMinhNeural`), tách câu thông minh để chèn khoảng lặng tự nhiên (600ms) và chỉnh tốc độ chậm rãi (`rate="-5%"`).
   - `engine="voicestudio"`: Gọi HTTP POST tới Local API của VoiceStudio (`http://localhost:3900`) để lấy giọng đọc nhân bản chất lượng cao (có cơ chế fallback tự động về `edge-tts` nếu không kết nối được).
2. Sử dụng `pydub` (FFmpeg) để trộn giọng đọc thô với file nhạc nền không lời (`piano.mp3`, `lofi.mp3`, `rain.mp3`): tạo 3 giây Intro nhạc lớn (-6dB), tự động hạ nhỏ nhạc nền (-18dB) khi có giọng đọc (Auto-ducking), và tăng nhạc kèm hiệu ứng `fade_out` ở 4 giây Outro cuối bài.
3. Xuất kèm mảng JSON `timestamps` ghi nhận giây bắt đầu và kết thúc của từng đoạn văn bản.
4. Đóng gói thành API `POST /api/v1/generate-radio`, sau khi xuất file MP3 hoàn chỉnh tự động đẩy lên Cloudflare R2 qua `boto3` và trả về `audioUrl`, `duration` và `timestamps`.
```

---

### GIAI ĐOẠN 3: Giao diện Hiện đại 2026 — Spatial Carousel & Interactive Storytelling (Tuần 5 – Tuần 7)
*Mục tiêu: Thiết kế giao diện Calm UI dịu mắt, băng chuyền số Radio chiều sâu không gian và trải nghiệm đọc – nghe tương tác đồng bộ.*

- [ ] **Task 3.1: Thiết lập Design System & Bảng màu Auralis**
  - Cấu hình TailwindCSS với bảng màu Midnight Indigo (`#0B0F19`), Deep Slate (`#131A2A`), Warm Amber (`#F59E0B`), Soft Lavender (`#A78BFA`) và cặp font chữ tiếng Việt (`Be Vietnam Pro` + `Lora`).
- [ ] **Task 3.2: Trang chủ Spatial Radio Carousel (Băng chuyền Chiều sâu Không gian)**
  - Sử dụng **Framer Motion** dựng băng chuyền 5 số Radio nổi bật: thẻ ở giữa sắc nét, phóng to nhẹ và tỏa ánh sáng hổ phách; các thẻ hai bên làm mờ dần (`blur`) tạo chiều sâu thị giác.
  - Xây dựng bảng chi tiết kính mờ (Liquid Glass) bên phải **"Trong số Radio này"**: tự động cập nhật mượt mà tên tác giả, giọng đọc AI/CTV, nhạc nền, trích đoạn và nút *"Phát trọn số này"* khi chuyển đổi thẻ ở trung tâm.
- [ ] **Task 3.3: Trình phát Âm thanh Xuyên suốt (Persistent Mini-Player)**
  - Dùng **Zustand** quản lý trạng thái trình phát cố định ở cạnh dưới màn hình (Play/Pause, tua thời gian, danh sách chờ Queue, và **Hẹn giờ tắt Sleep Timer: 15p, 30p, 60p**), đảm bảo âm thanh không bị ngắt khi chuyển trang.
- [ ] **Task 3.4: Trang Chi tiết Interactive Storytelling (Đọc & Nghe Đồng bộ)**
  - Đồng bộ tiến độ file audio với dữ liệu `timestamps`: tự động cuộn mượt và bôi sáng ấm đoạn văn bản MC đang đọc, làm mờ nhẹ các đoạn xung quanh.
  - Tích hợp **Bộ trộn Âm thanh Môi trường (Soundscape Mixer)** bằng Web Audio API cho phép người nghe bật thêm tiếng mưa rơi, lửa trại hoặc sóng biển chạy song song với số Radio.

#### Prompt triển khai Giai đoạn 3:
```text
Đóng vai trò là Senior Frontend Developer (Next.js App Router, TailwindCSS, Shadcn/UI, Framer Motion, Zustand). Hãy xây dựng giao diện cho nền tảng Blog & Radio "Auralis" theo phong cách **Minimalism + Calm UI + Spatial Carousel**.

Yêu cầu kỹ thuật:
1. Thiết lập bảng màu Dark Mode dịu mắt: nền `#0B0F19`, bề mặt kính mờ `#131A2A/80`, màu nhấn vàng hổ phách `#F59E0B`, chữ trắng ngà `#F8FAFC`.
2. Xây dựng component **SpatialRadioShowcase** cho trang chủ: bên trái là băng chuyền 5 thẻ số Radio có hiệu ứng chiều sâu (thẻ trung tâm sắc nét, tỏa sáng; các thẻ hai bên thu nhỏ và làm mờ `blur`), bên phải là bảng kính mờ **"Trong số Radio này"** tự động đồng bộ thông tin tác giả, giọng đọc, nhạc nền, trích đoạn và nút phát ngay khi người dùng chuyển thẻ.
3. Xây dựng **Persistent Mini Audio Player** cố định ở đáy màn hình bằng **Zustand** (hỗ trợ danh sách chờ Queue và tính năng **Hẹn giờ tắt Sleep Timer**), giữ âm thanh chạy liền mạch khi chuyển trang.
4. Xây dựng trang chi tiết bài Blog + Radio theo phong cách **Interactive Storytelling**: tự động bôi sáng đoạn văn tương ứng với giây đang phát của file audio và tích hợp thanh trượt trộn thêm âm thanh môi trường (tiếng mưa rơi, tiếng lửa trại).
```

---

### GIAI ĐOẠN 4: Cổng Sáng Tạo Cộng Đồng (UGC) & Phòng Nghe Chung Thời Gian Thực (Tuần 8 – Tuần 9)
*Mục tiêu: Xây dựng không gian sáng tạo nội dung cho cộng đồng (tác giả viết tản văn, cộng tác viên lồng tiếng hoặc tạo giọng đọc AI) và phòng phát thanh nghe chung theo thời gian thực qua Socket.io.*

- [ ] **Task 4.1: Xây dựng Cổng Sáng Tạo (Creator Studio)**
  - Thiết kế trình soạn thảo tản văn/truyện ngắn (Rich Text / Markdown Editor) hỗ trợ chia đoạn văn bản rõ ràng để đồng bộ thời gian phát.
  - Xây dựng 2 tùy chọn xuất bản âm thanh cho tác giả:
    1. **Tự thu âm & Tải lên:** Tải trực tiếp file `.mp3`/`.wav` cá nhân lên **Cloudflare R2** qua Presigned URL.
    2. **Tạo Radio AI Tự động:** Chọn giọng đọc (Nữ trầm ấm / Nam sâu lắng / Giọng Studio), chọn nhạc nền (*Piano mưa, Lo-fi ấm áp, Guitar mộc*) và gọi API sang dịch vụ FastAPI.
  - Lưu bài viết mới ở trạng thái `PENDING` (Chờ duyệt) kèm thông báo trạng thái cho tác giả.

- [ ] **Task 4.2: Hệ thống Kiểm duyệt Nội dung (Editorial & Admin Dashboard)**
  - Xây dựng màn hình quản trị dành cho Biên tập viên/Admin: Nghe thử bản audio, rà soát nội dung văn bản, chỉnh sửa thẻ tâm trạng (`moodTag`) và bấm duyệt xuất bản (`PENDING -> PUBLISHED`) hoặc từ chối kèm lý do.
  - Xây dựng tính năng ghép cặp cộng đồng: Cho phép một thành viên đăng bài viết chỉ có chữ (`TEXT_ONLY`) để các thành viên có giọng đọc hay đăng ký thu âm lồng tiếng cho bài viết đó.

- [ ] **Task 4.3: Phòng Nghe Chung Trực Tiếp (Live Radio Room với Socket.io)**
  - Xây dựng `LiveRoomGateway` trong NestJS quản lý các phòng phát thanh trực tiếp theo khung giờ hoặc chủ đề (VD: *"Trạm Đêm Mưa 22h"*, *"Góc Chữa Lành Cuối Tuần"*).
  - **Cơ chế Đồng bộ Tiến độ Nghe (Audio Sync):** Server lưu mốc thời gian bắt đầu phát (`startedAt`) của số Radio hiện tại trong phòng. Khi một thính giả mới bấm tham gia phòng, server tính toán `currentTimestamp = now - startedAt` và gửi về client để trình phát tự động tua đến đúng giây mọi người đang nghe.
  - Tích hợp khung trò chuyện trực tiếp (Live Chat) tối giản theo phong cách kính mờ (Liquid Glass) và hiệu ứng thả biểu tượng cảm xúc (tim, tách trà ấm, ngôi sao) bay nhẹ trên màn hình theo thời gian thực.

#### Prompt triển khai Giai đoạn 4 (Copy & Dán vào AI để sinh code):
```text
Đóng vai trò là Senior Fullstack Real-time Developer (NestJS + Socket.io + Next.js + TailwindCSS). Hãy xây dựng chi tiết 2 phân hệ cộng đồng cốt lõi cho nền tảng Blog & Radio "Auralis":

Yêu cầu kỹ thuật:
1. **Cổng Sáng Tạo (Creator Studio) & Kiểm duyệt:**
   - Viết component giao diện Next.js cho phép tác giả nhập tiêu đề, chọn thẻ tâm trạng (`moodTag`), soạn thảo nội dung tản văn và chọn 1 trong 2 cách tạo âm thanh: Upload file MP3 trực tiếp lên Cloudflare R2 hoặc bấm "Tạo Radio AI tự động" (gọi endpoint FastAPI `/api/v1/generate-radio`).
   - Viết các endpoint NestJS (`POST /posts`, `PATCH /posts/:id/approve`) quản lý luồng trạng thái bài viết từ `PENDING` sang `PUBLISHED` kèm Guard phân quyền Admin/Editor.

2. **Phòng Nghe Chung Trực Tiếp (Live Radio Room với Socket.io):**
   - Viết `LiveRoomGateway` hoàn chỉnh trong NestJS sử dụng Socket.io Rooms (`room_${roomId}`).
   - Lập trình cơ chế **Audio Sync**: Khi người dùng emit sự kiện `join_room`, server trả về `currentTrackUrl`, `startedAt` và `serverTime` để Frontend tính toán chính xác độ trễ và đồng bộ tiến độ phát audio của tất cả người nghe trong phòng.
   - Xây dựng sự kiện `send_message` (chat trực tiếp trong phòng) và `send_reaction` (bắn hiệu ứng biểu tượng cảm xúc real-time) kèm giao diện khung phòng nghe tối giản trên Next.js.
```

---

### GIAI ĐOẠN 5: Tối ưu Hiệu năng Tải Trang (ISR/Redis), Bảo mật & Triển khai Production (Tuần 10)
*Mục tiêu: Đảm bảo tốc độ mở bài blog/radio dưới 100ms khi lượng bài viết lên tới hàng trăm nghìn bài, kiểm soát chi phí vận hành và triển khai toàn bộ hệ thống lên Internet.*

- [ ] **Task 5.1: Tối ưu Tốc độ Đọc với Next.js ISR & Upstash Redis**
  - Cấu hình **ISR (Incremental Static Regeneration)** cho trang chi tiết số Radio (`/radio/[slug]`): tự động tạo trang tĩnh ở tầng Edge và chỉ tái tạo lại khi Admin cập nhật bài viết (On-Demand Revalidation), giúp tải trang gần như tức thì (`< 100ms`).
  - Tích hợp **Upstash Redis** trong NestJS để lưu bộ nhớ đệm (Cache) cho các truy vấn nặng ngoài trang chủ: *"5 Số Radio nổi bật trên Spatial Carousel"*, *"Bảng xếp hạng nghe nhiều trong tuần"* và danh sách chuyên mục, giảm tới 90% số lượt truy vấn trực tiếp vào PostgreSQL.

- [ ] **Task 5.2: Bảo mật Hệ thống & Chống Spam Tài nguyên AI**
  - Cài đặt `@nestjs/throttler` kết hợp Redis để áp dụng **Rate Limiting**: Giới hạn mỗi tài khoản người dùng chỉ được tạo tối đa `3 số Radio AI/ngày` và giới hạn độ dài kịch bản (VD: tối đa 3.000 từ/bài) để chống spam làm quá tải dịch vụ Python FastAPI.
  - Kiểm tra định dạng MIME type và giới hạn dung lượng file tải lên Cloudflare R2 (tối đa 5MB cho ảnh bìa, 50MB cho file MP3).

- [ ] **Task 5.3: Đóng gói Docker & Triển khai Hạ tầng (Deployment)**
  - Viết `Dockerfile` đa tầng (Multi-stage build) gọn nhẹ cho dịch vụ **Python FastAPI** (tích hợp sẵn `ffmpeg` và các file nhạc nền mẫu bên trong container) để triển khai miễn phí lên **Hugging Face Spaces** (gói CPU 16GB RAM) hoặc **Render**.
  - Triển khai **PostgreSQL** lên **Supabase** hoặc **Neon** (kích hoạt Connection Pooling qua PgBouncer để chịu tải kết nối đồng thời lớn).
  - Triển khai **Backend NestJS** lên **Render / Railway** (bật hỗ trợ WebSockets cho Socket.io) và **Frontend Next.js** lên **Vercel**.
  - Rà soát toàn bộ biến môi trường (`.env`), cấu hình tên miền tùy chỉnh cho Cloudflare R2 CDN và kiểm thử trải nghiệm thực tế trên cả trình duyệt máy tính lẫn điện thoại (iOS/Android).

#### Prompt triển khai Giai đoạn 5 (Copy & Dán vào AI để sinh code):
```text
Đóng vai trò là DevOps & Performance Engineer. Hãy hướng dẫn tôi tối ưu hiệu năng chịu tải lớn và triển khai toàn bộ hệ thống "Auralis" (gồm Next.js, NestJS, Python FastAPI, PostgreSQL, Upstash Redis và Cloudflare R2) lên môi trường Production với chi phí tối ưu nhất.

Yêu cầu kỹ thuật:
1. **Tối ưu Caching & Tải trang:**
   - Viết code mẫu cấu hình **Next.js ISR** kết hợp hàm `revalidatePath` khi Admin duyệt bài mới từ NestJS.
   - Viết một Cache Interceptor/Service trong NestJS sử dụng **Upstash Redis** để cache danh sách bài viết nổi bật ngoài trang chủ (TTL 10 phút) và tự động xóa cache khi có bài mới xuất bản.
2. **Bảo mật & Chống Spam (Rate Limiting):**
   - Viết cấu hình `@nestjs/throttler` giới hạn số lượt gọi API tạo giọng đọc AI theo từng `userId` (tối đa 3 lần/ngày) và validate dữ liệu đầu vào chặt chẽ bằng `class-validator`.
3. **Đóng gói & Triển khai (Deployment):**
   - Viết `Dockerfile` hoàn chỉnh cho dịch vụ **Python FastAPI** (đã cài đặt sẵn `ffmpeg` trên nền `python:3.11-slim`) để chạy ổn định trên Hugging Face Spaces hoặc Render.
   - Cung cấp bảng danh sách toàn bộ biến môi trường (`.env`) cần cấu hình giữa Vercel (Next.js), Render/Railway (NestJS), Hugging Face Spaces (FastAPI), Supabase/Neon (PostgreSQL) và Cloudflare R2.
```

