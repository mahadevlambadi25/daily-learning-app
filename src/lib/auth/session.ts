import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/config";
import { generateToken, hashToken } from "./tokens";
import { isSessionActive, sessionTtlMs } from "./policy";
import { ApiError } from "@/lib/api";
import { homeFor, safeNext } from "@/lib/redirects";

export type SessionUser = {
  id: string;
  email: string;
  isAdmin: boolean;
  profile: {
    displayName: string | null;
    timezone: string;
    preferredDeliveryTime: string;
    emailDailyEnabled: boolean;
    reminderEnabled: boolean;
    onboardedAt: Date | null;
  };
};

/**
 * Creates a DB-backed session and sets the HTTP-only cookie.
 * Lifetime depends on role: 24 hours for admins, 30 days for learners.
 */
export async function createSession(userId: string): Promise<void> {
  const isAdmin = (await prisma.role.count({ where: { userId, role: "admin" } })) > 0;
  const token = generateToken();
  const expiresAt = new Date(Date.now() + sessionTtlMs(isAdmin));
  await prisma.session.create({ data: { tokenHash: hashToken(token), userId, expiresAt } });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  jar.delete(SESSION_COOKIE);
}

/**
 * Resolves the signed-in user from the session cookie (never from client-supplied IDs).
 * Cached per request so layouts and pages share one lookup.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { include: { profile: true, roles: true } } },
  });
  if (!session || !session.user.profile) return null;
  const { user } = session;
  const isAdmin = user.roles.some((r) => r.role === "admin");
  // Enforced on every request, so older 30-day admin sessions are capped at 24h too.
  if (!isSessionActive(session, isAdmin)) {
    await prisma.session.deleteMany({ where: { id: session.id } });
    return null;
  }
  const p = user.profile!;
  return {
    id: user.id,
    email: user.email,
    isAdmin,
    profile: {
      displayName: p.displayName,
      timezone: p.timezone,
      preferredDeliveryTime: p.preferredDeliveryTime,
      emailDailyEnabled: p.emailDailyEnabled,
      reminderEnabled: p.reminderEnabled,
      onboardedAt: p.onboardedAt,
    },
  };
});

// ---- Page guards (server components) ---------------------------------------

/**
 * Signed-in users skip the login/sign-up pages and go to ?next= (or their home).
 * Exception: a learner asked to sign in for an admin page is returned, so the page can
 * explain they need an admin account instead of bouncing them around.
 */
export async function redirectIfSignedIn(next?: string): Promise<SessionUser | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const target = safeNext(next);
  if (target?.startsWith("/admin") && !user.isAdmin) return user;
  redirect(target ?? homeFor({ isAdmin: user.isAdmin, onboarded: Boolean(user.profile.onboardedAt) }));
}

export async function requirePageUser(opts: { onboarded?: boolean } = { onboarded: true }): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (opts.onboarded && !user.profile.onboardedAt) redirect("/onboarding/topics");
  return user;
}

export async function requirePageAdmin(): Promise<SessionUser> {
  const user = await getSessionUser();
  // Signed-out users and learners both go to sign-in, which explains what's needed.
  if (!user || !user.isAdmin) redirect("/login?next=/admin");
  return user;
}

// ---- API guards (route handlers) -------------------------------------------

export async function requireApiUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new ApiError(401, "unauthenticated", "Please sign in.");
  return user;
}

export async function requireApiAdmin(): Promise<SessionUser> {
  const user = await requireApiUser();
  if (!user.isAdmin) throw new ApiError(403, "forbidden", "Admin access required.");
  return user;
}
