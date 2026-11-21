import { ok, parseJson, route } from "@/lib/api";
import { quizSubmitSchema } from "@/lib/validation";
import { requireApiUser } from "@/lib/auth/session";
import { enforceRateLimit } from "@/lib/rate-limit";
import { submitQuiz } from "@/server/lessons";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (req, { params }) => {
  const user = await requireApiUser();
  enforceRateLimit(req, "quiz", 30, 60_000, user.id);
  const { id } = await params;
  const { answers } = await parseJson(req, quizSubmitSchema);
  return ok(await submitQuiz(user.id, id, answers));
});
