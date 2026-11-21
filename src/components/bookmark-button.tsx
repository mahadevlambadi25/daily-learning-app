"use client";

import { useState } from "react";
import { Bookmark } from "lucide-react";
import { api } from "@/lib/client-api";
import { cn } from "./ui";

/** Optimistic bookmark toggle; rolls back if the request fails. */
export function BookmarkButton({
  lessonId,
  initial,
  variant = "icon",
  onChange,
}: {
  lessonId: string;
  initial: boolean;
  variant?: "icon" | "full";
  onChange?: (bookmarked: boolean) => void;
}) {
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [pulse, setPulse] = useState(false);

  async function toggle() {
    if (busy) return;
    const next = !on;
    setOn(next);
    setBusy(true);
    if (next) setPulse(true);
    const res = await api(`/api/lessons/${lessonId}/bookmark`, { method: next ? "POST" : "DELETE" });
    setBusy(false);
    if (!res.ok) setOn(!next);
    else onChange?.(next);
  }

  const label = on ? "Remove bookmark" : "Bookmark lesson";
  if (variant === "full") {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-pressed={on}
        className={cn(
          "inline-flex h-11 items-center gap-2 rounded-full border px-5 text-[15px] font-semibold transition-all active:scale-[0.97]",
          on ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface hover:bg-surface-2",
        )}
      >
        <Bookmark className={cn("size-4", on && "fill-current", pulse && "animate-pop")} onAnimationEnd={() => setPulse(false)} aria-hidden />
        {on ? "Saved" : "Save"}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      aria-label={label}
      title={label}
      className={cn("grid size-10 place-items-center rounded-full transition-colors", on ? "text-accent" : "text-muted hover:bg-surface-2 hover:text-ink")}
    >
      <Bookmark className={cn("size-5", on && "fill-current", pulse && "animate-pop")} onAnimationEnd={() => setPulse(false)} aria-hidden />
    </button>
  );
}
