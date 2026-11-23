import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { redirectIfSignedIn } from "@/lib/auth/session";
import { LoginForm } from "@/components/auth-forms";
import { SignOutButton } from "@/components/account-actions";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const signedIn = await redirectIfSignedIn(next);

  // Signed in, but as a learner, and trying to reach the admin console.
  if (signedIn) {
    return (
      <div>
        <div className="grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent">
          <ShieldAlert className="size-7" aria-hidden />
        </div>
        <h1 className="mt-6 font-display text-3xl font-semibold tracking-tight">That account can&apos;t open admin</h1>
        <p className="mt-3 text-muted">
          You&apos;re signed in as <strong className="text-ink">{signedIn.email}</strong>, which is a learner account. Sign out,
          then sign in with an admin account.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <SignOutButton redirectTo="/login?next=/admin" />
          <Link href="/today" className="font-semibold text-accent hover:underline">
            Back to my lessons
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      {next?.startsWith("/admin") && (
        <p className="mb-6 rounded-2xl bg-surface-2 px-4 py-3 text-sm">Sign in with your admin account to open the admin console.</p>
      )}
      <LoginForm next={next} />
    </>
  );
}
