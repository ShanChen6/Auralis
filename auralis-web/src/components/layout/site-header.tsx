import Link from "next/link";
import { LogoMark } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

const NAV = [
  { href: "/phong-nghe", label: "Phòng nghe" },
  { href: "/studio/viet-bai", label: "Viết bài" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 text-foreground">
          <LogoMark />
          <span className="font-serif text-xl tracking-tight">Auralis</span>
          <span className="hidden text-xs text-muted lg:inline">· Trạm Thanh Âm &amp; Cảm Xúc</span>
        </Link>
        <nav className="flex min-w-0 items-center gap-1 text-sm">
          <div className="hidden items-center sm:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full px-3 py-1.5 text-muted transition-colors hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </div>
          <Link href="/phong-nghe" className="rounded-full px-2 py-1.5 text-muted hover:text-foreground sm:hidden">
            Phòng nghe
          </Link>
          <ThemeToggle />
          <UserMenu />
        </nav>
      </div>
    </header>
  );
}
