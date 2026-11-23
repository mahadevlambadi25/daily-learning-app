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
    <nav aria-label="Admin" className="flex items-center gap-1">
      {LINKS.map((l) => {
        const active = l.href === "/admin" ? pathname === "/admin" || pathname.startsWith("/admin/lessons") : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={cn("rounded-full px-2.5 py-1.5 text-sm font-semibold sm:px-3.5", active ? "bg-surface-2 text-ink" : "text-muted hover:text-ink")}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
