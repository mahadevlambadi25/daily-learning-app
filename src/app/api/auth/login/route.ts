import { ok, parseJson, route } from "@/lib/api";
import { loginSchema } from "@/lib/validation";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createSession } from "@/lib/auth/session";
import { authenticate } from "@/server/users";
import { prisma } from "@/lib/db";
import { homeFor } from "@/lib/redirects";

export const POST = route(async (req) => {
  enforceRateLimit(req, "login", 10, 15 * 60_000);
  const { email, password } = await parseJson(req, loginSchema);
  enforceRateLimit(req, "login-email", 8, 15 * 60_000, email);
  const userId = await authenticate(email, password);
  await createSession(userId);
  const [roles, profile] = await Promise.all([
    prisma.role.findMany({ where: { userId }, select: { role: true } }),
    prisma.profile.findUnique({ where: { id: userId }, select: { onboardedAt: true } }),
  ]);
  // Tells the client where to land when there's no ?next= (admins go to the console).
  const home = homeFor({ isAdmin: roles.some((r) => r.role === "admin"), onboarded: Boolean(profile?.onboardedAt) });
  return ok({ id: userId, home });
});
