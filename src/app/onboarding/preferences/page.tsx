import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requirePageUser } from "@/lib/auth/session";
import { getActiveTopicIds } from "@/server/users";
import { PreferencesForm } from "@/components/preferences-form";
import { OnboardingSteps } from "@/components/onboarding-steps";
import { Reveal } from "@/components/motion";

export const metadata: Metadata = { title: "Your preferences" };

export default async function OnboardingPreferencesPage() {
  const user = await requirePageUser({ onboarded: false });
  if ((await getActiveTopicIds(user.id)).length === 0) redirect("/onboarding/topics");
  return (
    <div className="max-w-2xl">
      <OnboardingSteps current={1} />
      <Reveal>
        <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">When should we deliver?</h1>
        <p className="mt-3 text-lg text-muted">Pick a rhythm that fits your day. You can change this anytime in Settings.</p>
      </Reveal>
      <Reveal delay={100} className="mt-10 rounded-3xl border border-line bg-surface p-6 shadow-card sm:p-8">
        <PreferencesForm initial={user.profile} mode="onboarding" />
      </Reveal>
    </div>
  );
}
