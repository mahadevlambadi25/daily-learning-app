import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Flame } from "lucide-react";
import { requirePageUser } from "@/lib/auth/session";
import { supportEmail } from "@/lib/config";
import { getTopicCatalogue } from "@/server/topics";
import { getActiveTopicIds } from "@/server/users";
import { getLearningStats } from "@/server/lessons";
import { TopicPicker } from "@/components/topic-picker";
import { PreferencesForm } from "@/components/preferences-form";
import { DeleteAccount, SignOutButton } from "@/components/account-actions";
import { Reveal } from "@/components/motion";
import { Card } from "@/components/ui";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <Reveal as="section" id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24">
      <Card className="p-6 sm:p-8">
        <h2 id={`${id}-h`} className="font-display text-2xl font-semibold">
          {title}
        </h2>
        {description && <p className="mt-1 text-muted">{description}</p>}
        <div className="mt-6">{children}</div>
      </Card>
    </Reveal>
  );
}

export default async function SettingsPage() {
  const user = await requirePageUser();
  const [topics, selected, stats] = await Promise.all([
    getTopicCatalogue(),
    getActiveTopicIds(user.id),
    getLearningStats(user.id, user.profile.timezone),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Reveal>
        <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">Settings</h1>
        <nav className="no-scrollbar mt-5 flex gap-2 overflow-x-auto" aria-label="Settings sections">
          {[
            ["#topics", "Topics"],
            ["#preferences", "Preferences"],
            ["#history", "History"],
            ["#account", "Account"],
          ].map(([href, label]) => (
            <a key={href} href={href} className="rounded-full bg-surface px-4 py-2 text-sm font-semibold whitespace-nowrap text-muted hover:text-ink">
              {label}
            </a>
          ))}
        </nav>
      </Reveal>

      <Section id="topics" title="Your topics" description="Pick up to 5. Tap a topic to add or remove it, then save.">
        <TopicPicker topics={topics} initialSelected={selected} mode="settings" />
      </Section>

      <Section id="preferences" title="Reminders and email" description="When your lessons show up, and how we let you know.">
        <PreferencesForm initial={user.profile} mode="settings" />
      </Section>

      <Section id="history" title="Learning history">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-4 rounded-2xl bg-surface-2 p-4">
            <CheckCircle2 className="size-8 text-success" aria-hidden />
            <div>
              <p className="font-display text-2xl font-semibold">{stats.completed}</p>
              <p className="text-sm text-muted">lessons completed</p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-2xl bg-surface-2 p-4">
            <Flame className="size-8 text-accent" aria-hidden />
            <div>
              <p className="font-display text-2xl font-semibold">{stats.streak} {stats.streak === 1 ? "day" : "days"}</p>
              <p className="text-sm text-muted">current streak</p>
            </div>
          </div>
        </div>
        <Link href="/library?tab=completed" className="mt-4 inline-block font-semibold text-accent hover:underline">
          View completed lessons
        </Link>
      </Section>

      <Section id="account" title="Account">
        <dl className="text-sm">
          <dt className="text-muted">Signed in as</dt>
          <dd className="mt-0.5 font-semibold break-all">{user.email}</dd>
        </dl>
        <div className="mt-5 flex flex-wrap gap-3">
          <SignOutButton />
        </div>
        <div className="mt-8 border-t border-line pt-6">
          <p className="text-sm text-muted">
            Questions about your data? Contact{" "}
            <a className="font-semibold text-ink underline" href={`mailto:${supportEmail()}`}>
              {supportEmail()}
            </a>
            . Read our{" "}
            <Link href="/terms" className="underline">
              Terms
            </Link>
            ,{" "}
            <Link href="/privacy" className="underline">
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link href="/disclaimer" className="underline">
              content disclaimer
            </Link>
            .
          </p>
          <div className="mt-4">
            <DeleteAccount />
          </div>
        </div>
      </Section>
    </div>
  );
}
