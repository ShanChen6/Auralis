"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Alert, Field, Input } from "@/components/ui/input";
import { useSession } from "@/store/session";

function safeNext(value: string | null): string {
  // Chỉ chuyển hướng nội bộ, tránh open redirect
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/studio";
}

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const { login, register } = useSession.getState();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const value = (k: string) => String(form.get(k) ?? "");
    setPending(true);
    setError(null);
    try {
      if (mode === "login") await login(value("login"), value("password"));
      else
        await register({
          email: value("email"),
          username: value("username").toLowerCase(),
          displayName: value("displayName"),
          password: value("password"),
        });
      router.push(next);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="glass space-y-5 rounded-[28px] p-6 sm:p-8">
      {error && <Alert>{error}</Alert>}
      {mode === "register" ? (
        <>
          <Field label="Tên hiển thị" htmlFor="displayName">
            <Input id="displayName" name="displayName" required minLength={2} maxLength={60} autoComplete="name" />
          </Field>
          <Field label="Tên đăng nhập" htmlFor="username" hint="3–30 ký tự: chữ thường, số, gạch dưới">
            <Input id="username" name="username" required pattern="[a-z0-9_]{3,30}" autoComplete="username" />
          </Field>
          <Field label="Email" htmlFor="email">
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </Field>
        </>
      ) : (
        <Field label="Email hoặc tên đăng nhập" htmlFor="login">
          <Input id="login" name="login" required autoComplete="username" />
        </Field>
      )}
      <Field label="Mật khẩu" htmlFor="password" hint={mode === "register" ? "Tối thiểu 8 ký tự" : undefined}>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={mode === "register" ? 8 : 1}
          autoComplete={mode === "register" ? "new-password" : "current-password"}
        />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        {mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}
      </Button>
      <p className="text-center text-sm text-muted">
        {mode === "login" ? (
          <>
            Chưa có tài khoản?{" "}
            <Link href={`/dang-ky?next=${encodeURIComponent(next)}`} className="text-primary hover:underline">
              Đăng ký
            </Link>
          </>
        ) : (
          <>
            Đã có tài khoản?{" "}
            <Link href={`/dang-nhap?next=${encodeURIComponent(next)}`} className="text-primary hover:underline">
              Đăng nhập
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
