import { ok, parseJson, route } from "@/lib/api";
import { forgotPasswordSchema } from "@/lib/validation";
import { enforceRateLimit } from "@/lib/rate-limit";
import { requestPasswordReset } from "@/server/users";

/** Always returns the same response so it can't be used to discover registered emails. */
export const POST = route(async (req) => {
  enforceRateLimit(req, "forgot", 5, 15 * 60_000);
  const { email } = await parseJson(req, forgotPasswordSchema);
  await requestPasswordReset(email);
  return ok({ sent: true });
});
