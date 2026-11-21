import { prisma, isUniqueViolation } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { MAX_TOPICS, MIN_TOPICS } from "@/lib/config";
import { safeTimezone } from "@/lib/time";
import { generateToken, hashPassword, hashToken, verifyPassword } from "@/lib/auth/tokens";
import { getEmailProvider, passwordResetEmail } from "./email";
import { track } from "./analytics";

const RESET_TTL_MS = 60 * 60 * 1000;
let dummyHash: string | undefined;

export async function createUser(input: { email: string; password: string; displayName?: string; timezone?: string }) {
  const passwordHash = await hashPassword(input.password);
  try {
    const user = await prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash,
        profile: {
          create: {
            displayName: input.displayName?.trim() || null,
            timezone: safeTimezone(input.timezone),
            unsubscribeToken: generateToken(24),
          },
        },
        roles: { create: { role: "learner" } },
      },
    });
    await track("signup_completed", user.id);
    return user;
  } catch (err) {
    if (isUniqueViolation(err)) throw new ApiError(409, "email_taken", "An account with this email already exists. Try signing in.");
    throw err;
  }
}

/** Returns the user id when credentials are valid. Same error for unknown email and wrong password. */
export async function authenticate(email: string, password: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  // Compare against a dummy hash for unknown emails to keep response timing similar.
  dummyHash ??= await hashPassword(generateToken());
  const ok = await verifyPassword(password, user?.passwordHash ?? dummyHash);
  if (!user || !ok) throw new ApiError(401, "invalid_credentials", "Email or password is incorrect.");
  return user.id;
}

/** Always resolves silently so the endpoint never reveals whether an email is registered. */
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) return;
  const token = generateToken();
  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + RESET_TTL_MS) },
  });
  const result = await getEmailProvider().send(passwordResetEmail(user.email, token));
  if (!result.ok) console.error("[auth] password reset email failed", result.error);
}

export async function resetPassword(token: string, newPassword: string): Promise<string> {
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new ApiError(400, "invalid_token", "This reset link is invalid or has expired. Request a new one.");
  }
  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    // Sign out everywhere after a password change.
    prisma.session.deleteMany({ where: { userId: record.userId } }),
  ]);
  return record.userId;
}

// ---- Topics -------------------------------------------------------------------

export async function getActiveTopicIds(userId: string): Promise<string[]> {
  const rows = await prisma.userTopic.findMany({
    where: { userId, isActive: true, topic: { isActive: true } },
    select: { topicId: true },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => r.topicId);
}

/**
 * Replaces the user's selected topics. Enforces 1-5 valid, active topic IDs on the server
 * regardless of client validation (PRD §19).
 */
export async function setUserTopics(userId: string, topicIds: string[]): Promise<string[]> {
  const unique = [...new Set(topicIds)];
  if (unique.length < MIN_TOPICS || unique.length > MAX_TOPICS) {
    throw new ApiError(400, "validation_error", `Choose between ${MIN_TOPICS} and ${MAX_TOPICS} topics.`);
  }
  const valid = await prisma.topic.count({ where: { id: { in: unique }, isActive: true } });
  if (valid !== unique.length) throw new ApiError(400, "validation_error", "One or more topics are not available.");

  const before = await getActiveTopicIds(userId);
  await prisma.$transaction([
    prisma.userTopic.updateMany({ where: { userId, topicId: { notIn: unique } }, data: { isActive: false } }),
    ...unique.map((topicId) =>
      prisma.userTopic.upsert({
        where: { userId_topicId: { userId, topicId } },
        create: { userId, topicId, isActive: true },
        update: { isActive: true },
      }),
    ),
  ]);

  const isFirstSelection = before.length === 0;
  const changed = before.length !== unique.length || before.some((id) => !unique.includes(id));
  if (isFirstSelection) await track("onboarding_topics_saved", userId, { count: unique.length, topics: unique.join(",") });
  else if (changed) await track("topic_selection_changed", userId, { count: unique.length, topics: unique.join(",") });
  return unique;
}

// ---- Profile ------------------------------------------------------------------

export async function updateProfile(
  userId: string,
  patch: {
    displayName?: string | null;
    timezone?: string;
    preferredDeliveryTime?: string;
    emailDailyEnabled?: boolean;
    reminderEnabled?: boolean;
    completeOnboarding?: boolean;
  },
) {
  const { completeOnboarding, ...fields } = patch;
  if (completeOnboarding) {
    const topics = await getActiveTopicIds(userId);
    if (topics.length === 0) throw new ApiError(400, "topics_required", "Choose at least one topic first.");
  }
  const existing = await prisma.profile.findUniqueOrThrow({ where: { id: userId } });
  return prisma.profile.update({
    where: { id: userId },
    data: {
      ...fields,
      ...(completeOnboarding && !existing.onboardedAt ? { onboardedAt: new Date() } : {}),
    },
  });
}

/** Self-service account deletion. Personal data cascades; analytics rows are anonymised. */
export async function deleteAccount(userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.analyticsEvent.updateMany({ where: { userId }, data: { userId: null } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);
}

export async function unsubscribeByToken(token: string): Promise<boolean> {
  const res = await prisma.profile.updateMany({
    where: { unsubscribeToken: token },
    data: { emailDailyEnabled: false },
  });
  return res.count > 0;
}
