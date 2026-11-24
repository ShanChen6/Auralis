"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { type UserRole, useSession } from "@/store/session";

/** Bọc các trang cần đăng nhập (và tùy chọn: đúng vai trò) */
export function RequireAuth({ roles, children }: { roles?: UserRole[]; children: ReactNode }) {
  const user = useSession((s) => s.user);
  const status = useSession((s) => s.status);
  const load = useSession((s) => s.load);
  const pathname = usePathname();

  useEffect(() => {
    void load();
  }, [load]);

  if (status !== "ready") {
    return (
      <div className="flex justify-center py-32 text-muted" aria-busy="true">
        <Loader2 className="size-6 animate-spin" aria-label="Đang tải" />
      </div>
    );
  }
  if (!user) {
    return (
      <Gate title="Bạn cần đăng nhập" text="Đăng nhập để tiếp tục.">
        <Button asChild>
          <Link href={`/dang-nhap?next=${encodeURIComponent(pathname)}`}>Đăng nhập</Link>
        </Button>
      </Gate>
    );
  }
  if (roles && !roles.includes(user.role)) {
    return <Gate title="Không có quyền truy cập" text="Trang này chỉ dành cho biên tập viên và quản trị viên." />;
  }
  return <>{children}</>;
}

function Gate({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="font-serif text-3xl text-foreground">{title}</h1>
      <p className="mt-3 text-muted">{text}</p>
      <div className="mt-8">{children}</div>
    </div>
  );
}
