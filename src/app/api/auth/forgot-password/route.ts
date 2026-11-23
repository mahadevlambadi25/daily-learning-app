import { ok, parseJson, route } from "@/lib/api";
import { forgotPasswordSchema } from "@/lib/validation";
import { enforceRateLimit, rateLimit } from "@/lib/rate-limit";
import { requestPasswordReset } from "@/server/users";

/** Always returns the same response so it can't be used to discover registered emails. */
export const POST = route(async (req) => {
  enforceRateLimit(req, "forgot", 5, 15 * 60_000);
  const { email } = await parseJson(req, forgotPasswordSchema);
  // At most 3 reset emails per address per hour. Over the limit we skip sending but answer the
  // same way, so the response never reveals anything about the address.
  if (rateLimit(`forgot-email:${email}`, 3, 60 * 60_000).allowed) await requestPasswordReset(email);
  return ok({ sent: true });
});
