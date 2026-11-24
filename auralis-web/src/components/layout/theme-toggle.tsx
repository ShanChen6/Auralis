"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

type Theme = "dark" | "light";

function subscribe(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

const getTheme = (): Theme =>
  document.documentElement.dataset.theme === "light" ? "light" : "dark";

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getTheme, () => "dark" as Theme);
  const next: Theme = theme === "dark" ? "light" : "dark";
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={next === "light" ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
      onClick={() => {
        document.documentElement.dataset.theme = next;
        try {
          localStorage.setItem("auralis-theme", next);
        } catch {
          // trình duyệt chặn lưu trữ: vẫn đổi giao diện trong phiên này
        }
      }}
    >
      {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}

/** Chạy trước khi vẽ trang để không bị nháy sai giao diện. */
export const themeScript = `(function(){try{var t=localStorage.getItem("auralis-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}})()`;
