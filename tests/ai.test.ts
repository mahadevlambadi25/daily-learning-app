import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { buildGeminiRequest, geminiProvider, parseGeminiResponse } from "@/server/ai/gemini";
import { AiProviderError, type AiDraft, type DraftProvider } from "@/server/ai/provider";
import { createAiDraft } from "@/server/ai";
import { applyLessonAction } from "@/server/admin-lessons";
import { makeTopic, makeUser, resetDb } from "./helpers";

const draft: AiDraft = {
  title: "T".repeat(120), // over the 90-char limit: must be clipped
  hook: "Why it matters.",
  body: Array(180).fill("word").join(" "),
  takeaways: ["One", "Two", "Three", "Four"],
  actionText: "Try it today.",
  sources: [
    { title: "WHO", url: "https://www.who.int", publisher: "World Health Organization" },
    { title: "Made-up", url: "not a url", publisher: null },
  ],
  claimsToVerify: ["Adults need 7-9 hours of sleep."],
  questions: [{ question: "Q?", options: ["a", "b", "c", "d"], correctIndex: 2, explanation: "Because." }],
};

const geminiBody = (obj: unknown, finishReason = "STOP") => ({
  candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] }, finishReason }],
});

describe("Gemini adapter", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("builds a JSON-schema request with the topic, objective and delimited notes", () => {
    const req = buildGeminiRequest({ topicName: "Sleep & Recovery", objective: "Explain sleep debt", sourceNotes: "Note A" });
    expect(req.generationConfig.responseMimeType).toBe("application/json");
    expect(req.systemInstruction.parts[0].text).toMatch(/own words/);
    const text = req.contents[0].parts[0].text;
    expect(text).toContain("Topic: Sleep & Recovery");
    expect(text).toContain('"""\nNote A\n"""');
  });

  it("parses a valid response and rejects blocked, truncated or malformed ones", () => {
    expect(parseGeminiResponse(geminiBody(draft)).title).toBe(draft.title);
    expect(() => parseGeminiResponse({ promptFeedback: { blockReason: "SAFETY" } })).toThrow(AiProviderError);
    expect(() => parseGeminiResponse(geminiBody(draft, "SAFETY"))).toThrow(/safety/);
    expect(() => parseGeminiResponse(geminiBody(draft, "MAX_TOKENS"))).toThrow(/cut off/);
    expect(() => parseGeminiResponse({ candidates: [{ content: { parts: [{ text: "{oops" }] } }] })).toThrow(/unreadable/);
    expect(() => parseGeminiResponse(geminiBody({ title: "only a title" }))).toThrow(/incomplete/);
  });

  it("calls the configured model with the API key header and maps HTTP errors", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(geminiBody(draft)), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const p = geminiProvider("test-key");
    await p.generate({ topicName: "T", objective: "Objective here", sourceNotes: "" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/models\/gemini-[^/]+:generateContent$/);
    expect(init.headers["x-goog-api-key"]).toBe("test-key");

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "quota" } }), { status: 429 }));
    await expect(p.generate({ topicName: "T", objective: "Objective here", sourceNotes: "" })).rejects.toThrow(/busy/);
  });
});

describe("AI draft creation", () => {
  beforeEach(resetDb);
  const fake = (result: AiDraft | Error): DraftProvider => ({
    name: "fake",
    generate: async () => {
      if (result instanceof Error) throw result;
      return result;
    },
  });

  it("saves a Draft that needs human review and cannot be submitted as-is", async () => {
    const t = await makeTopic();
    const admin = await makeUser({ admin: true });
    const lesson = await createAiDraft({ topicId: t.id, objective: "Explain sleep debt", sourceNotes: "" }, admin.id, fake(draft));

    const saved = await prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id }, include: { sources: true, questions: true } });
    expect(saved.status).toBe("draft");
    expect(saved.rightsBasis).toBeNull();
    expect(saved.title).toHaveLength(90);
    expect([saved.takeaway1, saved.takeaway2, saved.takeaway3]).toEqual(["One", "Two", "Three"]);
    expect(saved.editorNotes).toContain("Adults need 7-9 hours of sleep.");
    expect(saved.sources.map((s) => s.sourceUrl)).toEqual(["https://www.who.int", null]);
    expect(saved.questions[0].correctOption).toBe("c");
    expect(await prisma.auditLog.count({ where: { entityId: lesson.id, action: "ai_draft" } })).toBe(1);
    // Rights basis must be confirmed by a human before review.
    await expect(applyLessonAction(lesson.id, "submit", admin.id)).rejects.toBeInstanceOf(ApiError);
  });

  it("turns provider failures into a 502 and saves nothing", async () => {
    const t = await makeTopic();
    const admin = await makeUser({ admin: true });
    const p = createAiDraft({ topicId: t.id, objective: "Explain sleep debt", sourceNotes: "" }, admin.id, fake(new AiProviderError("busy")));
    await expect(p).rejects.toMatchObject({ status: 502 });
    expect(await prisma.lesson.count()).toBe(0);
  });

  it("rejects inactive topics", async () => {
    const t = await makeTopic({ isActive: false });
    const admin = await makeUser({ admin: true });
    await expect(createAiDraft({ topicId: t.id, objective: "Explain sleep debt", sourceNotes: "" }, admin.id, fake(draft))).rejects.toMatchObject({ status: 400 });
  });
});
