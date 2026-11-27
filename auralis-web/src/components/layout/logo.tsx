import { cn } from "@/lib/utils";

/** Biểu tượng tối giản: đỉnh chữ A, vầng trăng hổ phách và trái tim phát sáng (theo logo Auralis). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("size-8", className)} aria-hidden>
      <defs>
        <radialGradient id="auralis-heart" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FCD34D" />
          <stop offset="100%" stopColor="#F59E0B" />
        </radialGradient>
      </defs>
      <path d="M11 7a11 11 0 0 0 18 0" fill="none" stroke="#F59E0B" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M20 9 8 33h5.2l2.2-4.6h9.2l2.2 4.6H32Z" fill="currentColor" opacity="0.92" />
      <circle cx="20" cy="22" r="6" fill="#F59E0B" opacity="0.25" />
      <path
        d="M20 25.6c-2.6-1.7-4-3.1-4-4.6a2 2 0 0 1 4-.8 2 2 0 0 1 4 .8c0 1.5-1.4 2.9-4 4.6Z"
        fill="url(#auralis-heart)"
      />
      <path d="M2 24c2-4 3-4 4 0s2 4 4 0M30 24c2-4 3-4 4 0s2 4 4 0" fill="none" stroke="#A78BFA" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
