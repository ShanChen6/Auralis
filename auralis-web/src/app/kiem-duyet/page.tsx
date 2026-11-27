import type { Metadata } from "next";
import { RequireAuth } from "@/components/auth/require-auth";
import { ModerationDashboard } from "@/components/moderation/moderation-dashboard";

export const metadata: Metadata = { title: "Kiểm duyệt" };

export default function ModerationPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <p className="text-xs uppercase tracking-[0.3em] text-secondary">Biên tập</p>
      <h1 className="mt-2 mb-8 font-serif text-4xl text-foreground">Kiểm duyệt nội dung</h1>
      <RequireAuth roles={["EDITOR", "ADMIN"]}>
        <ModerationDashboard />
      </RequireAuth>
    </div>
  );
}
