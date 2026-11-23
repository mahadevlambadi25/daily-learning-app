import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, BookOpenCheck, CheckCircle2, Mail, Sparkles, Users, XCircle } from "lucide-react";
import { requirePageAdmin } from "@/lib/auth/session";
import { safeTimezone } from "@/lib/time";
import { getContentCoverage } from "@/server/admin-lessons";
import { getDashboardMetrics, getRecentJobRuns } from "@/server/admin-metrics";
import { Card, cn } from "@/components/ui";

export const metadata: Metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

type Stat = { value: string | number; label: string; hint?: string };

function StatGroup({ icon: Icon, title, stats }: { icon: typeof Users; title: string; stats: Stat[] }) {
  return (
    <Card className="p-6">
      <h2 className="flex items-center gap-2 text-sm font-bold tracking-wider text-muted uppercase">
        <Icon className="size-4 text-accent" aria-hidden /> {title}
      </h2>
      <dl className="mt-4 grid gap-5 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label}>
            <dt className="text-sm text-muted">{s.label}</dt>
            <dd className="mt-1 font-display text-3xl font-semibold tabular-nums">{s.value}</dd>
            {s.hint && <dd className="mt-0.5 text-xs text-muted">{s.hint}</dd>}
          </div>
        ))}
      </dl>
    </Card>
  );
}

export default async function AdminOverviewPage() {
  const admin = await requirePageAdmin();
  const tz = safeTimezone(admin.profile.timezone);
  const [m, coverage, runs] = await Promise.all([getDashboardMetrics(30), getContentCoverage(), getRecentJobRuns()]);

  const empty = coverage.filter((c) => c.published === 0);
  const thin = coverage.filter((c) => c.published === 1);
  const maxTopic = Math.max(1, ...m.topTopics.map((t) => t.count));
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: tz, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
  const lastRun = runs[0];
  // Short zone name, e.g. "IST", instead of a legacy city id like "Calcutta".
  const zoneName =
    new Intl.DateTimeFormat("en-IN", { timeZone: tz, timeZoneName: "short" }).formatToParts(new Date()).find((p) => p.type === "timeZoneName")?.value ?? tz;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Overview</h1>
        <p className="mt-1 text-muted">The last {m.days} days at a glance.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <StatGroup
          icon={Users}
          title="Learners"
          stats={[
            { value: m.signups, label: "New sign-ups" },
            { value: `${m.signupToTopicsPct}%`, label: "Finished setup", hint: "picked their topics" },
            { value: m.dailyActiveLearners, label: "Active today", hint: "opened a lesson in 24h" },
          ]}
        />
        <StatGroup
          icon={BookOpenCheck}
          title="Learning"
          stats={[
            { value: m.completions, label: "Lessons finished" },
            { value: m.firstLessonUsers, label: "Learners who finished one" },
            { value: m.completionsPerActive, label: "Finished per active learner" },
          ]}
        />
        <StatGroup
          icon={Sparkles}
          title="How people read"
          stats={[
            { value: `${m.listenPct}%`, label: "Listened instead of reading", hint: "of lessons opened" },
            { value: `${m.bookmarkPct}%`, label: "Saved for later", hint: "of lessons opened" },
          ]}
        />
        <StatGroup
          icon={Mail}
          title="Daily email"
          stats={[
            { value: m.emailsSent, label: "Emails sent" },
            { value: `${m.emailFailurePct}%`, label: "Failed to send" },
          ]}
        />
      </div>
      <p className="text-xs text-muted">Finishing a lesson shows engagement. It doesn&apos;t prove someone learned it.</p>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="font-display text-xl font-semibold">Most followed topics</h2>
          {m.topTopics.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Nobody has picked topics yet.</p>
          ) : (
            <ul className="mt-5 space-y-3">
              {m.topTopics.map((t) => (
                <li key={t.name}>
                  <div className="flex justify-between gap-3 text-sm">
                    <span>{t.name}</span>
                    <span className="font-semibold tabular-nums">
                      {t.count} {t.count === 1 ? "learner" : "learners"}
                    </span>
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
            <AlertTriangle className="size-5 text-accent" aria-hidden /> Topics that need more lessons
          </h2>
          {empty.length + thin.length === 0 ? (
            <p className="mt-3 text-sm text-success">Every topic has at least 2 lessons. Nice.</p>
          ) : (
            <>
              <p className="mt-1 text-sm text-muted">
                {empty.length > 0 && (
                  <>
                    <strong className="text-danger">{empty.length}</strong> with no lessons,{" "}
                  </>
                )}
                <strong className="text-ink">{thin.length}</strong> with only one. Followers of these topics run out of new lessons first.
              </p>
              <ul className="mt-4 flex flex-wrap gap-2">
                {[...empty, ...thin].map((t) => (
                  <li key={t.id}>
                    <Link
                      href={`/admin?topicId=${t.id}`}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                        t.published === 0 ? "bg-danger-soft text-danger" : "bg-surface-2 hover:bg-line/60",
                      )}
                    >
                      {t.name} <span className="font-bold tabular-nums">{t.published}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>

      <Card className="p-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-xl font-semibold">Daily delivery</h2>
            <p className="mt-1 text-sm text-muted">
              Runs every 15 minutes and sends lessons, reminders and emails to people whose delivery time has come.
            </p>
          </div>
          {lastRun && (
            <p className={cn("text-sm font-semibold", lastRun.status === "failed" ? "text-danger" : "text-success")}>
              Last run {time.format(lastRun.startedAt)}
            </p>
          )}
        </div>
        {runs.length === 0 ? (
          <p className="mt-4 text-sm text-muted">It hasn&apos;t run yet. Check the GitHub Actions secrets (APP_URL and CRON_SECRET).</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs tracking-wider text-muted uppercase">
                <tr>
                  <th className="py-2 pr-4 font-semibold">When ({zoneName})</th>
                  <th className="py-2 pr-4 font-semibold">Result</th>
                  <th className="py-2 pr-4 font-semibold">People due</th>
                  <th className="py-2 pr-4 font-semibold">New lessons</th>
                  <th className="py-2 pr-4 font-semibold">Emails</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {runs.map((r) => {
                  const s = JSON.parse(r.summary || "{}");
                  return (
                    <tr key={r.id}>
                      <td className="py-2 pr-4 whitespace-nowrap tabular-nums">{time.format(r.startedAt)}</td>
                      <td className="py-2 pr-4">
                        {r.status === "succeeded" ? (
                          <span className="inline-flex items-center gap-1 text-success">
                            <CheckCircle2 className="size-4" aria-hidden /> Done
                          </span>
                        ) : r.status === "failed" ? (
                          <span className="inline-flex items-center gap-1 text-danger">
                            <XCircle className="size-4" aria-hidden /> Failed
                          </span>
                        ) : (
                          "Running"
                        )}
                      </td>
                      <td className="py-2 pr-4 tabular-nums">{s.usersDue ?? "—"}</td>
                      <td className="py-2 pr-4 tabular-nums">{s.lessonsAssigned ?? "—"}</td>
                      <td className="py-2 pr-4 tabular-nums">
                        {s.emailsSent ?? 0} sent{s.emailsFailed ? `, ${s.emailsFailed} failed` : ""}
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
