"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown, Smartphone } from "lucide-react";
import { accentLabel, shortVoiceName, SYSTEM_DEFAULT, type VoiceLike } from "@/lib/tts/voices";
import { cn } from "./ui";

type Option = { uri: string; name: string; accent: string; badge: string; online: boolean };

/**
 * Voice menu for the Listen player. A custom listbox instead of a native <select>, so it looks
 * the same on every device and keeps the Daylight colours (no system-blue selection).
 * Keyboard: ↑/↓, Home/End, Enter/Space to choose, Esc to close.
 */
export function VoicePicker({
  voices,
  value,
  onChange,
  disabled,
  className,
}: {
  voices: VoiceLike[];
  value: string;
  onChange: (uri: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [up, setUp] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const id = useId();

  const options: Option[] = [
    { uri: SYSTEM_DEFAULT, name: "System default", accent: "Device voice", badge: "", online: false },
    ...voices.map((v) => {
      const accent = accentLabel(v.lang);
      const region = v.lang.replace("_", "-").split("-")[1]?.toUpperCase();
      return { uri: v.voiceURI, name: shortVoiceName(v), accent, badge: region === "GB" ? "UK" : (region ?? v.lang.slice(0, 2).toUpperCase()), online: !v.localService };
    }),
  ];
  const selectedIndex = Math.max(0, options.findIndex((o) => o.uri === value));
  const selected = options[selectedIndex];

  function openMenu() {
    if (disabled) return;
    const r = buttonRef.current?.getBoundingClientRect();
    // Open upwards only when there's clearly more room above.
    if (r) setUp(window.innerHeight - r.bottom < 280 && r.top > window.innerHeight - r.bottom);
    setActive(selectedIndex);
    setOpen(true);
  }
  function close(refocus = true) {
    setOpen(false);
    if (refocus) buttonRef.current?.focus({ preventScroll: true });
  }
  function choose(i: number) {
    const o = options[i];
    if (o && o.uri !== value) onChange(o.uri);
    close();
  }

  useLayoutEffect(() => {
    if (open) listRef.current?.focus({ preventScroll: true });
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);
  useEffect(() => {
    if (open) listRef.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function onButtonKey(e: KeyboardEvent) {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      openMenu();
    }
  }
  function onListKey(e: KeyboardEvent) {
    const last = options.length - 1;
    const keys: Record<string, () => void> = {
      ArrowDown: () => setActive((a) => Math.min(last, a + 1)),
      ArrowUp: () => setActive((a) => Math.max(0, a - 1)),
      Home: () => setActive(0),
      End: () => setActive(last),
      Enter: () => choose(active),
      " ": () => choose(active),
      Escape: () => close(),
    };
    if (e.key === "Tab") return setOpen(false);
    const fn = keys[e.key];
    if (fn) {
      e.preventDefault();
      fn();
    }
  }

  return (
    <div ref={rootRef} className={cn("relative min-w-0", className)}>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onButtonKey}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-label={`Voice: ${selected.name}${selected.uri ? `, ${selected.accent}` : ""}`}
        className={cn(
          "flex h-8 w-full min-w-0 items-center gap-1.5 rounded-full pr-2 pl-3 text-left text-xs transition-colors disabled:opacity-50",
          open ? "bg-accent-soft" : "bg-surface-2 hover:bg-accent-soft",
        )}
      >
        <span className="min-w-0 flex-1 truncate">
          <span className="font-semibold text-ink">{selected.name}</span>
          {selected.uri ? <span className="text-muted"> · {selected.accent}</span> : null}
        </span>
        <ChevronDown className={cn("size-3.5 shrink-0 text-muted transition-transform", open && "rotate-180")} aria-hidden />
      </button>

      {open ? (
        <ul
          ref={listRef}
          id={`${id}-list`}
          role="listbox"
          tabIndex={-1}
          aria-label="Choose a voice"
          aria-activedescendant={`${id}-opt-${active}`}
          onKeyDown={onListKey}
          className={cn(
            "absolute left-0 z-40 max-h-64 w-full min-w-56 overflow-y-auto overscroll-contain rounded-2xl border border-line bg-surface p-1 shadow-lift outline-none",
            up ? "bottom-full mb-1.5" : "top-full mt-1.5",
          )}
        >
          {options.map((o, i) => {
            const isSelected = i === selectedIndex;
            return (
              <li
                key={o.uri || "system"}
                id={`${id}-opt-${i}`}
                data-i={i}
                role="option"
                aria-selected={isSelected}
                onPointerMove={() => setActive(i)}
                onClick={() => choose(i)}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 rounded-xl px-2 py-1.5 select-none",
                  i === active ? "bg-surface-2" : "",
                )}
              >
                <span
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-full text-[10px] font-bold tracking-wide",
                    isSelected ? "bg-accent text-accent-ink" : "bg-surface-2 text-muted",
                    i === active && !isSelected && "bg-surface",
                  )}
                  aria-hidden
                >
                  {o.badge || <Smartphone className="size-3.5" />}
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className={cn("block truncate text-sm", isSelected ? "font-semibold text-accent" : "text-ink")}>{o.name}</span>
                  <span className="block truncate text-[11px] text-muted">
                    {o.accent}
                    {o.online ? " · Online" : ""}
                  </span>
                </span>
                {isSelected ? <Check className="size-4 shrink-0 text-accent" aria-hidden /> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
