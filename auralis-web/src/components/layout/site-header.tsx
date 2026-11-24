import Link from "next/link";
import { LogoMark } from "./logo";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 text-foreground">
          <LogoMark />
          <span className="font-serif text-xl tracking-tight">Auralis</span>
          <span className="hidden text-xs text-muted sm:inline">· Trạm Thanh Âm &amp; Cảm Xúc</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/#moi-len-song" className="rounded-full px-3 py-1.5 text-muted transition-colors hover:text-foreground">
            Mới lên sóng
          </Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
