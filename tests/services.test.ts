import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { createUser, authenticate, deleteAccount, requestPasswordReset, resetPassword, setUserTopics, updateProfile } from "@/server/users";
import { addBookmark, getLessonForLearner, getLibrary, removeBookmark, setProgress, submitQuiz } from "@/server/lessons";
import { applyLessonAction, createLesson, deleteLesson, getContentCoverage, listLessons, updateLesson } from "@/server/admin-lessons";
import { getEmailProvider, createMemoryProvider } from "@/server/email";
import { lessonInputSchema } from "@/lib/validation";
import { makeLesson, makeTopic, makeUser, resetDb } from "./helpers";

beforeEach(resetDb);

async function expectApiError(p: Promise<unknown>, status: number) {
  await expect(p).rejects.toBeInstanceOf(ApiError);
  await p.catch((e: ApiError) => expect(e.status).toBe(status));
}

describe("accounts", () => {
  it("signs up, rejects duplicate emails, and authenticates", async () => {
    await createUser({ email: "New@Example.com", password: "password123", timezone: "Bad/Zone" });
    const u = await prisma.user.findUniqueOrThrow({ where: { email: "new@example.com" }, include: { profile: true, roles: true } });
    expect(u.profile?.timezone).toBe("Asia/Kolkata");
    expect(u.profile?.emailDailyEnabled).toBe(false); // explicit opt-in required
    expect(u.roles.map((r) => r.role)).toEqual(["learner"]);
    expect(u.passwordHash).not.toContain("password123");

    await expectApiError(createUser({ email: "new@example.com", password: "password123" }), 409);
    expect(await authenticate("NEW@example.com", "password123")).toBe(u.id);
    await expectApiError(authenticate("new@example.com", "wrong-pass"), 401);
    await expectApiError(authenticate("nobody@example.com", "password123"), 401);
    expect(await prisma.analyticsEvent.count({ where: { name: "signup_completed" } })).toBe(1);
  });

  it("resets a password with a single-use token and signs out other sessions", async () => {
    await createUser({ email: "r@example.com", password: "password123" });
    const provider = getEmailProvider() as ReturnType<typeof createMemoryProvider>;
    provider.outbox.length = 0;
    await requestPasswordReset("r@example.com");
    await requestPasswordReset("unknown@example.com"); // silent, no email
    expect(provider.outbox).toHaveLength(1);
    const token = decodeURIComponent(provider.outbox[0].text.match(/token=([^\s]+)/)![1]);

    const user = await prisma.user.findUniqueOrThrow({ where: { email: "r@example.com" } });
    await prisma.session.create({ data: { userId: user.id, tokenHash: "h", expiresAt: new Date(Date.now() + 1e6) } });
    await resetPassword(token, "newpassword1");
    expect(await authenticate("r@example.com", "newpassword1")).toBe(user.id);
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
    await expectApiError(resetPassword(token, "another-pass"), 400);
  });

  it("enforces 1-5 active topics on the server", async () => {
    const topics = await Promise.all(Array.from({ length: 6 }, () => makeTopic()));
    const inactive = await makeTopic({ isActive: false });
    const user = await makeUser({ onboarded: false });
    const ids = topics.map((t) => t.id);

    await expectApiError(setUserTopics(user.id, []), 400);
    await expectApiError(setUserTopics(user.id, ids), 400);
    await expectApiError(setUserTopics(user.id, [ids[0], "does-not-exist"]), 400);
    await expectApiError(setUserTopics(user.id, [inactive.id]), 400);

    await setUserTopics(user.id, ids.slice(0, 5));
    await setUserTopics(user.id, [ids[5], ids[0]]);
    const active = await prisma.userTopic.findMany({ where: { userId: user.id, isActive: true } });
    expect(active.map((a) => a.topicId).sort()).toEqual([ids[0], ids[5]].sort());
    expect(await prisma.analyticsEvent.count({ where: { name: "onboarding_topics_saved" } })).toBe(1);
    expect(await prisma.analyticsEvent.count({ where: { name: "topic_selection_changed" } })).toBe(1);
  });

  it("requires topics before onboarding completes and persists preferences", async () => {
    const t = await makeTopic();
    const user = await makeUser({ onboarded: false });
    await expectApiError(updateProfile(user.id, { completeOnboarding: true }), 400);
    await setUserTopics(user.id, [t.id]);
    const p = await updateProfile(user.id, { completeOnboarding: true, timezone: "Europe/London", preferredDeliveryTime: "18:00", emailDailyEnabled: true });
    expect(p).toMatchObject({ timezone: "Europe/London", preferredDeliveryTime: "18:00", emailDailyEnabled: true });
    expect(p.onboardedAt).toBeInstanceOf(Date);
  });

  it("deletes an account and its personal data", async () => {
    const t = await makeTopic();
    const l = await makeLesson(t.id);
    const user = await makeUser({ topicIds: [t.id] });
    await addBookmark(user.id, l.id);
    await deleteAccount(user.id);
    expect(await prisma.user.count({ where: { id: user.id } })).toBe(0);
    expect(await prisma.bookmark.count()).toBe(0);
    expect(await prisma.analyticsEvent.count({ where: { userId: user.id } })).toBe(0);
    expect(await prisma.lesson.count()).toBe(1); // content untouched
  });
});

describe("learner lessons", () => {
  it("never exposes unpublished lessons", async () => {
    const t = await makeTopic();
    const draft = await makeLesson(t.id, { status: "draft" });
    const user = await makeUser();
    expect(await getLessonForLearner(draft.id, user.id)).toBeNull();
    await expectApiError(addBookmark(user.id, draft.id), 404);
    await expectApiError(setProgress(user.id, draft.id, "completed"), 404);
  });

  it("hides quiz answers until submitted, then scores server-side", async () => {
    const t = await makeTopic();
    const l = await makeLesson(t.id, { questions: 2 });
    const user = await makeUser();
    const view = await getLessonForLearner(l.id, user.id);
    expect(JSON.stringify(view)).not.toContain("correctOption");
    expect(JSON.stringify(view)).not.toContain("Because.");

    const [q1, q2] = view!.questions;
    const res = await submitQuiz(user.id, l.id, { [q1.id]: "b", [q2.id]: "a" });
    expect(res).toMatchObject({ score: 1, total: 2 });
    expect(res.results[1]).toMatchObject({ isCorrect: false, correctOption: "b", explanation: "Because." });
  });

  it("keeps bookmarks and progress idempotent and isolated per user", async () => {
    const t = await makeTopic();
    const l = await makeLesson(t.id);
    const [a, b] = [await makeUser(), await makeUser()];

    expect(await addBookmark(a.id, l.id)).toEqual({ created: true });
    expect(await addBookmark(a.id, l.id)).toEqual({ created: false });
    await removeBookmark(b.id, l.id); // B cannot remove A's bookmark
    expect(await prisma.bookmark.count({ where: { userId: a.id } })).toBe(1);

    await setProgress(a.id, l.id, "completed");
    await setProgress(a.id, l.id, "started"); // no downgrade
    await setProgress(a.id, l.id, "completed");
    const rows = await prisma.lessonProgress.findMany({ where: { lessonId: l.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId: a.id, status: "completed" });
    expect(await prisma.analyticsEvent.count({ where: { name: "lesson_completed" } })).toBe(1);

    const viewB = await getLessonForLearner(l.id, b.id);
    expect(viewB).toMatchObject({ completed: false, bookmarked: false });
  });

  it("paginates the library", async () => {
    const t = await makeTopic();
    const user = await makeUser();
    for (let i = 0; i < 5; i++) await addBookmark(user.id, (await makeLesson(t.id)).id);
    const p1 = await getLibrary(user.id, "saved", 1, 2);
    const p3 = await getLibrary(user.id, "saved", 3, 2);
    expect(p1.items).toHaveLength(2);
    expect(p1.hasMore).toBe(true);
    expect(p3.items).toHaveLength(1);
    expect(p3.hasMore).toBe(false);
    expect((await getLibrary(user.id, "completed")).items).toEqual([]);
  });
});

describe("admin CMS", () => {
  const input = (topicId: string, extra: Record<string, unknown> = {}) =>
    lessonInputSchema.parse({
      topicId,
      title: "A lesson",
      hook: "Hook",
      body: Array(180).fill("word").join(" "),
      takeaways: ["a", "b", "c"],
      actionText: "Try it",
      ...extra,
    });

  it("runs the full editorial workflow with validation", async () => {
    const t = await makeTopic();
    const admin = await makeUser({ admin: true });
    const draft = await createLesson(input(t.id), admin.id);
    expect(draft.status).toBe("draft");
    expect(draft.readTimeMinutes).toBe(1);

    // Missing rights basis + sources blocks review/publish.
    await expectApiError(applyLessonAction(draft.id, "submit", admin.id), 400);
    await expectApiError(applyLessonAction(draft.id, "approve_publish", admin.id), 409); // wrong state

    await updateLesson(draft.id, input(t.id, { rightsBasis: "original", sources: [{ sourceTitle: "WHO", sourceUrl: "https://www.who.int" }] }), admin.id);
    await applyLessonAction(draft.id, "submit", admin.id);
    await expectApiError(applyLessonAction(draft.id, "approve_schedule", admin.id, new Date(Date.now() - 1000).toISOString()), 400);
    const scheduled = await applyLessonAction(draft.id, "approve_schedule", admin.id, new Date(Date.now() + 86_400_000).toISOString());
    expect(scheduled.status).toBe("scheduled");
    await applyLessonAction(draft.id, "cancel_schedule", admin.id);
    await applyLessonAction(draft.id, "submit", admin.id);
    const published = await applyLessonAction(draft.id, "approve_publish", admin.id);
    expect(published).toMatchObject({ status: "published", approvedBy: admin.id });
    expect(published.publishedAt).toBeInstanceOf(Date);

    // Published lessons must remain complete after edits.
    await expectApiError(updateLesson(draft.id, input(t.id, { rightsBasis: null }), admin.id), 400);

    await applyLessonAction(draft.id, "unpublish", admin.id);
    await applyLessonAction(draft.id, "archive", admin.id);
    await expectApiError(updateLesson(draft.id, input(t.id), admin.id), 409);
    expect((await applyLessonAction(draft.id, "restore", admin.id)).status).toBe("draft");
    expect(await prisma.auditLog.count({ where: { entityId: draft.id } })).toBeGreaterThanOrEqual(9);
  });

  it("allows lessons without sources when marked non-factual, and honours read-time override", async () => {
    const t = await makeTopic();
    const admin = await makeUser({ admin: true });
    const l = await createLesson(input(t.id, { rightsBasis: "original", requiresSources: false, readTimeMinutes: 4 }), admin.id);
    expect(l.readTimeMinutes).toBe(4);
    await applyLessonAction(l.id, "submit", admin.id);
    expect((await applyLessonAction(l.id, "approve_publish", admin.id)).status).toBe("published");
  });

  it("deletes only unused drafts/archived lessons", async () => {
    const t = await makeTopic();
    const admin = await makeUser({ admin: true });
    const learner = await makeUser({ topicIds: [t.id] });
    const unused = await makeLesson(t.id, { status: "draft" });
    const published = await makeLesson(t.id);
    const used = await makeLesson(t.id, { status: "archived" });
    await prisma.delivery.create({ data: { userId: learner.id, lessonId: used.id, topicId: t.id, localDate: "2026-11-21" } });

    await expectApiError(deleteLesson(published.id, admin.id), 409);
    await expectApiError(deleteLesson(used.id, admin.id), 409);
    await deleteLesson(unused.id, admin.id);
    expect(await prisma.lesson.count({ where: { id: unused.id } })).toBe(0);
    expect(await prisma.lessonSource.count({ where: { lessonId: unused.id } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { entityId: unused.id, action: "delete" } })).toBe(1);
  });

  it("filters and searches lessons and reports coverage", async () => {
    const [t1, t2] = [await makeTopic(), await makeTopic()];
    await makeLesson(t1.id, { title: "Budget basics" });
    await makeLesson(t1.id, { title: "Draft idea", status: "draft", rightsBasis: null });
    await makeLesson(t2.id, { title: "Scheduled one", status: "scheduled", scheduledAt: new Date("2026-12-01T10:00:00Z") });

    expect((await listLessons({ q: "Budget" })).items.map((l) => l.title)).toEqual(["Budget basics"]);
    expect((await listLessons({ status: "draft" })).items[0].warnings).toContain("Rights basis missing");
    expect((await listLessons({ topicId: t2.id })).total).toBe(1);
    expect((await listLessons({ scheduledDate: "2026-12-01" })).total).toBe(1);
    const coverage = await getContentCoverage();
    expect(coverage.find((c) => c.id === t1.id)?.published).toBe(1);
    expect(coverage.find((c) => c.id === t2.id)?.published).toBe(0);
  });
});
