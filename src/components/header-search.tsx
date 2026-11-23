"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { Search, X } from "lucide-react";
import { cn } from "./ui";

/** Query param shared by the header search and the Topics page filter. */
export const TOPIC_QUERY_PARAM = "q";

// Live text typed into the header search while on /topics. `null` = follow the URL. Kept in a
// tiny shared store because an in-place URL update alone doesn't re-render the topic list.
let liveQuery: string | null = null;
const listeners = new Set<() => void>();
function publishQuery(q: string | null) {
  if (liveQuery === q) return;
  liveQuery = q;
  listeners.forEach((l) => l());
}
const subscribeQuery = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** The current topic search for the Topics list: what's being typed, else the URL's ?q=. */
export function useTopicQuery(): string {
  const fromUrl = useSearchParams().get(TOPIC_QUERY_PARAM) ?? "";
  const live = useSyncExternalStore(
    subscribeQuery,
    () => liveQuery,
    () => null,
  );
  return live ?? fromUrl;
}

/**
 * Topic search in the app header.
 * - On /topics it's always shown and filters the list live (via ?q= in the URL).
 * - Elsewhere it's inline on large screens and a search button on smaller ones; Enter opens
 *   Topics with the results.
 * - "/" focuses it (when not already typing somewhere).
 */
export function HeaderSearch() {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const onTopics = pathname === "/topics";
  const urlQuery = onTopics ? (params.get(TOPIC_QUERY_PARAM) ?? "") : "";
  const [value, setValue] = useState(urlQuery);
  const [open, setOpen] = useState(false); // expanded over the header on smaller screens
  const inputRef = useRef<HTMLInputElement>(null);

  // Follow the URL (arriving on /topics?q=…, leaving Topics, back/forward).
  useEffect(() => {
    setValue(urlQuery);
    publishQuery(null); // the URL is the source of truth again
  }, [urlQuery, pathname]);
  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      if (inputRef.current && inputRef.current.offsetParent !== null) inputRef.current.focus();
      else setOpen(true);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function change(v: string) {
    setValue(v);
    if (!onTopics) return;
    // Live filter on Topics: tell the list directly, and keep ?q= in the URL (shareable,
    // survives reload) without a server round trip.
    publishQuery(v);
    const url = new URL(window.location.href);
    if (v) url.searchParams.set(TOPIC_QUERY_PARAM, v);
    else url.searchParams.delete(TOPIC_QUERY_PARAM);
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const q = value.trim();
    if (onTopics) {
      inputRef.current?.blur(); // closes the phone keyboard so results are visible
      return;
    }
    router.push(q ? `/topics?${TOPIC_QUERY_PARAM}=${encodeURIComponent(q)}` : "/topics");
  }

  function close() {
    setOpen(false);
    if (!onTopics) setValue("");
  }

  const field = (
    <form role="search" onSubmit={submit} className="relative w-full">
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" aria-hidden />
      <input
        ref={inputRef}
        type="search"
        enterKeyHint="search"
        value={value}
        onChange={(e) => change(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && (value ? change("") : close())}
        placeholder="Search topics"
        aria-label="Search topics"
        className="header-search-input h-10 w-full min-w-0 rounded-full border border-line bg-surface pr-3 pl-10 text-sm text-ink placeholder:text-muted"
      />
    </form>
  );

  // Topics page, or large screens: an inline field in the header row.
  // Elsewhere on smaller screens: a button that opens the field across the header.
  return (
    <>
      <div className={cn("min-w-0 flex-1 justify-end", onTopics ? "flex" : "hidden lg:flex")}>
        <div className={cn("w-full", onTopics ? "md:max-w-xs" : "max-w-xs")}>{open ? null : field}</div>
      </div>
      {!onTopics && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Search topics"
          title="Search topics"
          className="ml-auto grid size-10 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink lg:hidden"
        >
          <Search className="size-5" aria-hidden />
        </button>
      )}
      {open && (
        <div className="absolute inset-0 z-10 flex items-center gap-2 bg-bg px-4 sm:px-6">
          <div className="min-w-0 flex-1">{field}</div>
          <button
            type="button"
            onClick={close}
            aria-label="Close search"
            className="grid size-10 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
      )}
    </>
  );
}
