"use client";

import { LogOut, Mic, PenLine, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { isModerator, useSession } from "@/store/session";

export function UserMenu() {
  const user = useSession((s) => s.user);
  const status = useSession((s) => s.status);
  const load = useSession((s) => s.load);
  const router = useRouter();

  useEffect(() => {
    void load();
  }, [load]);

  if (status !== "ready") return <span className="size-8" aria-hidden />;
  if (!user) {
    return (
      <Button asChild size="sm" variant="outline">
        <Link href="/dang-nhap">Đăng nhập</Link>
      </Button>
    );
  }

  const links = [
    { href: "/studio", label: "Studio của tôi", icon: PenLine },
    ...(isModerator(user)
      ? [
          { href: "/kiem-duyet", label: "Kiểm duyệt", icon: ShieldCheck },
          { href: "/long-tieng", label: "Lồng tiếng", icon: Mic },
        ]
      : []),
  ];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          aria-label={`Tài khoản ${user.displayName}`}
          className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-sm font-semibold text-primary-foreground"
        >
          {user.displayName.charAt(0).toUpperCase()}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 p-2">
        <div className="px-3 py-2">
          <p className="truncate font-medium text-foreground">{user.displayName}</p>
          <p className="truncate text-xs text-muted">@{user.username}</p>
        </div>
        <div className="my-1 h-px bg-border" />
        {links.map(({ href, label, icon: Icon }) => (
          <PopoverClose asChild key={href}>
            <Link href={href} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-foreground hover:bg-foreground/5">
              <Icon className="size-4 text-muted" />
              {label}
            </Link>
          </PopoverClose>
        ))}
        <button
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted hover:bg-foreground/5 hover:text-foreground"
          onClick={async () => {
            await useSession.getState().logout();
            router.push("/");
            router.refresh();
          }}
        >
          <LogOut className="size-4" />
          Đăng xuất
        </button>
      </PopoverContent>
    </Popover>
  );
}
