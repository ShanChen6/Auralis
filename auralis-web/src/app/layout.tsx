import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, Lora } from "next/font/google";
import { SiteHeader } from "@/components/layout/site-header";
import { themeScript } from "@/components/layout/theme-toggle";
import { AudioEngine } from "@/components/player/audio-engine";
import { MiniPlayer } from "@/components/player/mini-player";
import "./globals.css";

const beVietnamPro = Be_Vietnam_Pro({
  variable: "--font-be-vietnam-pro",
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin", "vietnamese"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Auralis – Trạm Thanh Âm & Cảm Xúc", template: "%s · Auralis" },
  description:
    "Blog tản văn & Radio cộng đồng: đọc và nghe những câu chuyện dịu dàng với giọng đọc truyền cảm.",
};

export const viewport: Viewport = {
  themeColor: "#0b0f19",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="vi"
      data-theme="dark"
      suppressHydrationWarning
      className={`${beVietnamPro.variable} ${lora.variable} h-full`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="bg-aurora flex min-h-full flex-col">
        <SiteHeader />
        <main className="flex-1 overflow-x-clip pb-32">{children}</main>
        <AudioEngine />
        <MiniPlayer />
      </body>
    </html>
  );
}
