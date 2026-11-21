import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import { listLessons } from "@/server/admin-lessons";
import { getStatusCounts } from "@/server/admin-metrics";
import { getTopicCatalogue } from "@/server/topics";
import { LESSON_STATUSES } from "@/lib/validation";
import { STATUS_LABELS } from "@/lib/lesson-workflow";
import { formatDate } from "@/lib/time";
import { StatusBadge } from "@/components/admin/status-badge";
import { buttonClass, Input, LinkButton, Select } from "@/components/ui";

export const metadata: Metadata = { title: "Lessons" };
export const dynamic = "force-dynamic";

type SP = { q?: string; topicId?: string; status?: string; scheduledDate?: string; page?: string };

export default async function AdminLessonsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const [result, topics, counts] = await Promise.all([listLessons({ ...sp, page }), getTopicCatalogue(), getStatusCounts()]);

  const qs = (overrides: Partial<SP>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...overrides })) if (v) p.set(k, String(v));
    return `/admin?${p.toString()}`;
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Lessons</h1>
          <p className="mt-1 text-muted">Create, review, schedule and publish lesson content.</p>
        </div>
        <LinkButton href="/admin/lessons/new">
          <Plus className="size-4" aria-hidden /> New lesson
        </LinkButton>
      </div>

      {/* Status quick filters */}
      <div className="no-scrollbar mt-6 flex gap-2 overflow-x-auto">
        <Link href={qs({ status: "", page: "" })} className={statusChip(!sp.status)}>
          All <span className="opacity-60">{Object.values(counts).reduce((a, b) => a + b, 0)}</span>
        </Link>
        {LESSON_STATUSES.map((s) => (
          <Link key={s} href={qs({ status: s, page: "" })} className={statusChip(sp.status === s)}>
            {STATUS_LABELS[s]} <span className="opacity-60">{counts[s] ?? 0}</span>
          </Link>
        ))}
      </div>

      {/* Filters (plain GET form: works without JS) */}
      <form className="mt-4 grid gap-3 rounded-3xl border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1.5fr_1fr_auto]" action="/admin">
        {sp.status && <input type="hidden" name="status" value={sp.status} />}
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input name="q" defaultValue={sp.q} placeholder="Search by title" aria-label="Search by title" className="pl-11" />
        </div>
        <Select name="topicId" defaultValue={sp.topicId ?? ""} aria-label="Filter by topic">
          <option value="">All topics</option>
          {topics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
        <Input type="date" name="scheduledDate" defaultValue={sp.scheduledDate} aria-label="Scheduled date" />
        <div className="flex gap-2">
          <button type="submit" className={buttonClass("primary", "md")}>
            Filter
          </button>
          <Link href="/admin" className={buttonClass("ghost", "md")}>
            Reset
          </Link>
        </div>
      </form>

      <p className="mt-6 text-sm text-muted" aria-live="polite">
        {result.total} lesson{result.total === 1 ? "" : "s"}
      </p>

      {/* Table on desktop, cards on mobile */}
      <div className="mt-3 overflow-hidden rounded-3xl border border-line bg-surface">
        <table className="hidden w-full text-left text-sm md:table">
          <thead className="border-b border-line bg-surface-2/60 text-xs tracking-wider text-muted uppercase">
            <tr>
              <th className="px-5 py-3 font-semibold">Title</th>
              <th className="px-5 py-3 font-semibold">Topic</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold">Date</th>
              <th className="px-5 py-3 font-semibold">Checks</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {result.items.map((l) => (
              <tr key={l.id} className="transition-colors hover:bg-surface-2/50">
                <td className="max-w-md px-5 py-4">
                  <Link href={`/admin/lessons/${l.id}`} className="font-semibold hover:text-accent">
                    {l.title}
                  </Link>
                  <p className="text-xs text-muted">{l.readTimeMinutes} min · updated {formatDate(l.updatedAt)}</p>
                </td>
                <td className="px-5 py-4 text-muted">{l.topic.name}</td>
                <td className="px-5 py-4">
                  <StatusBadge status={l.status} />
                </td>
                <td className="px-5 py-4 whitespace-nowrap text-muted">
                  {l.status === "scheduled" && l.scheduledAt ? `Publishes ${formatDate(l.scheduledAt)}` : l.publishedAt ? formatDate(l.publishedAt) : "—"}
                </td>
                <td className="px-5 py-4">
                  {l.warnings.length ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-danger" title={l.warnings.join(", ")}>
                      <AlertTriangle className="size-3.5" aria-hidden /> {l.warnings.join(", ")}
                    </span>
                  ) : (
                    <span className="text-xs text-success">OK</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <ul className="divide-y divide-line md:hidden">
          {result.items.map((l) => (
            <li key={l.id}>
              <Link href={`/admin/lessons/${l.id}`} className="block p-4">
                <div className="flex items-center justify-between gap-2">
                  <StatusBadge status={l.status} />
                  <span className="text-xs text-muted">{l.topic.name}</span>
                </div>
                <p className="mt-2 font-semibold">{l.title}</p>
                {l.warnings.length > 0 && <p className="mt-1 text-xs font-semibold text-danger">{l.warnings.join(", ")}</p>}
              </Link>
            </li>
          ))}
        </ul>
        {result.items.length === 0 && <p className="p-10 text-center text-muted">No lessons match these filters.</p>}
      </div>

      {result.pageCount > 1 && (
        <nav className="mt-6 flex items-center justify-center gap-3" aria-label="Pagination">
          {page > 1 && (
            <Link href={qs({ page: String(page - 1) })} className={buttonClass("secondary", "sm")}>
              <ChevronLeft className="size-4" aria-hidden /> Previous
            </Link>
          )}
          <span className="text-sm text-muted">
            Page {result.page} of {result.pageCount}
          </span>
          {page < result.pageCount && (
            <Link href={qs({ page: String(page + 1) })} className={buttonClass("secondary", "sm")}>
              Next <ChevronRight className="size-4" aria-hidden />
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}

function statusChip(active: boolean) {
  return `inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors ${
    active ? "bg-ink text-bg" : "bg-surface text-muted hover:text-ink"
  }`;
}
