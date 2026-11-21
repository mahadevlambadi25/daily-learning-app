import { Logo } from "@/components/brand";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
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
