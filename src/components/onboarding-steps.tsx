import { cn } from "./ui";

const STEPS = [
  { href: "/onboarding/topics", label: "Topics" },
  { href: "/onboarding/preferences", label: "Preferences" },
];

export function OnboardingSteps({ current }: { current: 0 | 1 }) {
  return (
    <ol className="mb-10 flex items-center gap-3 text-sm font-semibold" aria-label="Onboarding progress">
      {STEPS.map((s, i) => (
        <li key={s.href} className="flex items-center gap-3">
          {/* Plain <a> on purpose: a full load always shows the saved selections. The client router
              could reuse a stale copy of the step rendered before topics were saved. */}
          <a
            href={s.href}
            aria-current={i === current ? "step" : undefined}
            className={cn("flex items-center gap-2", i <= current ? "text-ink" : "pointer-events-none text-muted")}
          >
            <span
              className={cn(
                "grid size-7 place-items-center rounded-full text-xs transition-colors",
                i < current ? "bg-success text-white" : i === current ? "bg-accent text-accent-ink" : "bg-surface-2 text-muted",
              )}
            >
              {i + 1}
            </span>
            {s.label}
          </a>
          {i < STEPS.length - 1 && <span className={cn("h-0.5 w-10 rounded-full", i < current ? "bg-success" : "bg-line")} aria-hidden />}
        </li>
      ))}
    </ol>
  );
}
