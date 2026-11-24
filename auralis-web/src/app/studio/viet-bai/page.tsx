import type { Metadata } from "next";
import { RequireAuth } from "@/components/auth/require-auth";
import { CreatorEditor } from "@/components/studio/creator-editor";

export const metadata: Metadata = { title: "Viết bài mới" };

export default function NewPostPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="text-xs uppercase tracking-[0.3em] text-secondary">Creator Studio</p>
      <h1 className="mt-2 font-serif text-4xl text-foreground">Viết tản văn mới</h1>
      <p className="mt-2 mb-8 text-muted">Viết câu chuyện của bạn, chọn giọng đọc, rồi gửi để trạm lên sóng.</p>
      <RequireAuth>
        <CreatorEditor />
      </RequireAuth>
    </div>
  );
}
