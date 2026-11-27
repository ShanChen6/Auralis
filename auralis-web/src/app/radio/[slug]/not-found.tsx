import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function RadioNotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="text-xs uppercase tracking-[0.3em] text-secondary">404</p>
      <h1 className="mt-3 font-serif text-3xl text-foreground">Số Radio này đã lặng sóng</h1>
      <p className="mt-3 text-muted">Có thể bài viết đã được gỡ hoặc đường dẫn chưa đúng.</p>
      <Button asChild className="mt-8">
        <Link href="/">Về trạm Auralis</Link>
      </Button>
    </div>
  );
}
