"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "../ui";

const LINKS = [
  { href: "/admin", label: "Lessons" },
  { href: "/admin/overview", label: "Overview" },
  { href: "/admin/settings", label: "Settings" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    // min-w-0 + overflow-x-auto: on the narrowest phones the links can scroll inside the nav,
    // but never push the page wider than the screen.
    <nav aria-label="Admin" className="no-scrollbar flex min-w-0 items-center gap-0.5 overflow-x-auto sm:gap-1">
      {LINKS.map((l) => {
        const active = l.href === "/admin" ? pathname === "/admin" || pathname.startsWith("/admin/lessons") : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={cn("shrink-0 rounded-full px-1.5 py-1.5 text-[13px] font-semibold whitespace-nowrap min-[360px]:px-2 sm:px-3.5 sm:text-sm", active ? "bg-surface-2 text-ink" : "text-muted hover:text-ink")}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
