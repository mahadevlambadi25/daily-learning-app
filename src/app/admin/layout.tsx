import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePageAdmin } from "@/lib/auth/session";
import { Logo } from "@/components/brand";
import { AdminNav } from "@/components/admin/admin-nav";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePageAdmin();
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-xl">
        {/* One 64px row at every width (the lesson preview's sticky bar sits at top-16). */}
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-1 px-4 min-[360px]:gap-1.5 sm:gap-4 sm:px-6">
          <span className="shrink-0">
            <Logo href="/admin" compact />
          </span>
          <span className="hidden shrink-0 rounded-full bg-ink px-2.5 py-0.5 text-xs font-bold text-bg sm:inline">Admin</span>
          <AdminNav />
          <Link
            href="/today"
            title="Back to the app"
            className="ml-auto grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold text-muted hover:bg-surface-2 hover:text-ink sm:inline-flex sm:size-auto sm:items-center sm:gap-1.5 sm:px-3 sm:py-1.5"
          >
            <ArrowLeft className="size-4" aria-hidden />
            <span className="sr-only sm:not-sr-only">Back to the app</span>
          </Link>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
