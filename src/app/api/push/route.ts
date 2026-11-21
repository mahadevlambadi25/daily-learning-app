import { ok, route } from "@/lib/api";
import { pushConfigured, vapidPublicKey } from "@/server/push";

/** Public VAPID key the browser needs to subscribe; `configured: false` hides the reminder device UI. */
export const GET = route(async () => {
  return ok({ configured: pushConfigured(), publicKey: pushConfigured() ? vapidPublicKey() : null });
});
