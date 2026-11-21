import { noContent, ok, route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/session";
import { enforceRateLimit } from "@/lib/rate-limit";
import { addBookmark, removeBookmark } from "@/server/lessons";

type Ctx = { params: Promise<{ id: string }> };

/** Idempotent: bookmarking twice returns 200 instead of 201. */
export const POST = route<Ctx>(async (req, { params }) => {
  const user = await requireApiUser();
  enforceRateLimit(req, "bookmark", 60, 60_000, user.id);
  const { id } = await params;
  const { created } = await addBookmark(user.id, id);
  return ok({ bookmarked: true }, { status: created ? 201 : 200 });
});

export const DELETE = route<Ctx>(async (req, { params }) => {
  const user = await requireApiUser();
  enforceRateLimit(req, "bookmark", 60, 60_000, user.id);
  const { id } = await params;
  await removeBookmark(user.id, id);
  return noContent();
});
