import { ok, parseJson, route } from "@/lib/api";
import { changePasswordSchema } from "@/lib/validation";
import { createSession, requireApiUser } from "@/lib/auth/session";
import { enforceRateLimit } from "@/lib/rate-limit";
import { changePassword } from "@/server/users";

/**
 * Change password while signed in. Verifies the current password, enforces the policy,
 * signs out every session (all devices), then signs this device back in with a fresh session.
 */
export const POST = route(async (req) => {
  const user = await requireApiUser();
  // Guessing the current password from a stolen session must be slow.
  enforceRateLimit(req, "change-password", 5, 15 * 60_000, user.id);
  const { currentPassword, newPassword } = await parseJson(req, changePasswordSchema);
  await changePassword(user.id, currentPassword, newPassword);
  await createSession(user.id);
  return ok({ changed: true, otherSessionsSignedOut: true });
});
