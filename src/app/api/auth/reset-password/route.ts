import { ok, parseJson, route } from "@/lib/api";
import { resetPasswordSchema } from "@/lib/validation";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createSession } from "@/lib/auth/session";
import { resetPassword } from "@/server/users";

export const POST = route(async (req) => {
  enforceRateLimit(req, "reset", 10, 15 * 60_000);
  const { token, password } = await parseJson(req, resetPasswordSchema);
  const userId = await resetPassword(token, password);
  await createSession(userId);
  return ok({ reset: true });
});
