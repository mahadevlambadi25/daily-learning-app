"use client";

import { useState, type FormEvent } from "react";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { api } from "@/lib/client-api";
import { ADMIN_PASSWORD_MIN, passwordProblems } from "@/lib/auth/policy";
import { Alert, Button, FieldError, Hint, Input, Label } from "../ui";

/** Change password for the signed-in admin. Server re-checks everything; this only gives fast feedback. */
export function ChangePasswordForm({ email }: { email: string }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    const local: Record<string, string> = {};
    const problems = passwordProblems(next, { email, isAdmin: true });
    if (next === current && next) problems.unshift("Choose a password you haven't been using.");
    if (problems.length) local.newPassword = problems.join(" ");
    if (confirm !== next) local.confirm = "The two new passwords don't match.";
    setErrors(local);
    if (Object.keys(local).length) return;

    setLoading(true);
    const res = await api("/api/me/password", { method: "POST", body: { currentPassword: current, newPassword: next } });
    setLoading(false);
    if (!res.ok) {
      setErrors(res.fields ?? {});
      setMessage({ tone: "error", text: res.message });
      return;
    }
    setCurrent("");
    setNext("");
    setConfirm("");
    setMessage({ tone: "success", text: "Password changed. You've been signed out everywhere else; this device stays signed in." });
  }

  const type = show ? "text" : "password";
  return (
    <form method="post" onSubmit={submit} className="max-w-md space-y-5" noValidate>
      {/* Hidden username helps password managers save the new password against the right account. */}
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      <div>
        <Label htmlFor="currentPassword">Current password</Label>
        <Input id="currentPassword" type={type} autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} aria-invalid={!!errors.currentPassword || undefined} required />
        <FieldError>{errors.currentPassword}</FieldError>
      </div>
      <div>
        <Label htmlFor="newPassword">New password</Label>
        <Input id="newPassword" type={type} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} aria-invalid={!!errors.newPassword || undefined} aria-describedby="newPassword-hint" required />
        {errors.newPassword ? (
          <FieldError id="newPassword-hint">{errors.newPassword}</FieldError>
        ) : (
          <Hint className="mt-1.5">At least {ADMIN_PASSWORD_MIN} characters. A few unrelated words works well.</Hint>
        )}
      </div>
      <div>
        <Label htmlFor="confirmPassword">Repeat new password</Label>
        <Input id="confirmPassword" type={type} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-invalid={!!errors.confirm || undefined} required />
        <FieldError>{errors.confirm}</FieldError>
      </div>
      <label className="flex items-center gap-2 text-sm text-muted">
        <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="size-4 accent-[var(--accent)]" />
        {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />} Show passwords
      </label>
      {message && <Alert tone={message.tone}>{message.text}</Alert>}
      <Button type="submit" loading={loading}>
        <KeyRound className="size-4" aria-hidden /> Change password
      </Button>
    </form>
  );
}
