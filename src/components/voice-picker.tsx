"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { AudioLines, Check, ChevronDown } from "lucide-react";
import { languageLabel, shortVoiceName, SYSTEM_DEFAULT, type VoiceLike } from "@/lib/tts/voices";
import { cn } from "./ui";

type Option = { uri: string; name: string; detail: string; group: string; online: boolean };

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
}: {
  voices: VoiceLike[];
  value: string;
  onChange: (uri: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [up, setUp] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const id = useId();

  const options: Option[] = [
    { uri: SYSTEM_DEFAULT, name: "System default", detail: "Your device's usual voice", group: "", online: false },
    ...voices.map((v) => ({
      uri: v.voiceURI,
      name: shortVoiceName(v),
      detail: languageLabel(v.lang),
      group: languageLabel(v.lang),
      online: !v.localService,
    })),
  ];
  const selectedIndex = Math.max(0, options.findIndex((o) => o.uri === value));
  const selected = options[selectedIndex];

  function openMenu() {
    if (disabled) return;
    const r = buttonRef.current?.getBoundingClientRect();
    // Open upwards only when there's clearly more room above.
    if (r) setUp(window.innerHeight - r.bottom < 300 && r.top > window.innerHeight - r.bottom);
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

  // Focus the list when it opens; close on outside click.
  useLayoutEffect(() => {
    if (open) listRef.current?.focus({ preventScroll: true });
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close(false);
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
    if (e.key === "Tab") return close(false);
    const fn = keys[e.key];
    if (fn) {
      e.preventDefault();
      fn();
    }
  }

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1 basis-52">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onButtonKey}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-label={`Voice: ${selected.name}${selected.uri ? `, ${selected.detail}` : ""}`}
        className={cn(
          "flex h-9 w-full min-w-0 items-center gap-2 rounded-full border bg-surface pr-2.5 pl-3 text-left text-xs transition-colors",
          open ? "border-accent" : "border-line hover:border-muted/50",
          "disabled:opacity-50",
        )}
      >
        <AudioLines className="size-4 shrink-0 text-accent" aria-hidden />
        <span className="min-w-0 flex-1 truncate">
          <span className="font-semibold text-ink">{selected.name}</span>
          {selected.uri ? <span className="text-muted"> · {selected.detail}</span> : null}
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted transition-transform", open && "rotate-180")} aria-hidden />
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
            "absolute right-0 left-0 z-40 max-h-72 overflow-y-auto overscroll-contain rounded-2xl border border-line bg-surface p-1.5 shadow-lift outline-none sm:left-auto sm:w-80",
            up ? "bottom-full mb-2" : "top-full mt-2",
          )}
        >
          {options.map((o, i) => {
            const showGroup = i > 0 && o.group !== options[i - 1].group;
            const isSelected = i === selectedIndex;
            return (
              <li key={o.uri || "system"} role="presentation">
                {showGroup ? (
                  <p className="px-3 pt-2.5 pb-1 text-[11px] font-bold tracking-wider text-muted uppercase" aria-hidden>
                    {o.group}
                  </p>
                ) : null}
                <div
                  id={`${id}-opt-${i}`}
                  data-i={i}
                  role="option"
                  aria-selected={isSelected}
                  onPointerMove={() => setActive(i)}
                  onClick={() => choose(i)}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm select-none",
                    isSelected ? "bg-accent-soft" : i === active && "bg-surface-2",
                    isSelected && i === active && "ring-1 ring-accent/40",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className={cn("block truncate", isSelected ? "font-semibold text-ink" : "text-ink")}>{o.name}</span>
                    {i === 0 ? <span className="block truncate text-xs text-muted">{o.detail}</span> : null}
                  </span>
                  {o.online ? <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-muted">Online</span> : null}
                  <Check className={cn("size-4 shrink-0 text-accent", !isSelected && "invisible")} aria-hidden />
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
