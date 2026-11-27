# auralis-web

Giao diện Auralis: Next.js 16 (App Router, Cache Components), TailwindCSS 4, component kiểu shadcn/ui (Radix), Motion, Zustand.

```bash
pnpm dev        # http://localhost:3000 (cần auralis-api ở :4000 và đã seed dữ liệu)
pnpm test       # vitest: store trình phát, hẹn giờ tắt, đồng bộ đoạn văn
pnpm lint
pnpm build
```

Biến môi trường:
- `API_URL` (mặc định `http://localhost:4000/api`): dùng cho server components và proxy `/backend/*`.
- `NEXT_PUBLIC_SOCKET_URL` (mặc định `http://<host>:4000`): địa chỉ Socket.io của API.

## Cấu trúc

| Thư mục | Nội dung |
| --- | --- |
| `src/app/globals.css` | Design System: token màu Dark (Midnight Indigo) / Light (Warm Paper), tiện ích `glass`, `bg-aurora` |
| `src/app/page.tsx` | Trang chủ: `SpatialRadioShowcase` + danh sách "Mới lên sóng" |
| `src/app/radio/[slug]/` | Trang chi tiết Interactive Storytelling + Soundscape Mixer |
| `src/components/ui/` | Button, Slider, Popover (phong cách shadcn, sửa trực tiếp được) |
| `src/components/player/` | `AudioEngine` (một thẻ `<audio>` duy nhất ở layout gốc) + `MiniPlayer` |
| `src/store/player.ts` | Zustand: hàng chờ, phát/tạm dừng/tua, hẹn giờ tắt 15/30/60 phút |
| `src/lib/soundscape.ts` | Web Audio API: tổng hợp tiếng mưa, lửa trại, sóng biển ngay trên trình duyệt |
| `src/lib/api.ts` | Gọi NestJS với `'use cache'` + `cacheLife("minutes")` |
| `src/lib/client-api.ts` | Gọi API từ trình duyệt qua proxy `/backend` (cookie first-party) |
| `src/app/studio/` | Creator Studio: viết bài, chọn giọng AI / tải bản thu / chỉ đăng chữ, theo dõi trạng thái |
| `src/app/kiem-duyet/` | Bảng kiểm duyệt cho biên tập viên |
| `src/app/long-tieng/` | Ghép cặp cộng đồng: nhận lồng tiếng bài chỉ có chữ |
| `src/app/phong-nghe/` | Phòng nghe chung: `use-live-room.ts` đồng bộ tiến độ, chat, thả cảm xúc |

## Ghi chú

- **Âm thanh liền mạch khi chuyển trang:** `AudioEngine` và `MiniPlayer` nằm ở `app/layout.tsx`, nên không bị hủy khi điều hướng client-side.
- **Đồng bộ chữ:** `findActiveParagraph` tìm đoạn đang đọc theo `timestamps` từ API (đã cộng intro 3s). Khi người dùng tự cuộn, trang ngừng tự cuộn trong 4s.
- **Font:** Be Vietnam Pro (giao diện) + Lora (nội dung) qua `next/font/google`, có subset `vietnamese`.
- **shadcn/ui:** `components.json` đã cấu hình sẵn. Khi mạng cho phép, có thể chạy `pnpm dlx shadcn@latest add <component>` để thêm component.
- **Ảnh bìa:** bài chưa có `coverUrl` sẽ dùng ảnh bìa sinh tự động theo tâm trạng (`CoverArt`).
- **API tắt lúc build:** trang vẫn build được và hiển thị trạng thái trống, rồi tự làm mới sau khoảng 1 phút khi API chạy lại.
