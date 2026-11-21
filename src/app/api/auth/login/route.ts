import { ok, parseJson, route } from "@/lib/api";
import { loginSchema } from "@/lib/validation";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createSession } from "@/lib/auth/session";
import { authenticate } from "@/server/users";

export const POST = route(async (req) => {
  enforceRateLimit(req, "login", 10, 15 * 60_000);
  const { email, password } = await parseJson(req, loginSchema);
  enforceRateLimit(req, "login-email", 8, 15 * 60_000, email);
  const userId = await authenticate(email, password);
  await createSession(userId);
  return ok({ id: userId });
});
