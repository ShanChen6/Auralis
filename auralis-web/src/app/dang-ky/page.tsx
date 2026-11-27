import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Đăng ký" };

export default function RegisterPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="font-serif text-4xl text-foreground">Ghé trạm Auralis</h1>
      <p className="mt-2 mb-8 text-muted">Tạo tài khoản để chia sẻ tản văn và giọng đọc của bạn.</p>
      <Suspense>
        <AuthForm mode="register" />
      </Suspense>
    </div>
  );
}
