"use client";

import Link from "next/link";
import { Logo } from "./brand";
import { buttonClass, cn } from "./ui";
import { useScrolled } from "./motion";

export function MarketingHeader() {
  const scrolled = useScrolled(24);
  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-all duration-300",
        scrolled ? "border-b border-line bg-bg/80 shadow-card backdrop-blur-xl" : "bg-transparent",
      )}
    >
      <div className={cn("mx-auto flex max-w-6xl items-center justify-between px-4 transition-all duration-300 sm:px-6", scrolled ? "h-16" : "h-20")}>
        <Logo />
        <nav className="flex items-center gap-1 sm:gap-2" aria-label="Account">
          <Link href="/login" className={buttonClass("ghost", "sm")}>
            Sign in
          </Link>
          <Link href="/signup" className={buttonClass("primary", "sm")}>
            Get started
          </Link>
        </nav>
      </div>
    </header>
  );
}
