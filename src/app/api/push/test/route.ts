import { ApiError, ok, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/session";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getPushSender, sendToUser } from "@/server/push";

/** Sends a test reminder to the signed-in user's devices so they can confirm it works. */
export const POST = route(async (req) => {
  const user = await requireApiUser();
  enforceRateLimit(req, "push-test", 3, 60_000, user.id);
  const sender = getPushSender();
  if (!sender) throw new ApiError(503, "push_unavailable", "Reminders aren't set up on this server yet.");
  const result = await sendToUser(user.id, { title: "Reminders are on", body: "We'll nudge you when your daily lessons are ready.", url: "/today", tag: "test" }, sender);
  if (result.devices === 0) throw new ApiError(404, "no_devices", "This device isn't subscribed yet.");
  return ok(result);
});
