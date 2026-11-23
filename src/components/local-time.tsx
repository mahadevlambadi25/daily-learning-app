"use client";

import { useSyncExternalStore } from "react";
import { formatLocalTimestamp, formatStableTimestamp } from "@/lib/format-time";

const subscribe = () => () => {};

/**
 * false during server rendering and while React hydrates (the server snapshot is used for the
 * first client render), true afterwards and for any render that starts on the client.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

/**
 * A timestamp in the viewer's local time, rendered without hydration mismatches: the server
 * and the first client render show the same explicit UTC text, then React re-renders it in the
 * browser's own locale and time zone.
 */
export function LocalTime({ iso, className }: { iso: string; className?: string }) {
  const hydrated = useHydrated();
  return (
    <time dateTime={iso} className={className} title={formatStableTimestamp(iso)}>
      {hydrated ? formatLocalTimestamp(iso) : formatStableTimestamp(iso)}
    </time>
  );
}
