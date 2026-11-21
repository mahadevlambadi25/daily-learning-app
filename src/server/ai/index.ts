import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { lessonInputSchema } from "@/lib/validation";
import { createLesson } from "../admin-lessons";
import { geminiProvider } from "./gemini";
import { AiProviderError, type AiDraft, type DraftProvider } from "./provider";

export { AiProviderError };

/** Configured provider, or null when AI drafting is off (no key). */
export function getDraftProvider(): DraftProvider | null {
  const provider = (process.env.AI_PROVIDER || "gemini").toLowerCase();
  if (provider === "gemini" && process.env.GEMINI_API_KEY) return geminiProvider(process.env.GEMINI_API_KEY);
  return null;
}

const clip = (s: string | null | undefined, max: number) => (s ?? "").trim().slice(0, max);

/** Maps a provider draft onto the CMS lesson input, enforcing field limits. */
export function draftToLessonInput(topicId: string, draft: AiDraft, providerName: string) {
  const claims = draft.claimsToVerify.map((c) => `- ${c.trim()}`).filter((c) => c.length > 2);
  return lessonInputSchema.parse({
    topicId,
    title: clip(draft.title, 90),
    hook: clip(draft.hook, 300),
    body: clip(draft.body, 5000),
    takeaways: draft.takeaways.slice(0, 3).map((t) => clip(t, 160)),
    actionText: clip(draft.actionText, 500),
    // Left unset on purpose: an editor must confirm the rights basis before it can be submitted.
    rightsBasis: null,
    requiresSources: true,
    editorNotes: clip(
      [`AI-generated draft (${providerName}). Verify every fact and source before submitting for review.`, claims.length ? `Claims to verify:\n${claims.join("\n")}` : ""]
        .filter(Boolean)
        .join("\n\n"),
      2000,
    ),
    sources: draft.sources.slice(0, 3).map((s) => ({
      sourceTitle: clip(s.title, 300),
      sourceUrl: s.url && /^https?:\/\/\S+$/i.test(s.url.trim()) ? clip(s.url, 500) : null,
      authorOrPublisher: clip(s.publisher, 200) || null,
      accessedAt: null,
      rightsBasis: null,
      reviewerNote: "AI-suggested: confirm this source exists and supports the claims.",
    })),
    questions: draft.questions.slice(0, 3).map((q) => ({
      question: clip(q.question, 300),
      optionA: clip(q.options[0], 200),
      optionB: clip(q.options[1], 200),
      optionC: clip(q.options[2], 200),
      optionD: clip(q.options[3], 200),
      correctOption: "abcd"[q.correctIndex] as "a" | "b" | "c" | "d",
      explanation: clip(q.explanation, 500),
    })),
  });
}

/** Generates a lesson draft with AI and saves it as a Draft. Never publishes. */
export async function createAiDraft(input: { topicId: string; objective: string; sourceNotes: string }, actorId: string, provider: DraftProvider) {
  const topic = await prisma.topic.findFirst({ where: { id: input.topicId, isActive: true } });
  if (!topic) throw new ApiError(400, "validation_error", "Choose an active topic.", { topicId: "Choose an active topic." });

  let draft: AiDraft;
  try {
    draft = await provider.generate({ topicName: topic.name, objective: input.objective, sourceNotes: input.sourceNotes });
  } catch (err) {
    if (err instanceof AiProviderError) throw new ApiError(502, "ai_failed", err.message);
    throw err;
  }

  const lesson = await createLesson(draftToLessonInput(topic.id, draft, provider.name), actorId);
  await prisma.auditLog.create({
    data: { actorId, action: "ai_draft", entityType: "lesson", entityId: lesson.id, details: JSON.stringify({ provider: provider.name, objective: input.objective }) },
  });
  return lesson;
}
