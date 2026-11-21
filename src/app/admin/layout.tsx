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
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:gap-4 sm:px-6">
          <Logo href="/admin" compact />
          <span className="hidden rounded-full bg-ink px-2.5 py-0.5 text-xs font-bold text-bg sm:inline">Admin</span>
          <AdminNav />
          <Link href="/today" className="ml-auto inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
            <ArrowLeft className="size-4" aria-hidden /> <span className="hidden sm:inline">Learner app</span>
          </Link>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
