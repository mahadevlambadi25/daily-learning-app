import { prisma } from "@/lib/db";
import { generateToken } from "@/lib/auth/tokens";

let seq = 0;
const next = () => ++seq;

/** Clears all tables (children first). */
export async function resetDb() {
  await prisma.$transaction([
    prisma.analyticsEvent.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.jobRun.deleteMany(),
    prisma.notificationLog.deleteMany(),
    prisma.pushSubscription.deleteMany(),
    prisma.quizAttempt.deleteMany(),
    prisma.bookmark.deleteMany(),
    prisma.lessonProgress.deleteMany(),
    prisma.delivery.deleteMany(),
    prisma.lessonQuestion.deleteMany(),
    prisma.lessonSource.deleteMany(),
    prisma.lesson.deleteMany(),
    prisma.userTopic.deleteMany(),
    prisma.topic.deleteMany(),
    prisma.session.deleteMany(),
    prisma.passwordResetToken.deleteMany(),
    prisma.role.deleteMany(),
    prisma.profile.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

export async function makeTopic(overrides: Partial<{ isActive: boolean; name: string }> = {}) {
  const n = next();
  return prisma.topic.create({
    data: {
      slug: `topic-${n}`,
      name: overrides.name ?? `Topic ${n}`,
      description: "desc",
      groupName: "Group",
      iconKey: "brain",
      displayOrder: n,
      isActive: overrides.isActive ?? true,
    },
  });
}

const BODY = Array.from({ length: 180 }, (_, i) => `word${i}`).join(" ");

export async function makeLesson(
  topicId: string,
  o: Partial<{
    status: string;
    publishedAt: Date;
    scheduledAt: Date;
    rightsBasis: string | null;
    withSource: boolean;
    isRepeatable: boolean;
    title: string;
    questions: number;
  }> = {},
) {
  const n = next();
  const status = o.status ?? "published";
  return prisma.lesson.create({
    data: {
      topicId,
      title: o.title ?? `Lesson ${n}`,
      hook: "Why it matters.",
      body: BODY,
      takeaway1: "One",
      takeaway2: "Two",
      takeaway3: "Three",
      actionText: "Do the thing.",
      readTimeMinutes: 2,
      rightsBasis: o.rightsBasis === undefined ? "original" : o.rightsBasis,
      isRepeatable: o.isRepeatable ?? false,
      status,
      publishedAt: status === "published" ? (o.publishedAt ?? new Date(Date.UTC(2026, 0, 1, 0, 0, n))) : null,
      scheduledAt: o.scheduledAt ?? null,
      sources: o.withSource === false ? undefined : { create: [{ sourceTitle: "Source", sourceUrl: "https://example.org" }] },
      questions: o.questions
        ? {
            create: Array.from({ length: o.questions }, (_, i) => ({
              question: `Q${i}`,
              optionA: "A",
              optionB: "B",
              optionC: "C",
              optionD: "D",
              correctOption: "b",
              explanation: "Because.",
              displayOrder: i,
            })),
          }
        : undefined,
    },
  });
}

export async function makeUser(
  o: Partial<{
    topicIds: string[];
    timezone: string;
    preferredDeliveryTime: string;
    emailDailyEnabled: boolean;
    onboarded: boolean;
    admin: boolean;
  }> = {},
) {
  const n = next();
  const user = await prisma.user.create({
    data: {
      email: `user${n}@test.dev`,
      passwordHash: "x",
      profile: {
        create: {
          timezone: o.timezone ?? "Asia/Kolkata",
          preferredDeliveryTime: o.preferredDeliveryTime ?? "07:00",
          emailDailyEnabled: o.emailDailyEnabled ?? false,
          onboardedAt: o.onboarded === false ? null : new Date(),
          unsubscribeToken: generateToken(24),
        },
      },
      roles: { create: [{ role: "learner" }, ...(o.admin ? [{ role: "admin" }] : [])] },
    },
  });
  for (const topicId of o.topicIds ?? []) await prisma.userTopic.create({ data: { userId: user.id, topicId } });
  return user;
}
