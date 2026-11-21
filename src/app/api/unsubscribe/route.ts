import { ApiError, ok, route } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";
import { unsubscribeByToken } from "@/server/users";

/**
 * One-click unsubscribe (RFC 8058). Mail providers POST here with the token in the query string;
 * the /unsubscribe page posts the same way. No session required: the token is the credential.
 */
export const POST = route(async (req) => {
  enforceRateLimit(req, "unsubscribe", 20, 60_000);
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!token || !(await unsubscribeByToken(token))) throw new ApiError(404, "not_found", "This unsubscribe link is invalid.");
  return ok({ unsubscribed: true });
});
