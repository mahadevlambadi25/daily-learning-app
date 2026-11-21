"use client";

import { useState } from "react";
import { api } from "@/lib/client-api";
import { LessonCard, type LessonCardData } from "./lesson-card";
import { Alert, Button } from "./ui";

type Item = LessonCardData & { at: string };

/** Library list with incremental loading ("Load more") from GET /api/me/library. */
export function LibraryList({ filter, initialItems, initialHasMore }: { filter: "saved" | "completed"; initialItems: Item[]; initialHasMore: boolean }) {
  const [items, setItems] = useState(initialItems);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadMore() {
    setLoading(true);
    setError(null);
    const res = await api<Item[]>(`/api/me/library?filter=${filter}&page=${page + 1}`);
    setLoading(false);
    if (!res.ok) return setError(res.message);
    // De-duplicate in case an item shifted between pages after a removal.
    setItems((prev) => [...prev, ...res.data.filter((n) => !prev.some((p) => p.lesson.id === n.lesson.id))]);
    setPage((p) => p + 1);
    setHasMore(Boolean(res.meta?.hasMore));
  }

  if (!items.length) return null;

  return (
    <>
      <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <li key={item.lesson.id} className="animate-[fadein_.4s_ease-out]">
            <LessonCard
              item={item}
              onBookmarkChange={(on) => {
                if (filter === "saved" && !on) setItems((prev) => prev.filter((p) => p.lesson.id !== item.lesson.id));
              }}
            />
          </li>
        ))}
      </ul>
      <style>{`@keyframes fadein{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}`}</style>
      {error && <Alert tone="error" className="mt-6">{error}</Alert>}
      {hasMore && (
        <div className="mt-8 flex justify-center">
          <Button variant="secondary" onClick={loadMore} loading={loading}>
            Load more
          </Button>
        </div>
      )}
    </>
  );
}
