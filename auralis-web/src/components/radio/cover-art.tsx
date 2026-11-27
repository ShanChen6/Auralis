import { MOODS, type MoodTag } from "@/lib/format";
import { cn } from "@/lib/utils";

function hash(text: string): number {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

/**
 * Ảnh bìa sinh tự động theo tâm trạng khi bài chưa có coverUrl:
 * quầng sáng theo màu tâm trạng + vầng trăng + sóng âm.
 */
export function CoverArt({
  slug,
  mood,
  coverUrl,
  title,
  className,
}: {
  slug: string;
  mood: MoodTag;
  coverUrl?: string | null;
  title: string;
  className?: string;
}) {
  if (coverUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- ảnh từ CDN R2, kích thước tùy ý
      <img src={coverUrl} alt={title} className={cn("size-full object-cover", className)} />
    );
  }
  const { hue, accent } = MOODS[mood] ?? MOODS.CALM;
  const seed = hash(slug);
  const x = 25 + (seed % 50);
  const y = 20 + ((seed >> 8) % 35);
  // Làm tròn để server và trình duyệt cho cùng kết quả (Math.sin có thể lệch ở chữ số cuối)
  const bars = Array.from({ length: 28 }, (_, i) => Math.round(18 + Math.abs(Math.sin(i * 0.7 + seed)) * 62));

  return (
    <div
      role="img"
      aria-label={title}
      className={cn("relative size-full overflow-hidden", className)}
      style={{
        background: `radial-gradient(120% 90% at ${x}% ${y}%, hsl(${accent} 85% 60% / 0.55), transparent 55%),
          radial-gradient(90% 70% at ${100 - x}% 100%, hsl(${hue} 70% 45% / 0.6), transparent 60%),
          linear-gradient(160deg, hsl(${hue} 45% 16%), hsl(${hue} 50% 7%))`,
      }}
    >
      <div
        className="absolute rounded-full"
        style={{
          left: `${x}%`,
          top: `${y}%`,
          width: "22%",
          aspectRatio: "1",
          transform: "translate(-50%, -50%)",
          background: `radial-gradient(circle at 35% 35%, hsl(${accent} 95% 85%), hsl(${accent} 90% 60%))`,
          boxShadow: `0 0 60px 12px hsl(${accent} 90% 60% / 0.45)`,
        }}
      />
      <svg
        className="absolute inset-x-0 bottom-0 h-1/3 w-full opacity-70"
        viewBox="0 0 280 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        {bars.map((h, i) => (
          <rect
            key={i}
            x={i * 10 + 2}
            y={100 - h}
            width="5"
            height={h}
            rx="2.5"
            fill={`hsl(${accent} 90% 75% / ${0.25 + (i % 3) * 0.1})`}
          />
        ))}
      </svg>
    </div>
  );
}
