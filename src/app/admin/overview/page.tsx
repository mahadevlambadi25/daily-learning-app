import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { getContentCoverage } from "@/server/admin-lessons";
import { getDashboardMetrics, getRecentJobRuns } from "@/server/admin-metrics";
import { Card } from "@/components/ui";

export const metadata: Metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const [m, coverage, runs] = await Promise.all([getDashboardMetrics(30), getContentCoverage(), getRecentJobRuns()]);
  const low = coverage.filter((c) => c.published < 2).sort((a, b) => a.published - b.published);
  const maxTopic = Math.max(1, ...m.topTopics.map((t) => t.count));

  const tiles = [
    { label: "Sign-ups", value: m.signups },
    { label: "Sign-up → topics", value: `${m.signupToTopicsPct}%` },
    { label: "Learners who completed a lesson", value: m.firstLessonUsers },
    { label: "Daily active learners (24h)", value: m.dailyActiveLearners },
    { label: "Lessons completed", value: m.completions },
    { label: "Completions per active learner", value: m.completionsPerActive },
    { label: "Listen usage (of opens)", value: `${m.listenPct}%` },
    { label: "Bookmark rate (of opens)", value: `${m.bookmarkPct}%` },
    { label: "Daily emails sent", value: m.emailsSent },
    { label: "Email failure rate", value: `${m.emailFailurePct}%` },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Overview</h1>
        <p className="mt-1 text-muted">Last {m.days} days. Completion is an engagement signal, not proof of learning outcomes.</p>
      </div>

      <section aria-labelledby="metrics-h">
        <h2 id="metrics-h" className="sr-only">
          Metrics
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {tiles.map((t) => (
            <Card key={t.label} className="p-4">
              <p className="font-display text-3xl font-semibold">{t.value}</p>
              <p className="mt-1 text-sm text-muted">{t.label}</p>
            </Card>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="font-display text-xl font-semibold">Selected-topic distribution</h2>
          {m.topTopics.length === 0 ? (
            <p className="mt-4 text-sm text-muted">No learners have selected topics yet.</p>
          ) : (
            <ul className="mt-5 space-y-3">
              {m.topTopics.map((t) => (
                <li key={t.name}>
                  <div className="flex justify-between text-sm">
                    <span>{t.name}</span>
                    <span className="font-semibold">{t.count}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-surface-2">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${(t.count / maxTopic) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
            <AlertTriangle className="size-5 text-accent" aria-hidden /> Low content coverage
          </h2>
          <p className="mt-1 text-sm text-muted">Topics with fewer than 2 published lessons. Learners in these topics will run out soonest.</p>
          {low.length === 0 ? (
            <p className="mt-4 text-sm text-success">Every topic has at least 2 published lessons.</p>
          ) : (
            <ul className="mt-4 flex max-h-72 flex-wrap gap-2 overflow-auto">
              {low.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/admin?topicId=${t.id}`}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${t.published === 0 ? "bg-danger-soft text-danger" : "bg-surface-2"}`}
                  >
                    {t.name} <span className="font-bold">{t.published}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="font-display text-xl font-semibold">Scheduled job runs</h2>
        <p className="mt-1 text-sm text-muted">The daily delivery job should run every 15 minutes.</p>
        {runs.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No runs yet. Trigger with <code className="rounded bg-surface-2 px-1.5 py-0.5">npm run job:daily</code> or your cron.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs tracking-wider text-muted uppercase">
                <tr>
                  <th className="py-2 pr-4">Started</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Users due</th>
                  <th className="py-2 pr-4">Assigned</th>
                  <th className="py-2 pr-4">Emails sent / failed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {runs.map((r) => {
                  const s = JSON.parse(r.summary || "{}");
                  return (
                    <tr key={r.id}>
                      <td className="py-2 pr-4 whitespace-nowrap">{r.startedAt.toISOString().replace("T", " ").slice(0, 16)} UTC</td>
                      <td className="py-2 pr-4">
                        {r.status === "succeeded" ? (
                          <span className="inline-flex items-center gap-1 text-success"><CheckCircle2 className="size-4" aria-hidden /> OK</span>
                        ) : r.status === "failed" ? (
                          <span className="inline-flex items-center gap-1 text-danger"><XCircle className="size-4" aria-hidden /> Failed</span>
                        ) : (
                          "Running"
                        )}
                      </td>
                      <td className="py-2 pr-4">{s.usersDue ?? "—"}</td>
                      <td className="py-2 pr-4">{s.lessonsAssigned ?? "—"}</td>
                      <td className="py-2 pr-4">
                        {s.emailsSent ?? 0} / {s.emailsFailed ?? 0}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
