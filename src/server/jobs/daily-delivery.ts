import { prisma, isUniqueViolation } from "@/lib/db";
import { localDate, localTime, safeTimezone } from "@/lib/time";
import { assignDailyLessons, publishDueLessons } from "../feed";
import { getActiveTopicIds } from "../users";
import { dailyDigestEmail, getEmailProvider, type EmailProvider } from "../email";
import { track } from "../analytics";
import { getPushSender, sendToUser, type PushSender } from "../push";

export const MAX_EMAIL_ATTEMPTS = 3;
const CHANNEL = "email";
const TEMPLATE = "daily_digest";
const PUSH_CHANNEL = "push";
const PUSH_TEMPLATE = "daily_reminder";

export type DailyJobSummary = {
  lessonsAutoPublished: number;
  usersChecked: number;
  usersDue: number;
  lessonsAssigned: number;
  emailsSent: number;
  emailsFailed: number;
  emailsSkipped: number;
  remindersSent: number;
  remindersFailed: number;
  lowCoverageTopicIds: string[];
};

/**
 * Runs every ~15 minutes (PRD §9). For each onboarded user whose local delivery time has
 * arrived: assign today's lessons, then send the digest if they opted in. Safe to re-run:
 * assignments use unique constraints and each email is claimed via a unique
 * notification_log row (user/channel/template/local_date) before sending. Push reminders
 * follow the same pattern for users with the reminder on and a subscribed device.
 */
export async function runDailyDelivery(
  opts: { now?: Date; provider?: EmailProvider; pushSender?: PushSender | null; batchSize?: number } = {},
) {
  const now = opts.now ?? new Date();
  const provider = opts.provider ?? getEmailProvider();
  const pushSender = opts.pushSender === undefined ? getPushSender() : opts.pushSender;
  const batchSize = opts.batchSize ?? 200;
  const run = await prisma.jobRun.create({ data: { jobName: "daily-delivery", status: "running" } });

  const summary: DailyJobSummary = {
    lessonsAutoPublished: 0,
    usersChecked: 0,
    usersDue: 0,
    lessonsAssigned: 0,
    emailsSent: 0,
    emailsFailed: 0,
    emailsSkipped: 0,
    remindersSent: 0,
    remindersFailed: 0,
    lowCoverageTopicIds: [],
  };
  const lowCoverage = new Set<string>();

  try {
    summary.lessonsAutoPublished = await publishDueLessons(now);

    let cursor: string | undefined;
    for (;;) {
      const profiles = await prisma.profile.findMany({
        where: { onboardedAt: { not: null } },
        orderBy: { id: "asc" },
        take: batchSize,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        include: { user: { select: { email: true } } },
      });
      if (!profiles.length) break;
      cursor = profiles[profiles.length - 1].id;

      for (const p of profiles) {
        summary.usersChecked++;
        try {
          const tz = safeTimezone(p.timezone);
          if (localTime(tz, now) < p.preferredDeliveryTime) continue; // window not reached yet
          summary.usersDue++;
          const date = localDate(tz, now);
          const { created, missingTopicIds } = await assignDailyLessons(p.id, date, now);
          summary.lessonsAssigned += created.length;
          missingTopicIds.forEach((t) => lowCoverage.add(t));

          if (p.emailDailyEnabled) {
            const outcome = await sendDigest({ userId: p.id, email: p.user.email, name: p.displayName, unsubscribeToken: p.unsubscribeToken }, date, provider);
            if (outcome === "sent") summary.emailsSent++;
            else if (outcome === "failed") summary.emailsFailed++;
            else summary.emailsSkipped++;
          }

          if (p.reminderEnabled && pushSender) {
            const outcome = await sendReminder(p.id, date, pushSender);
            if (outcome === "sent") summary.remindersSent++;
            else if (outcome === "failed") summary.remindersFailed++;
          }
        } catch (err) {
          // One bad user must not stop the batch.
          console.error("[daily-delivery] user failed", p.id, err);
        }
      }
      if (profiles.length < batchSize) break;
    }

    summary.lowCoverageTopicIds = [...lowCoverage];
    if (lowCoverage.size) console.warn(`[daily-delivery] ${lowCoverage.size} topic(s) have no eligible lessons for some users`);
    await prisma.jobRun.update({ where: { id: run.id }, data: { status: "succeeded", summary: JSON.stringify(summary), finishedAt: new Date() } });
    return summary;
  } catch (err) {
    await prisma.jobRun.update({
      where: { id: run.id },
      data: { status: "failed", summary: JSON.stringify({ ...summary, error: String(err) }), finishedAt: new Date() },
    });
    throw err;
  }
}

/** One push reminder per user per local date, to every subscribed device. */
async function sendReminder(userId: string, date: string, sender: PushSender): Promise<"sent" | "failed" | "skipped"> {
  // Only claim the slot when a device exists, so subscribing later the same day still works.
  if ((await prisma.pushSubscription.count({ where: { userId } })) === 0) return "skipped";
  const topicIds = await getActiveTopicIds(userId);
  const lessons = await prisma.delivery.findMany({
    where: { userId, localDate: date, topicId: { in: topicIds }, lesson: { status: "published" } },
    select: { lesson: { select: { title: true } } },
  });
  if (!lessons.length) return "skipped";

  const claimed = await claimSlot({ userId, channel: PUSH_CHANNEL, templateKey: PUSH_TEMPLATE, localDate: date });
  if (!claimed) return "skipped";

  const result = await sendToUser(
    userId,
    {
      title: lessons.length === 1 ? "Your lesson for today is ready" : `Your ${lessons.length} lessons for today are ready`,
      body: lessons[0].lesson.title,
      url: "/today",
      tag: `daily-${date}`,
    },
    sender,
  );
  const ok = result.sent > 0;
  await prisma.notificationLog.update({
    where: { id: claimed },
    data: ok
      ? { status: "sent", errorMessage: null }
      : { status: "failed", errorMessage: result.lastError ?? "no devices", ...(result.devices === 0 ? { attempts: MAX_EMAIL_ATTEMPTS } : {}) },
  });
  return ok ? "sent" : "failed";
}

type Recipient = { userId: string; email: string; name: string | null; unsubscribeToken: string };

/** Claims the (user, date) email slot, sends, and records the outcome. */
async function sendDigest(r: Recipient, date: string, provider: EmailProvider): Promise<"sent" | "failed" | "skipped"> {
  const key = { userId: r.userId, channel: CHANNEL, templateKey: TEMPLATE, localDate: date };
  const claimed = await claimSlot(key);
  if (!claimed) return "skipped";

  const topicIds = await getActiveTopicIds(r.userId);
  const deliveries = await prisma.delivery.findMany({
    where: { userId: r.userId, localDate: date, topicId: { in: topicIds }, lesson: { status: "published" } },
    include: { lesson: { select: { id: true, title: true, hook: true, topic: { select: { name: true } } } } },
  });
  if (!deliveries.length) {
    await prisma.notificationLog.update({ where: { id: claimed }, data: { status: "skipped", errorMessage: "no lessons assigned" } });
    return "skipped";
  }

  const message = dailyDigestEmail({
    to: r.email,
    name: r.name,
    unsubscribeToken: r.unsubscribeToken,
    lessons: deliveries.map((d) => ({ id: d.lesson.id, title: d.lesson.title, hook: d.lesson.hook, topicName: d.lesson.topic.name })),
  });
  // Same key on retries: if the provider already accepted it, it won't send a second copy.
  const result = await provider.send({ ...message, idempotencyKey: `daily-digest/${r.userId}/${date}` });
  const ids = deliveries.map((d) => d.id);

  if (result.ok) {
    await prisma.$transaction([
      prisma.notificationLog.update({ where: { id: claimed }, data: { status: "sent", providerId: result.providerId, errorMessage: null } }),
      prisma.delivery.updateMany({ where: { id: { in: ids } }, data: { emailStatus: "sent", emailSentAt: new Date() } }),
    ]);
    await track("daily_email_sent", r.userId, { localDate: date, lessons: ids.length });
    return "sent";
  }

  await prisma.$transaction([
    prisma.notificationLog.update({
      where: { id: claimed },
      // Permanent failures are not retried.
      data: { status: "failed", errorMessage: result.error.slice(0, 500), ...(result.transient ? {} : { attempts: MAX_EMAIL_ATTEMPTS }) },
    }),
    prisma.delivery.updateMany({ where: { id: { in: ids } }, data: { emailStatus: "failed" } }),
  ]);
  await track("daily_email_failed", r.userId, { localDate: date, error: result.error.slice(0, 200) });
  return "failed";
}

/**
 * Returns the notification_log id if this run owns the send, else null.
 * New slot: insert (unique key = idempotency). Failed slot: retry via a conditional update so
 * only one concurrent run wins. Sent/sending/skipped slots are never re-sent.
 */
async function claimSlot(key: { userId: string; channel: string; templateKey: string; localDate: string }): Promise<string | null> {
  try {
    const row = await prisma.notificationLog.create({ data: { ...key, status: "sending", attempts: 1 } });
    return row.id;
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
  }
  const existing = await prisma.notificationLog.findUnique({ where: { userId_channel_templateKey_localDate: key } });
  if (!existing || existing.status !== "failed" || existing.attempts >= MAX_EMAIL_ATTEMPTS) return null;
  const res = await prisma.notificationLog.updateMany({
    where: { id: existing.id, status: "failed", attempts: existing.attempts },
    data: { status: "sending", attempts: existing.attempts + 1 },
  });
  return res.count ? existing.id : null;
}
