import { APP_NAME, appUrl } from "@/lib/config";

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
  /** Provider-side de-duplication key, so a retried request can't send the same email twice. */
  idempotencyKey?: string;
};

export type SendResult = { ok: true; providerId: string } | { ok: false; error: string; transient: boolean };

export interface EmailProvider {
  name: string;
  send(message: EmailMessage): Promise<SendResult>;
}

export function maskEmail(address: string): string {
  const [name, domain] = address.split("@");
  return `${name.slice(0, 1)}***@${domain ?? "?"}`;
}

/**
 * No-op provider that logs instead of sending. Locally it prints the full email (handy for
 * testing reset links). In production it logs only a masked recipient and the subject: email
 * bodies can contain password-reset tokens, and server logs must never hold them.
 */
export const consoleProvider: EmailProvider = {
  name: "console",
  async send(m) {
    if (process.env.NODE_ENV === "production") {
      console.info(`[email] not sent (no live email provider): to=${maskEmail(m.to)} subject="${m.subject}"`);
    } else {
      console.info(`\n[email] to=${m.to} subject="${m.subject}"\n${m.text}\n`);
    }
    return { ok: true, providerId: `console-${Date.now()}` };
  },
};

/** In-memory provider used by tests; inspect `outbox`. */
export function createMemoryProvider(): EmailProvider & { outbox: EmailMessage[]; failNext: number } {
  const p = {
    name: "memory",
    outbox: [] as EmailMessage[],
    failNext: 0,
    async send(m: EmailMessage): Promise<SendResult> {
      if (p.failNext > 0) {
        p.failNext--;
        return { ok: false, error: "simulated failure", transient: true };
      }
      p.outbox.push(m);
      return { ok: true, providerId: `mem-${p.outbox.length}` };
    },
  };
  return p;
}

/** Resend HTTP API provider (no SDK dependency). Exported for tests; use getEmailProvider() in app code. */
export function resendProvider(apiKey: string, from: string): EmailProvider {
  return {
    name: "resend",
    async send(m) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            ...(m.idempotencyKey ? { "Idempotency-Key": m.idempotencyKey } : {}),
          },
          signal: AbortSignal.timeout(15_000),
          body: JSON.stringify({
            from,
            to: [m.to],
            subject: m.subject,
            html: m.html,
            text: m.text,
            headers: m.headers,
            ...(process.env.EMAIL_REPLY_TO ? { reply_to: process.env.EMAIL_REPLY_TO } : {}),
          }),
        });
        const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
        if (res.ok && body.id) return { ok: true, providerId: body.id };
        return { ok: false, error: body.message || `HTTP ${res.status}`, transient: res.status >= 500 || res.status === 429 };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "network error", transient: true };
      }
    },
  };
}

let memorySingleton: ReturnType<typeof createMemoryProvider> | null = null;

export type EmailConfigStatus = { provider: string; liveSending: boolean; problems: string[] };

/**
 * Reports the email setup without sending anything. Real sending needs ALL of:
 * EMAIL_PROVIDER=resend, RESEND_API_KEY, EMAIL_FROM, and the explicit switch
 * EMAIL_SENDING_ENABLED=true (so configuring Resend can't start sending by accident).
 */
export function emailConfigStatus(env: Record<string, string | undefined> = process.env): EmailConfigStatus {
  const provider = env.EMAIL_PROVIDER || "console";
  const problems: string[] = [];
  if (provider === "resend") {
    if (!env.RESEND_API_KEY) problems.push("RESEND_API_KEY is not set.");
    if (!env.EMAIL_FROM) problems.push("EMAIL_FROM is not set (e.g. \"Daylight <hello@your-verified-domain.com>\").");
    else if (/@example\.(com|org)>?$/i.test(env.EMAIL_FROM.trim())) problems.push("EMAIL_FROM still uses example.com; use your verified Resend domain.");
    if (env.EMAIL_SENDING_ENABLED !== "true") problems.push("EMAIL_SENDING_ENABLED is not \"true\", so emails are logged instead of sent.");
  }
  return { provider, liveSending: provider === "resend" && problems.length === 0, problems };
}

let warnedNotLive = false;

export function getEmailProvider(): EmailProvider {
  const kind = process.env.EMAIL_PROVIDER || "console";
  if (kind === "memory") return (memorySingleton ??= createMemoryProvider());
  if (kind === "resend") {
    const status = emailConfigStatus();
    if (status.liveSending) return resendProvider(process.env.RESEND_API_KEY!, process.env.EMAIL_FROM!);
    // Configured for Resend but not approved/complete: never send, never crash; log why once.
    if (!warnedNotLive) {
      console.warn(`[email] Resend selected but live sending is off: ${status.problems.join(" ")}`);
      warnedNotLive = true;
    }
  }
  return consoleProvider;
}

// ---- Templates --------------------------------------------------------------

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function layout(inner: string, footer: string) {
  return `<!doctype html><html><body style="margin:0;background:#f6f4ef;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#1d2433">
<div style="max-width:560px;margin:0 auto;padding:32px 20px">
<div style="font-weight:700;font-size:18px;color:#c2410c;margin-bottom:20px">${esc(APP_NAME)}</div>
<div style="background:#fff;border-radius:16px;padding:28px;border:1px solid #ece7dd">${inner}</div>
<div style="font-size:12px;color:#6b7280;margin-top:20px;line-height:1.6">${footer}</div>
</div></body></html>`;
}

export type DigestLesson = { id: string; title: string; hook: string; topicName: string };

/** Daily digest: titles, topics, one-line hooks and deep links; never the full lesson (PRD §9). */
export function dailyDigestEmail(opts: {
  to: string;
  name: string | null;
  lessons: DigestLesson[];
  unsubscribeToken: string;
}): EmailMessage {
  const base = appUrl();
  const unsubscribeUrl = `${base}/unsubscribe?token=${encodeURIComponent(opts.unsubscribeToken)}`;
  const prefsUrl = `${base}/settings`;
  const hello = opts.name ? `Hi ${esc(opts.name)},` : "Hi there,";
  const items = opts.lessons
    .map(
      (l) => `<div style="padding:16px 0;border-top:1px solid #f0ebe1">
<div style="font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#c2410c;font-weight:600">${esc(l.topicName)}</div>
<a href="${base}/lessons/${l.id}" style="display:block;font-size:17px;font-weight:600;color:#1d2433;text-decoration:none;margin:4px 0">${esc(l.title)}</a>
<div style="font-size:14px;color:#4b5563;line-height:1.5">${esc(l.hook)}</div></div>`,
    )
    .join("");
  const html = layout(
    `<p style="margin:0 0 4px;font-size:16px">${hello}</p>
<p style="margin:0 0 12px;color:#4b5563">Today's lessons are ready. Each one takes about three minutes.</p>
${items}
<a href="${base}/today" style="display:inline-block;margin-top:16px;background:#c2410c;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:600">Read today's lessons</a>`,
    `You get this email because you turned on daily emails.
<a href="${prefsUrl}" style="color:#6b7280">Email preferences</a> · <a href="${unsubscribeUrl}" style="color:#6b7280">Unsubscribe</a>`,
  );
  const text = [
    opts.name ? `Hi ${opts.name},` : "Hi there,",
    "Today's lessons are ready. Each one takes about three minutes.",
    "",
    ...opts.lessons.map((l) => `• [${l.topicName}] ${l.title}\n  ${l.hook}\n  ${base}/lessons/${l.id}`),
    "",
    `Read them here: ${base}/today`,
    `Preferences: ${prefsUrl}`,
    `Unsubscribe: ${unsubscribeUrl}`,
  ].join("\n");
  return {
    to: opts.to,
    subject: opts.lessons.length === 1 ? `Today: ${opts.lessons[0].title}` : `Today: ${opts.lessons[0].title}, and ${opts.lessons.length - 1} more`,
    html,
    text,
    headers: {
      "List-Unsubscribe": `<${unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}

/** Transactional password reset email (no unsubscribe needed). */
export function passwordResetEmail(to: string, token: string): EmailMessage {
  const url = `${appUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  return {
    to,
    subject: `Reset your ${APP_NAME} password`,
    html: layout(
      `<p style="margin:0 0 12px">We received a request to reset your password.</p>
<a href="${url}" style="display:inline-block;background:#c2410c;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:600">Choose a new password</a>
<p style="margin:16px 0 0;font-size:13px;color:#6b7280">This link expires in 1 hour. If you didn't ask for this, you can ignore this email.</p>`,
      `${esc(APP_NAME)} · transactional email`,
    ),
    text: `Reset your password: ${url}\nThis link expires in 1 hour. If you didn't ask for this, ignore this email.`,
  };
}
