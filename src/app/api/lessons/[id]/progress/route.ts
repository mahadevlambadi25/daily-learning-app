import { ok, parseJson, route } from "@/lib/api";
import { progressSchema } from "@/lib/validation";
import { requireApiUser } from "@/lib/auth/session";
import { enforceRateLimit } from "@/lib/rate-limit";
import { setProgress, undoCompletion } from "@/server/lessons";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };

const body = z.union([progressSchema, z.object({ status: z.literal("undo") })]);

/** Start, complete (or undo completing) a lesson for the signed-in user only. */
export const POST = route<Ctx>(async (req, { params }) => {
  const user = await requireApiUser();
  enforceRateLimit(req, "progress", 60, 60_000, user.id);
  const { id } = await params;
  const { status } = await parseJson(req, body);
  if (status === "undo") {
    await undoCompletion(user.id, id);
    return ok({ status: "started" });
  }
  const row = await setProgress(user.id, id, status);
  return ok({ status: row.status, completedAt: row.completedAt });
});
