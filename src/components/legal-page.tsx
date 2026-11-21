import { MarketingHeader } from "./marketing-header";
import { SiteFooter } from "./site-footer";

/** Shared shell for Terms / Privacy / Disclaimer. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <>
      <MarketingHeader />
      <main id="main" className="mx-auto max-w-3xl px-4 pt-32 pb-20 sm:px-6">
        <p className="rounded-2xl bg-accent-soft px-4 py-3 text-sm text-accent">
          Template for MVP review. The product owner must have this reviewed before public launch.
        </p>
        <h1 className="mt-8 font-display text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
        <p className="mt-2 text-sm text-muted">Last updated {updated}</p>
        <div className="mt-10 space-y-6 leading-relaxed [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-2">
          {children}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
