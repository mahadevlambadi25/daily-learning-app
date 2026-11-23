import { cn } from "./ui";

/** Shimmering placeholder block. Server-renderable; no JS. */
export function Bone({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-2xl bg-surface-2", className)} aria-hidden />;
}

/** Generic page skeleton: shown instantly on navigation while the server renders the page. */
export function PageSkeleton({ variant = "cards" }: { variant?: "cards" | "article" | "form" }) {
  return (
    <div role="status" aria-live="polite" aria-label="Loading">
      <span className="sr-only">Loading…</span>
      {variant === "article" ? (
        <div className="mx-auto max-w-3xl">
          <Bone className="h-4 w-20" />
          <Bone className="mt-8 h-8 w-48 rounded-full" />
          <Bone className="mt-5 h-12 w-full" />
          <Bone className="mt-3 h-12 w-2/3" />
          <Bone className="mt-8 h-11 w-44 rounded-full" />
          <div className="mt-10 space-y-3">
            {Array.from({ length: 7 }, (_, i) => (
              <Bone key={i} className={cn("h-5", i % 3 === 2 ? "w-4/5" : "w-full")} />
            ))}
          </div>
          <Bone className="mt-10 h-48 w-full rounded-3xl" />
        </div>
      ) : variant === "form" ? (
        <div className="mx-auto max-w-4xl space-y-6">
          <Bone className="h-12 w-56" />
          {Array.from({ length: 3 }, (_, i) => (
            <Bone key={i} className="h-56 w-full rounded-3xl" />
          ))}
        </div>
      ) : (
        <>
          <Bone className="h-4 w-40" />
          <Bone className="mt-3 h-12 w-64" />
          <Bone className="mt-3 h-6 w-48" />
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Bone key={i} className="h-60 w-full rounded-3xl" />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
