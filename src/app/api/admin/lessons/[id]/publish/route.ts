import { ok, route } from "@/lib/api";
import { requireApiAdmin } from "@/lib/auth/session";
import { applyLessonAction } from "@/server/admin-lessons";

type Ctx = { params: Promise<{ id: string }> };

/** Publish an approved (in review) lesson now. Validates rights basis and sources. */
export const POST = route<Ctx>(async (_req, { params }) => {
  const admin = await requireApiAdmin();
  const { id } = await params;
  const lesson = await applyLessonAction(id, "approve_publish", admin.id);
  return ok({ id: lesson.id, status: lesson.status, publishedAt: lesson.publishedAt });
});
