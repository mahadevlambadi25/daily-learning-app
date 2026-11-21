import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE, SESSION_TTL_DAYS } from "@/lib/config";
import { generateToken, hashToken } from "./tokens";
import { ApiError } from "@/lib/api";

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

/** Creates a DB-backed session and sets the HTTP-only cookie. */
export async function createSession(userId: string): Promise<void> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000);
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
  if (!session || session.expiresAt < new Date() || !session.user.profile) return null;
  const { user } = session;
  const p = user.profile!;
  return {
    id: user.id,
    email: user.email,
    isAdmin: user.roles.some((r) => r.role === "admin"),
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

/** Signed-in users skip the login/sign-up pages. */
export async function redirectIfSignedIn(): Promise<void> {
  const user = await getSessionUser();
  if (user) redirect(user.profile.onboardedAt ? "/today" : "/onboarding/topics");
}

export async function requirePageUser(opts: { onboarded?: boolean } = { onboarded: true }): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (opts.onboarded && !user.profile.onboardedAt) redirect("/onboarding/topics");
  return user;
}

export async function requirePageAdmin(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/admin");
  if (!user.isAdmin) redirect("/today");
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
