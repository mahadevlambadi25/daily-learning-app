import { Quote } from "lucide-react";
import { Logo } from "@/components/brand";
import { Reveal } from "@/components/motion";
import Link from "next/link";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col px-4 py-6 sm:px-10">
        <Logo />
        <main id="main" className="flex flex-1 items-center justify-center py-10">
          <Reveal className="w-full max-w-md">{children}</Reveal>
        </main>
        <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
          <Link href="/terms" className="hover:text-ink">Terms</Link>
          <Link href="/privacy" className="hover:text-ink">Privacy Policy</Link>
          <Link href="/disclaimer" className="hover:text-ink">Content disclaimer</Link>
        </nav>
      </div>
      <aside className="relative hidden overflow-hidden bg-ink p-12 text-bg lg:flex lg:flex-col lg:justify-end" aria-hidden>
        <div className="sun-glow absolute -top-40 -right-40 size-[600px] rounded-full opacity-80" />
        <div className="relative">
          <Quote className="size-10 text-accent" />
          <p className="mt-6 font-display text-4xl leading-tight font-semibold text-balance">
            Small lessons, taken daily, quietly change how you think and work.
          </p>
          <p className="mt-6 opacity-70">2-4 minutes a day · 50 topics · read or listen</p>
        </div>
      </aside>
    </div>
  );
}
