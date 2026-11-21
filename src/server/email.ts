import { APP_NAME, appUrl } from "@/lib/config";

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
};

export type SendResult = { ok: true; providerId: string } | { ok: false; error: string; transient: boolean };

export interface EmailProvider {
  name: string;
  send(message: EmailMessage): Promise<SendResult>;
}

/** Dev provider: prints the email to the server log. */
export const consoleProvider: EmailProvider = {
  name: "console",
  async send(m) {
    console.info(`\n[email] to=${m.to} subject="${m.subject}"\n${m.text}\n`);
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

/** Resend HTTP API provider (no SDK dependency). */
function resendProvider(apiKey: string): EmailProvider {
  return {
    name: "resend",
    async send(m) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM,
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

export function getEmailProvider(): EmailProvider {
  const kind = process.env.EMAIL_PROVIDER || "console";
  if (kind === "resend") {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("EMAIL_PROVIDER=resend requires RESEND_API_KEY");
    return resendProvider(key);
  }
  if (kind === "memory") return (memorySingleton ??= createMemoryProvider());
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
  const hello = opts.name ? `Good morning, ${esc(opts.name)}.` : "Good morning.";
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
<p style="margin:0 0 12px;color:#4b5563">Here are today's short lessons, picked from your topics.</p>
${items}
<a href="${base}/today" style="display:inline-block;margin-top:16px;background:#c2410c;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:600">Open today's feed</a>`,
    `You're receiving this because you turned on daily emails.
<a href="${prefsUrl}" style="color:#6b7280">Email preferences</a> · <a href="${unsubscribeUrl}" style="color:#6b7280">Unsubscribe</a>`,
  );
  const text = [
    opts.name ? `Good morning, ${opts.name}.` : "Good morning.",
    "Here are today's short lessons:",
    "",
    ...opts.lessons.map((l) => `• [${l.topicName}] ${l.title}\n  ${l.hook}\n  ${base}/lessons/${l.id}`),
    "",
    `Open today's feed: ${base}/today`,
    `Preferences: ${prefsUrl}`,
    `Unsubscribe: ${unsubscribeUrl}`,
  ].join("\n");
  return {
    to: opts.to,
    subject: opts.lessons.length === 1 ? `Today: ${opts.lessons[0].title}` : `Your ${opts.lessons.length} lessons for today`,
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
