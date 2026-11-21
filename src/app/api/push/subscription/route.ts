import { ApiError, noContent, ok, parseJson, route } from "@/lib/api";
import { pushSubscriptionSchema, pushUnsubscribeSchema } from "@/lib/validation";
import { requireApiUser } from "@/lib/auth/session";
import { enforceRateLimit } from "@/lib/rate-limit";
import { pushConfigured, removeSubscription, saveSubscription } from "@/server/push";

/** Registers this browser for daily reminders. */
export const POST = route(async (req) => {
  const user = await requireApiUser();
  enforceRateLimit(req, "push-sub", 20, 60_000, user.id);
  if (!pushConfigured()) throw new ApiError(503, "push_unavailable", "Reminders aren't set up on this server yet.");
  const { endpoint, keys } = await parseJson(req, pushSubscriptionSchema);
  await saveSubscription(user.id, { endpoint, p256dh: keys.p256dh, auth: keys.auth }, req.headers.get("user-agent")?.slice(0, 300) ?? null);
  return ok({ subscribed: true }, { status: 201 });
});

/** Removes this browser's subscription (own subscriptions only). */
export const DELETE = route(async (req) => {
  const user = await requireApiUser();
  const { endpoint } = await parseJson(req, pushUnsubscribeSchema);
  await removeSubscription(user.id, endpoint);
  return noContent();
});
