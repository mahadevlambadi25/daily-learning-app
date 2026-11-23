import type { Metadata } from "next";
import { Mail, ShieldCheck, Timer } from "lucide-react";
import { requirePageAdmin } from "@/lib/auth/session";
import { ADMIN_SESSION_TTL_MS } from "@/lib/auth/policy";
import { emailConfigStatus } from "@/server/email";
import { ChangePasswordForm } from "@/components/admin/change-password-form";
import { Card } from "@/components/ui";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const admin = await requirePageAdmin();
  const email = emailConfigStatus();

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Settings</h1>
        <p className="mt-1 text-muted">
          Signed in as <strong className="text-ink">{admin.email}</strong>
        </p>
      </div>

      <Card className="p-6 sm:p-8">
        <h2 className="font-display text-2xl font-semibold">Change password</h2>
        <p className="mt-1 mb-6 text-muted">Changing it signs you out on every other device.</p>
        <ChangePasswordForm email={admin.email} />
      </Card>

      <Card className="space-y-4 p-6 sm:p-8">
        <h2 className="font-display text-2xl font-semibold">Security</h2>
        <p className="flex items-start gap-3">
          <Timer className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
          <span>
            Admin sessions end after <strong>{ADMIN_SESSION_TTL_MS / 3_600_000} hours</strong>, then you sign in again.
            Learner sessions are unchanged (30 days).
          </span>
        </p>
        <p className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-muted" aria-hidden />
          <span>Two-factor authentication isn&apos;t available yet.</span>
        </p>
        <p className="flex items-start gap-3">
          <Mail className={`mt-0.5 size-5 shrink-0 ${email.liveSending ? "text-success" : "text-muted"}`} aria-hidden />
          <span>
            Email delivery: <strong>{email.liveSending ? "on" : "off"}</strong>
            {email.liveSending
              ? " (password-reset links are emailed)."
              : ". Password-reset links can't reach an inbox yet, so keep your password somewhere safe."}
          </span>
        </p>
      </Card>
    </div>
  );
}
