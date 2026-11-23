import Link from "next/link";
import { APP_NAME } from "@/lib/config";
import { Logo } from "./brand";

export function SiteFooter({ compact = false }: { compact?: boolean }) {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
        {!compact && (
          <div>
            <Logo />
            <p className="mt-2 max-w-xs text-sm text-muted">A short lesson a day on the things you care about.</p>
          </div>
        )}
        <nav aria-label="Legal" className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
          <Link href="/terms" className="hover:text-ink">Terms</Link>
          <Link href="/privacy" className="hover:text-ink">Privacy Policy</Link>
          <Link href="/disclaimer" className="hover:text-ink">Content disclaimer</Link>
          <span>© {new Date().getFullYear()} {APP_NAME}</span>
        </nav>
      </div>
    </footer>
  );
}
