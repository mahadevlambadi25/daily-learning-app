import { timingSafeEqual } from "node:crypto";
import { ApiError, ok, route } from "@/lib/api";
import { runDailyDelivery } from "@/server/jobs/daily-delivery";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorize(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) throw new ApiError(500, "misconfigured", "CRON_SECRET is not configured.");
  const given = Buffer.from((req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, ""));
  const expected = Buffer.from(secret);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    throw new ApiError(401, "unauthenticated", "Invalid job secret.");
  }
}

/** Internal: run due deliveries. Idempotent; call every 15 minutes with `Authorization: Bearer $CRON_SECRET`. */
export const POST = route(async (req) => {
  authorize(req);
  return ok(await runDailyDelivery());
});

// Vercel Cron issues GET requests with the same Authorization header.
export const GET = POST;
