import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { assignDailyLessons, getTodayFeed, publishDueLessons } from "@/server/feed";
import { setProgress } from "@/server/lessons";
import { makeLesson, makeTopic, makeUser, resetDb } from "./helpers";

const NOW = new Date("2026-11-21T06:00:00Z"); // 11:30 in Kolkata

beforeEach(resetDb);

describe("daily assignment", () => {
  it("assigns one lesson per selected topic, oldest published first", async () => {
    const [t1, t2] = [await makeTopic(), await makeTopic()];
    const newer = await makeLesson(t1.id, { publishedAt: new Date("2026-02-01") });
    const older = await makeLesson(t1.id, { publishedAt: new Date("2026-01-01") });
    const other = await makeLesson(t2.id);
    const user = await makeUser({ topicIds: [t1.id, t2.id] });

    const r = await assignDailyLessons(user.id, "2026-11-21", NOW);
    expect(r.created.sort()).toEqual([older.id, other.id].sort());
    expect(r.created).not.toContain(newer.id);
  });

  it("is idempotent: re-running for the same date creates nothing new", async () => {
    const t = await makeTopic();
    await makeLesson(t.id);
    await makeLesson(t.id);
    const user = await makeUser({ topicIds: [t.id] });

    await assignDailyLessons(user.id, "2026-11-21", NOW);
    const again = await assignDailyLessons(user.id, "2026-11-21", NOW);
    // Concurrent runs are also safe (unique constraints).
    await Promise.all([1, 2, 3].map(() => assignDailyLessons(user.id, "2026-11-21", NOW)));
    expect(again.created).toEqual([]);
    expect(await prisma.delivery.count({ where: { userId: user.id } })).toBe(1);
  });

  it("never assigns the same lesson twice across days", async () => {
    const t = await makeTopic();
    const a = await makeLesson(t.id, { publishedAt: new Date("2026-01-01") });
    const b = await makeLesson(t.id, { publishedAt: new Date("2026-01-02") });
    const user = await makeUser({ topicIds: [t.id] });

    expect((await assignDailyLessons(user.id, "2026-11-21", NOW)).created).toEqual([a.id]);
    expect((await assignDailyLessons(user.id, "2026-11-22", NOW)).created).toEqual([b.id]);
    const third = await assignDailyLessons(user.id, "2026-11-23", NOW);
    expect(third.created).toEqual([]);
    expect(third.missingTopicIds).toEqual([t.id]);
  });

  it("skips lessons the user already completed", async () => {
    const t = await makeTopic();
    const a = await makeLesson(t.id, { publishedAt: new Date("2026-01-01") });
    const b = await makeLesson(t.id, { publishedAt: new Date("2026-01-02") });
    const user = await makeUser({ topicIds: [t.id] });
    await setProgress(user.id, a.id, "completed");

    expect((await assignDailyLessons(user.id, "2026-11-21", NOW)).created).toEqual([b.id]);
  });

  it("only assigns published lessons whose publish time has passed", async () => {
    const t = await makeTopic();
    await makeLesson(t.id, { status: "draft" });
    await makeLesson(t.id, { status: "in_review" });
    await makeLesson(t.id, { status: "archived" });
    await makeLesson(t.id, { publishedAt: new Date("2027-01-01") }); // future
    const user = await makeUser({ topicIds: [t.id] });

    const r = await assignDailyLessons(user.id, "2026-11-21", NOW);
    expect(r.created).toEqual([]);
    expect(r.missingTopicIds).toEqual([t.id]);
  });

  it("repeats evergreen lessons only after the cooldown", async () => {
    const t = await makeTopic();
    const evergreen = await makeLesson(t.id, { isRepeatable: true });
    const user = await makeUser({ topicIds: [t.id] });

    expect((await assignDailyLessons(user.id, "2026-01-01", NOW)).created).toEqual([evergreen.id]);
    expect((await assignDailyLessons(user.id, "2026-01-02", NOW)).created).toEqual([]);
    expect((await assignDailyLessons(user.id, "2026-04-01", NOW)).created).toEqual([evergreen.id]);
  });

  it("auto-publishes scheduled lessons when their time arrives", async () => {
    const t = await makeTopic();
    const due = await makeLesson(t.id, { status: "scheduled", scheduledAt: new Date("2026-11-21T05:00:00Z") });
    const later = await makeLesson(t.id, { status: "scheduled", scheduledAt: new Date("2026-11-22T05:00:00Z") });

    expect(await publishDueLessons(NOW)).toBe(1);
    expect((await prisma.lesson.findUniqueOrThrow({ where: { id: due.id } })).status).toBe("published");
    expect((await prisma.lesson.findUniqueOrThrow({ where: { id: later.id } })).status).toBe("scheduled");
    expect(await publishDueLessons(NOW)).toBe(0);
  });
});

describe("today feed", () => {
  it("uses the user's local date and shows only active topics", async () => {
    const [t1, t2] = [await makeTopic(), await makeTopic()];
    const l1 = await makeLesson(t1.id);
    await makeLesson(t2.id);
    const user = await makeUser({ topicIds: [t1.id, t2.id], timezone: "America/New_York" });

    const feed = await getTodayFeed(user.id, "America/New_York", new Date("2026-11-22T03:00:00Z"));
    expect(feed.localDate).toBe("2026-11-21"); // still the 21st in New York
    expect(feed.items).toHaveLength(2);

    await prisma.userTopic.updateMany({ where: { userId: user.id, topicId: t2.id }, data: { isActive: false } });
    const after = await getTodayFeed(user.id, "America/New_York", new Date("2026-11-22T03:00:00Z"));
    expect(after.items.map((i) => i.lesson.id)).toEqual([l1.id]);
  });

  it("reports selected topics without content as empty states", async () => {
    const [t1, t2] = [await makeTopic(), await makeTopic({ name: "Empty topic" })];
    await makeLesson(t1.id);
    const user = await makeUser({ topicIds: [t1.id, t2.id] });

    const feed = await getTodayFeed(user.id, "Asia/Kolkata", NOW);
    expect(feed.items).toHaveLength(1);
    expect(feed.emptyTopics.map((t) => t.name)).toEqual(["Empty topic"]);
  });

  it("hides a lesson that was unpublished after assignment", async () => {
    const t = await makeTopic();
    const l = await makeLesson(t.id);
    const user = await makeUser({ topicIds: [t.id] });
    await getTodayFeed(user.id, "Asia/Kolkata", NOW);
    await prisma.lesson.update({ where: { id: l.id }, data: { status: "draft" } });

    expect((await getTodayFeed(user.id, "Asia/Kolkata", NOW)).items).toEqual([]);
  });

  it("reflects completion and bookmark state", async () => {
    const t = await makeTopic();
    const l = await makeLesson(t.id);
    const user = await makeUser({ topicIds: [t.id] });
    await setProgress(user.id, l.id, "completed");
    await prisma.bookmark.create({ data: { userId: user.id, lessonId: l.id } });

    // Completed today, so it is not re-assigned; the delivery made earlier today still shows it.
    await prisma.delivery.create({ data: { userId: user.id, lessonId: l.id, topicId: t.id, localDate: "2026-11-21" } });
    const feed = await getTodayFeed(user.id, "Asia/Kolkata", NOW);
    expect(feed.items[0]).toMatchObject({ completed: true, bookmarked: true });
  });
});
