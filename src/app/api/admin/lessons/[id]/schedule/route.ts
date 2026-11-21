import { ok, parseJson, route } from "@/lib/api";
import { scheduleSchema } from "@/lib/validation";
import { requireApiAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { applyLessonAction } from "@/server/admin-lessons";

type Ctx = { params: Promise<{ id: string }> };

/** Schedule an approved lesson (or reschedule a scheduled one). Future timestamp required. */
export const POST = route<Ctx>(async (req, { params }) => {
  const admin = await requireApiAdmin();
  const { id } = await params;
  const { scheduledAt } = await parseJson(req, scheduleSchema);
  const current = await prisma.lesson.findUnique({ where: { id }, select: { status: true } });
  const action = current?.status === "scheduled" ? "reschedule" : "approve_schedule";
  const lesson = await applyLessonAction(id, action, admin.id, scheduledAt);
  return ok({ id: lesson.id, status: lesson.status, scheduledAt: lesson.scheduledAt });
});
