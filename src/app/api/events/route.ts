import { noContent, parseJson, route } from "@/lib/api";
import { clientEventSchema } from "@/lib/validation";
import { requireApiUser } from "@/lib/auth/session";
import { enforceRateLimit } from "@/lib/rate-limit";
import { track } from "@/server/analytics";

/** Client-side analytics for events only the browser can observe (e.g. speech playback). */
export const POST = route(async (req) => {
  const user = await requireApiUser();
  enforceRateLimit(req, "events", 60, 60_000, user.id);
  const { name, properties } = await parseJson(req, clientEventSchema);
  await track(name, user.id, properties ?? {});
  return noContent();
});
