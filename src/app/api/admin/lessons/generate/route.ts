import { ApiError, ok, parseJson, route } from "@/lib/api";
import { aiDraftRequestSchema } from "@/lib/validation";
import { requireApiAdmin } from "@/lib/auth/session";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createAiDraft, getDraftProvider } from "@/server/ai";

export const maxDuration = 60; // fits the Vercel Hobby limit

/** Admin-only AI draft generation (PRD §11, P1). Saves as Draft; never publishes. */
export const POST = route(async (req) => {
  const admin = await requireApiAdmin();
  const provider = getDraftProvider();
  if (!provider) throw new ApiError(503, "ai_unavailable", "AI drafting isn't configured. Set GEMINI_API_KEY on the server.");
  enforceRateLimit(req, "ai-draft", 5, 10 * 60_000, admin.id);
  const input = await parseJson(req, aiDraftRequestSchema);
  const lesson = await createAiDraft(input, admin.id, provider);
  return ok({ id: lesson.id, status: lesson.status }, { status: 201 });
});
