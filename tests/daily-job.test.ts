import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { runDailyDelivery, MAX_EMAIL_ATTEMPTS } from "@/server/jobs/daily-delivery";
import { createMemoryProvider } from "@/server/email";
import { createMemoryPushSender } from "@/server/push";
import { unsubscribeByToken } from "@/server/users";
import { makeLesson, makeTopic, makeUser, resetDb } from "./helpers";

beforeEach(resetDb);

// 02:00 UTC = 07:30 in Kolkata, 21:00 (previous day) in New York.
const AT_0730_IST = new Date("2026-11-21T02:00:00Z");

async function setup() {
  const t = await makeTopic();
  await makeLesson(t.id);
  await makeLesson(t.id);
  return t;
}

describe("daily delivery job", () => {
  it("emails only opted-in users whose delivery time has arrived", async () => {
    const t = await setup();
    const optedIn = await makeUser({ topicIds: [t.id], emailDailyEnabled: true });
    const optedOut = await makeUser({ topicIds: [t.id], emailDailyEnabled: false });
    const notYet = await makeUser({ topicIds: [t.id], emailDailyEnabled: true, preferredDeliveryTime: "08:00" });
    await makeUser({ topicIds: [t.id], emailDailyEnabled: true, onboarded: false });

    const provider = createMemoryProvider();
    const s = await runDailyDelivery({ now: AT_0730_IST, provider });

    expect(provider.outbox.map((m) => m.to)).toEqual([(await prisma.user.findUniqueOrThrow({ where: { id: optedIn.id } })).email]);
    expect(s.usersChecked).toBe(3); // non-onboarded user is not considered
    expect(s.usersDue).toBe(2);
    expect(s.emailsSent).toBe(1);
    // Opted-out users still get their in-app feed; not-yet-due users get nothing yet.
    expect(await prisma.delivery.count({ where: { userId: optedOut.id } })).toBe(1);
    expect(await prisma.delivery.count({ where: { userId: notYet.id } })).toBe(0);
    const msg = provider.outbox[0];
    expect(msg.text).toContain("/unsubscribe?token=");
    expect(msg.text).toContain("/lessons/");
  });

  it("is idempotent: repeated runs never duplicate deliveries or emails", async () => {
    const t = await setup();
    await makeUser({ topicIds: [t.id], emailDailyEnabled: true });
    const provider = createMemoryProvider();

    await runDailyDelivery({ now: AT_0730_IST, provider });
    await runDailyDelivery({ now: new Date(AT_0730_IST.getTime() + 15 * 60_000), provider });
    await Promise.all([runDailyDelivery({ now: AT_0730_IST, provider }), runDailyDelivery({ now: AT_0730_IST, provider })]);

    expect(provider.outbox).toHaveLength(1);
    expect(await prisma.delivery.count()).toBe(1);
    expect(await prisma.notificationLog.count()).toBe(1);
    expect(await prisma.jobRun.count({ where: { status: "succeeded" } })).toBe(4);
  });

  it("retries transient failures on later runs without duplicating, up to the limit", async () => {
    const t = await setup();
    await makeUser({ topicIds: [t.id], emailDailyEnabled: true });
    const provider = createMemoryProvider();
    provider.failNext = 1;

    const first = await runDailyDelivery({ now: AT_0730_IST, provider });
    expect(first.emailsFailed).toBe(1);
    expect((await prisma.delivery.findFirstOrThrow()).emailStatus).toBe("failed");

    const second = await runDailyDelivery({ now: AT_0730_IST, provider });
    expect(second.emailsSent).toBe(1);
    expect(provider.outbox).toHaveLength(1);
    const log = await prisma.notificationLog.findFirstOrThrow();
    expect(log).toMatchObject({ status: "sent", attempts: 2 });
    expect((await prisma.delivery.findFirstOrThrow()).emailStatus).toBe("sent");

    await runDailyDelivery({ now: AT_0730_IST, provider });
    expect(provider.outbox).toHaveLength(1);
  });

  it("stops retrying after the maximum number of attempts", async () => {
    const t = await setup();
    await makeUser({ topicIds: [t.id], emailDailyEnabled: true });
    const provider = createMemoryProvider();
    provider.failNext = 10;
    for (let i = 0; i < MAX_EMAIL_ATTEMPTS + 2; i++) await runDailyDelivery({ now: AT_0730_IST, provider });
    expect((await prisma.notificationLog.findFirstOrThrow()).attempts).toBe(MAX_EMAIL_ATTEMPTS);
    expect(provider.failNext).toBe(10 - MAX_EMAIL_ATTEMPTS);
  });

  it("handles users in different timezones on their own local dates", async () => {
    const t = await setup();
    const india = await makeUser({ topicIds: [t.id], timezone: "Asia/Kolkata" });
    const ny = await makeUser({ topicIds: [t.id], timezone: "America/New_York", preferredDeliveryTime: "18:00" });
    await runDailyDelivery({ now: AT_0730_IST, provider: createMemoryProvider() });

    expect((await prisma.delivery.findFirstOrThrow({ where: { userId: india.id } })).localDate).toBe("2026-11-21");
    expect((await prisma.delivery.findFirstOrThrow({ where: { userId: ny.id } })).localDate).toBe("2026-11-20");
  });

  it("sends one push reminder per day to subscribed devices of users with reminders on", async () => {
    const t = await setup();
    const on = await makeUser({ topicIds: [t.id] }); // reminderEnabled defaults to true
    const off = await makeUser({ topicIds: [t.id] });
    await prisma.profile.update({ where: { id: off.id }, data: { reminderEnabled: false } });
    const noDevice = await makeUser({ topicIds: [t.id] });
    await prisma.pushSubscription.createMany({
      data: [
        { userId: on.id, endpoint: "https://push.example/a1", p256dh: "k", auth: "a" },
        { userId: on.id, endpoint: "https://push.example/a2", p256dh: "k", auth: "a" },
        { userId: off.id, endpoint: "https://push.example/b", p256dh: "k", auth: "a" },
      ],
    });
    const push = createMemoryPushSender();
    push.goneEndpoints.add("https://push.example/a2"); // expired subscription

    const s = await runDailyDelivery({ now: AT_0730_IST, provider: createMemoryProvider(), pushSender: push });
    await runDailyDelivery({ now: AT_0730_IST, provider: createMemoryProvider(), pushSender: push });

    expect(s.remindersSent).toBe(1);
    expect(push.sent.map((p) => p.endpoint)).toEqual(["https://push.example/a1"]); // once, despite 2 runs
    expect(push.sent[0].payload).toMatchObject({ url: "/today", title: "Your lesson for today is ready" });
    expect(await prisma.pushSubscription.count({ where: { endpoint: "https://push.example/a2" } })).toBe(0); // pruned
    expect(await prisma.notificationLog.count({ where: { userId: noDevice.id, channel: "push" } })).toBe(0);
  });

  it("unsubscribe link turns off daily email", async () => {
    const t = await setup();
    const user = await makeUser({ topicIds: [t.id], emailDailyEnabled: true });
    const profile = await prisma.profile.findUniqueOrThrow({ where: { id: user.id } });

    expect(await unsubscribeByToken("wrong-token")).toBe(false);
    expect(await unsubscribeByToken(profile.unsubscribeToken)).toBe(true);
    const provider = createMemoryProvider();
    await runDailyDelivery({ now: AT_0730_IST, provider });
    expect(provider.outbox).toHaveLength(0);
  });
});
