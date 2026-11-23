import Link from "next/link";
import { APP_NAME } from "@/lib/config";
import { cn } from "./ui";

/** Sunrise mark: a half sun over the horizon. */
export function LogoMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="9" className="fill-accent" />
      <path d="M8 21a8 8 0 0 1 16 0z" className="fill-accent-ink" />
      <path d="M6 23.5h20" className="stroke-accent-ink" strokeWidth="2" strokeLinecap="round" />
      <path d="M16 8.5v2.2M9.6 11.2l1.5 1.5M22.4 11.2l-1.5 1.5" className="stroke-accent-ink" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** `compact` hides the wordmark on small screens (mark only); `"lg"` hides it below lg. */
export function Logo({ href = "/", className, compact = false }: { href?: string; className?: string; compact?: boolean | "lg" }) {
  return (
    <Link href={href} aria-label={`${APP_NAME} home`} className={cn("inline-flex shrink-0 items-center gap-2.5 font-display text-xl font-semibold tracking-tight", className)}>
      <LogoMark />
      <span className={compact === "lg" ? "hidden lg:inline" : compact ? "hidden sm:inline" : undefined}>{APP_NAME}</span>
    </Link>
  );
}
