"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bookmark, Compass, Flame, LayoutDashboard, LogOut, Settings, Sun } from "lucide-react";
import { Logo } from "./brand";
import { cn } from "./ui";
import { useScrolled } from "./motion";
import { api } from "@/lib/client-api";

const NAV = [
  { href: "/today", label: "Today", icon: Sun },
  { href: "/topics", label: "Topics", icon: Compass },
  { href: "/library", label: "Library", icon: Bookmark },
  { href: "/settings", label: "Settings", icon: Settings },
];

type NavUser = { name: string | null; email: string; isAdmin: boolean; streak: number };

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Sticky header that gains a blurred background and shadow once the page scrolls. */
export function AppHeader({ user }: { user: NavUser }) {
  const pathname = usePathname();
  const scrolled = useScrolled();
  return (
    <header
      className={cn(
        "sticky top-0 z-40 transition-[background-color,box-shadow,border-color] duration-300",
        scrolled ? "border-b border-line bg-bg/80 shadow-card backdrop-blur-xl" : "border-b border-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo href="/today" />
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(pathname, href) ? "page" : undefined}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                isActive(pathname, href) ? "bg-surface-2 text-ink" : "text-muted hover:text-ink",
              )}
            >
              {label}
            </Link>
          ))}
          {user.isAdmin && (
            <Link href="/admin" className="rounded-full px-4 py-2 text-sm font-semibold text-muted hover:text-ink">
              Admin
            </Link>
          )}
        </nav>
        <div className="flex items-center gap-2">
          <StreakChip streak={user.streak} />
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  );
}

function StreakChip({ streak }: { streak: number }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-semibold",
        streak > 0 ? "bg-accent-soft text-accent" : "bg-surface-2 text-muted",
      )}
      title={`${streak}-day learning streak`}
    >
      <Flame className="size-4" aria-hidden />
      {streak}
      <span className="sr-only">day learning streak</span>
    </span>
  );
}

function UserMenu({ user }: { user: NavUser }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function signOut() {
    await api("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const initial = (user.name || user.email).charAt(0).toUpperCase();
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
        className="grid size-10 place-items-center rounded-full bg-ink font-semibold text-bg transition-transform hover:scale-105"
      >
        {initial}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-12 w-60 rounded-2xl border border-line bg-surface p-2 shadow-lift">
          <div className="border-b border-line px-3 pb-2 pt-1">
            <p className="truncate text-sm font-semibold">{user.name || "Learner"}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
          <Link role="menuitem" href="/settings" onClick={() => setOpen(false)} className="mt-1 flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-surface-2">
            <Settings className="size-4" aria-hidden /> Settings
          </Link>
          {user.isAdmin && (
            <Link role="menuitem" href="/admin" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-surface-2">
              <LayoutDashboard className="size-4" aria-hidden /> Admin console
            </Link>
          )}
          <button role="menuitem" type="button" onClick={signOut} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-surface-2">
            <LogOut className="size-4" aria-hidden /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

/** Thumb-friendly tab bar on phones. */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/90 backdrop-blur-xl md:hidden">
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn("flex flex-col items-center gap-0.5 pt-2.5 pb-1 text-[11px] font-semibold", active ? "text-accent" : "text-muted")}
              >
                <Icon className={cn("size-5 transition-transform", active && "scale-110")} aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
