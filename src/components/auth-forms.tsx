"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Eye, EyeOff, MailCheck } from "lucide-react";
import { api } from "@/lib/client-api";
import { useHydrated } from "@/lib/use-hydrated";
import { safeNext } from "@/lib/redirects";
import { Alert, Button, FieldError, Hint, Input, Label } from "./ui";

/**
 * Disabled until React has hydrated: a click before that would trigger a native form
 * submit instead of our JSON request (and reload the page).
 */
function SubmitButton({ loading, children }: { loading: boolean; children: React.ReactNode }) {
  const hydrated = useHydrated();
  return (
    <Button type="submit" size="lg" className="w-full" loading={loading} disabled={!hydrated}>
      {children}
    </Button>
  );
}


function PasswordInput(props: { id: string; value: string; onChange: (v: string) => void; autoComplete: string; invalid?: boolean; describedBy?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={props.id}
        type={show ? "text" : "password"}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        autoComplete={props.autoComplete}
        required
        aria-invalid={props.invalid || undefined}
        aria-describedby={props.describedBy}
        className="pr-12"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute top-1/2 right-2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

function Heading({ title, sub }: { title: string; sub: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h1 className="font-display text-4xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-muted">{sub}</p>
    </div>
  );
}

export function SignupForm() {
  const router = useRouter();
  const [form, setForm] = useState({ displayName: "", email: "", password: "", acceptTerms: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrors({});
    setMessage(null);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const res = await api("/api/auth/signup", { method: "POST", body: { ...form, timezone } });
    if (res.ok) {
      // One navigation only: push+refresh together race in the App Router and can stall.
      router.replace("/onboarding/topics");
      return;
    }
    setLoading(false);
    setErrors(res.fields ?? {});
    setMessage(res.message);
  }

  return (
    <>
      <Heading
        title="Create your account"
        sub={
          <>
            Already have one?{" "}
            <Link href="/login" className="font-semibold text-accent hover:underline">
              Sign in
            </Link>
          </>
        }
      />
      <form method="post" onSubmit={submit} className="space-y-5" noValidate>
        {message && !errors.email && !errors.password && !errors.acceptTerms && <Alert tone="error">{message}</Alert>}
        <div>
          <Label htmlFor="displayName">
            Name <span className="font-normal text-muted">(optional)</span>
          </Label>
          <Input id="displayName" autoComplete="given-name" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} maxLength={60} />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            aria-invalid={!!errors.email || undefined}
            aria-describedby="email-error"
          />
          <FieldError id="email-error">{errors.email}</FieldError>
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(password) => setForm({ ...form, password })}
            invalid={!!errors.password}
            describedBy="password-hint"
          />
          {errors.password ? <FieldError id="password-hint">{errors.password}</FieldError> : <Hint className="mt-1.5">At least 8 characters.</Hint>}
        </div>
        <div>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={form.acceptTerms}
              onChange={(e) => setForm({ ...form, acceptTerms: e.target.checked })}
              className="mt-0.5 size-5 shrink-0 rounded accent-[var(--accent)]"
              aria-invalid={!!errors.acceptTerms || undefined}
            />
            <span className="text-muted">
              I agree to the{" "}
              <Link href="/terms" target="_blank" className="font-semibold text-ink underline">
                Terms
              </Link>{" "}
              and{" "}
              <Link href="/privacy" target="_blank" className="font-semibold text-ink underline">
                Privacy Policy
              </Link>
              .
            </span>
          </label>
          <FieldError>{errors.acceptTerms}</FieldError>
        </div>
        <SubmitButton loading={loading}>
          Create account
        </SubmitButton>
      </form>
    </>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await api<{ home: string }>("/api/auth/login", { method: "POST", body: { email, password } });
    if (res.ok) {
      router.replace(safeNext(next) ?? res.data.home);
      return;
    }
    setLoading(false);
    setError(res.message);
  }

  return (
    <>
      <Heading
        title="Welcome back"
        sub={
          <>
            New here?{" "}
            <Link href="/signup" className="font-semibold text-accent hover:underline">
              Create an account
            </Link>
          </>
        }
      />
      <form method="post" onSubmit={submit} className="space-y-5">
        {error && <Alert tone="error">{error}</Alert>}
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <Label htmlFor="password" className="mb-0">
              Password
            </Label>
            <Link href="/forgot-password" className="text-sm font-semibold text-accent hover:underline">
              Forgot password?
            </Link>
          </div>
          <PasswordInput id="password" autoComplete="current-password" value={password} onChange={setPassword} />
        </div>
        <SubmitButton loading={loading}>
          Sign in
        </SubmitButton>
      </form>
    </>
  );
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await api("/api/auth/forgot-password", { method: "POST", body: { email } });
    setLoading(false);
    if (res.ok) setSent(true);
    else setError(res.message);
  }

  if (sent) {
    return (
      <div className="text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-3xl bg-accent-soft text-accent">
          <MailCheck className="size-8" aria-hidden />
        </div>
        <h1 className="mt-6 font-display text-3xl font-semibold">Check your inbox</h1>
        <p className="mt-3 text-muted">
          If an account exists for <strong className="text-ink">{email}</strong>, we&apos;ve sent a link to reset your password. It
          expires in 1 hour.
        </p>
        <Link href="/login" className="mt-8 inline-block font-semibold text-accent hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <>
      <Heading title="Reset your password" sub="Enter your email and we'll send you a reset link." />
      <form method="post" onSubmit={submit} className="space-y-5">
        {error && <Alert tone="error">{error}</Alert>}
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <SubmitButton loading={loading}>
          Send reset link
        </SubmitButton>
        <p className="text-center text-sm">
          <Link href="/login" className="font-semibold text-accent hover:underline">
            Back to sign in
          </Link>
        </p>
      </form>
    </>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await api("/api/auth/reset-password", { method: "POST", body: { token, password } });
    if (res.ok) {
      router.replace("/today");
      return;
    }
    setLoading(false);
    setError(res.message);
  }

  if (!token) {
    return (
      <Alert tone="error">
        This reset link is incomplete.{" "}
        <Link href="/forgot-password" className="font-semibold underline">
          Request a new one
        </Link>
        .
      </Alert>
    );
  }

  return (
    <>
      <Heading title="Choose a new password" sub="You'll be signed in once it's saved. Other devices will be signed out." />
      <form method="post" onSubmit={submit} className="space-y-5">
        {error && <Alert tone="error">{error}</Alert>}
        <div>
          <Label htmlFor="password">New password</Label>
          <PasswordInput id="password" autoComplete="new-password" value={password} onChange={setPassword} />
          <Hint>At least 8 characters.</Hint>
        </div>
        <SubmitButton loading={loading}>
          Save password
        </SubmitButton>
      </form>
    </>
  );
}
