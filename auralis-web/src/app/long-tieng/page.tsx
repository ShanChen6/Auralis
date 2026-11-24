import type { Metadata } from "next";
import { NarrationBoard } from "@/components/narration/narration-board";

export const metadata: Metadata = { title: "Lồng tiếng cộng đồng" };

export default function NarrationPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <p className="text-xs uppercase tracking-[0.3em] text-secondary">Ghép cặp cộng đồng</p>
      <h1 className="mt-2 font-serif text-4xl text-foreground">Những trang viết đang chờ giọng đọc</h1>
      <p className="mt-3 mb-8 max-w-2xl text-muted">
        Có những câu chuyện chỉ mới có chữ. Nếu bạn có một giọng đọc ấm, hãy nhận một bài, thu âm tại nhà và gửi về trạm –
        bản thu được chọn sẽ trở thành giọng đọc chính thức của số Radio đó.
      </p>
      <NarrationBoard />
    </div>
  );
}
