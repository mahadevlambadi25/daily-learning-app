import { sendNotification, setVapidDetails, WebPushError } from "web-push";
import { prisma } from "@/lib/db";

/**
 * Web Push daily reminders (the "Daily learning reminder" preference, PRD §7.3).
 * Needs VAPID keys: `npx web-push generate-vapid-keys`, then set VAPID_PUBLIC_KEY,
 * VAPID_PRIVATE_KEY and VAPID_SUBJECT (mailto: or https: contact).
 */

export type PushPayload = { title: string; body: string; url: string; tag?: string };
type Sub = { endpoint: string; p256dh: string; auth: string };
export type PushResult = { ok: true } | { ok: false; gone: boolean; error: string };

export interface PushSender {
  send(sub: Sub, payload: PushPayload): Promise<PushResult>;
}

export function vapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}

export function pushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let vapidReady = false;
const webPushSender: PushSender = {
  async send(sub, payload) {
    if (!vapidReady) {
      setVapidDetails(process.env.VAPID_SUBJECT || "mailto:support@example.com", process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
      vapidReady = true;
    }
    try {
      await sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), { TTL: 6 * 3600, urgency: "normal" });
      return { ok: true };
    } catch (err) {
      if (err instanceof WebPushError) {
        // 404/410: the browser dropped this subscription; it will never work again.
        return { ok: false, gone: err.statusCode === 404 || err.statusCode === 410, error: `HTTP ${err.statusCode}` };
      }
      return { ok: false, gone: false, error: err instanceof Error ? err.message : "push failed" };
    }
  },
};

/** In-memory sender for tests; `goneEndpoints` simulate expired subscriptions. */
export function createMemoryPushSender() {
  const s = {
    sent: [] as { endpoint: string; payload: PushPayload }[],
    goneEndpoints: new Set<string>(),
    async send(sub: Sub, payload: PushPayload): Promise<PushResult> {
      if (s.goneEndpoints.has(sub.endpoint)) return { ok: false, gone: true, error: "HTTP 410" };
      s.sent.push({ endpoint: sub.endpoint, payload });
      return { ok: true };
    },
  };
  return s;
}

/** Returns null when push isn't configured, so callers simply skip reminders. */
export function getPushSender(): PushSender | null {
  return pushConfigured() ? webPushSender : null;
}

export async function saveSubscription(userId: string, sub: Sub, userAgent: string | null) {
  // Endpoint is unique per browser: if another account used this browser before, it moves to this user.
  return prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    create: { userId, ...sub, userAgent },
    update: { userId, p256dh: sub.p256dh, auth: sub.auth, userAgent },
  });
}

export async function removeSubscription(userId: string, endpoint: string) {
  await prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
}

/** Sends to every device of a user; removes subscriptions the push service reports as gone. */
export async function sendToUser(userId: string, payload: PushPayload, sender: PushSender) {
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  let sent = 0;
  let failed = 0;
  let lastError: string | null = null;
  for (const s of subs) {
    const r = await sender.send(s, payload);
    if (r.ok) sent++;
    else {
      failed++;
      lastError = r.error;
      if (r.gone) await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => undefined);
    }
  }
  return { devices: subs.length, sent, failed, lastError };
}
