import { redirect } from "next/navigation";
import { requirePageUser } from "@/lib/auth/session";
import { Logo } from "@/components/brand";

/**
 * Onboarding is a one-time flow. Once finished, every /onboarding page sends the user to Today,
 * so the Back button, the logo or an old bookmark can't walk them through it again.
 * (Topics and preferences can be changed any time in Settings.)
 */
export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser({ onboarded: false });
  if (user.profile.onboardedAt) redirect("/today");

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex h-16 max-w-5xl items-center px-4 sm:px-6">
        <Logo href="/onboarding/topics" />
      </header>
      <main id="main" className="mx-auto max-w-5xl px-4 pt-6 pb-16 sm:px-6">
        {children}
      </main>
    </div>
  );
}
