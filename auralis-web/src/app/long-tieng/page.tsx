import type { Metadata } from "next";
import { RequireAuth } from "@/components/auth/require-auth";
import { NarrationBoard } from "@/components/narration/narration-board";

export const metadata: Metadata = { title: "Lồng tiếng cộng đồng" };

export default function NarrationPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <p className="text-xs uppercase tracking-[0.3em] text-secondary">Ban biên tập</p>
      <h1 className="mt-2 font-serif text-4xl text-foreground">Những trang viết đang chờ giọng đọc</h1>
      <p className="mt-3 mb-8 max-w-2xl text-muted">
        Những bài đã xuất bản nhưng chỉ có chữ. Thành viên ban biên tập có thể nhận một bài, thu âm và nộp bản thu –
        bản được chọn sẽ trở thành giọng đọc chính thức của số Radio đó. Cũng có thể tạo Radio AI ngay trong trang kiểm duyệt.
      </p>
      <RequireAuth roles={["EDITOR", "ADMIN"]}>
        <NarrationBoard />
      </RequireAuth>
    </div>
  );
}
