import { ok, parseJson, route } from "@/lib/api";
import { lessonInputSchema } from "@/lib/validation";
import { requireApiAdmin } from "@/lib/auth/session";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createLesson, listLessons } from "@/server/admin-lessons";

/** GET /api/admin/lessons?q=&topicId=&status=&scheduledDate=YYYY-MM-DD&page= */
export const GET = route(async (req) => {
  await requireApiAdmin();
  const p = new URL(req.url).searchParams;
  const result = await listLessons({
    q: p.get("q") ?? undefined,
    topicId: p.get("topicId") ?? undefined,
    status: p.get("status") ?? undefined,
    scheduledDate: p.get("scheduledDate") ?? undefined,
    page: Number(p.get("page")) || 1,
  });
  return ok(result.items, { meta: { total: result.total, page: result.page, pageCount: result.pageCount } });
});

/** Creates a lesson as Draft. Never publishes. */
export const POST = route(async (req) => {
  const admin = await requireApiAdmin();
  enforceRateLimit(req, "admin-write", 60, 60_000, admin.id);
  const input = await parseJson(req, lessonInputSchema);
  const lesson = await createLesson(input, admin.id);
  return ok({ id: lesson.id, status: lesson.status }, { status: 201 });
});
