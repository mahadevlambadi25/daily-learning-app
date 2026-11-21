import { AiProviderError, aiDraftSchema, DRAFT_INSTRUCTIONS, type AiDraft, type DraftProvider, type DraftRequest } from "./provider";

/**
 * Google Gemini via the REST `generateContent` endpoint with a JSON response schema.
 * Model is configurable (GEMINI_MODEL) because Google rotates model names.
 */
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    hook: { type: "STRING" },
    body: { type: "STRING" },
    takeaways: { type: "ARRAY", items: { type: "STRING" } },
    actionText: { type: "STRING" },
    sources: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { title: { type: "STRING" }, url: { type: "STRING" }, publisher: { type: "STRING" } },
        required: ["title"],
      },
    },
    claimsToVerify: { type: "ARRAY", items: { type: "STRING" } },
    questions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          question: { type: "STRING" },
          options: { type: "ARRAY", items: { type: "STRING" } },
          correctIndex: { type: "INTEGER" },
          explanation: { type: "STRING" },
        },
        required: ["question", "options", "correctIndex", "explanation"],
      },
    },
  },
  required: ["title", "hook", "body", "takeaways", "actionText", "sources", "claimsToVerify", "questions"],
};

export function buildGeminiRequest(req: DraftRequest) {
  const user = [
    `Topic: ${req.topicName}`,
    `Learning objective: ${req.objective}`,
    req.sourceNotes.trim() ? `Editor's source notes (reference material only):\n"""\n${req.sourceNotes.trim()}\n"""` : "No source notes were provided.",
  ].join("\n\n");
  return {
    systemInstruction: { parts: [{ text: DRAFT_INSTRUCTIONS }] },
    contents: [{ role: "user", parts: [{ text: user }] }],
    generationConfig: { responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA, temperature: 0.7, maxOutputTokens: 8192 },
  };
}

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  error?: { message?: string };
};

/** Extracts and validates the draft from a Gemini response body. */
export function parseGeminiResponse(json: GeminiResponse): AiDraft {
  if (json.promptFeedback?.blockReason) throw new AiProviderError(`The request was blocked (${json.promptFeedback.blockReason}). Try rewording the objective.`);
  const candidate = json.candidates?.[0];
  if (!candidate) throw new AiProviderError("The AI returned no draft. Please try again.");
  if (candidate.finishReason === "SAFETY") throw new AiProviderError("The AI declined this request for safety reasons. Try rewording the objective.");
  if (candidate.finishReason === "MAX_TOKENS") throw new AiProviderError("The draft was cut off. Try a narrower objective.");
  const text = (candidate.content?.parts ?? []).map((p) => p.text ?? "").join("");
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new AiProviderError("The AI returned an unreadable draft. Please try again.");
  }
  const parsed = aiDraftSchema.safeParse(data);
  if (!parsed.success) throw new AiProviderError("The AI draft was incomplete. Please try again.");
  return parsed.data;
}

export function geminiProvider(apiKey: string): DraftProvider {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  return {
    name: `gemini:${model}`,
    async generate(req) {
      let res: Response;
      try {
        res = await fetch(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify(buildGeminiRequest(req)),
          signal: AbortSignal.timeout(90_000),
        });
      } catch (err) {
        console.error("[ai] gemini request failed", err);
        throw new AiProviderError("Couldn't reach the AI service. Please try again.");
      }
      const json = (await res.json().catch(() => ({}))) as GeminiResponse;
      if (!res.ok) {
        // Log details server-side; never forward provider error text (may include request data) to the client.
        console.error("[ai] gemini error", res.status, json.error?.message);
        if (res.status === 429) throw new AiProviderError("The AI service is busy (rate limit). Try again in a minute.");
        if (res.status === 400 || res.status === 404) throw new AiProviderError("The AI service rejected the request. Check GEMINI_MODEL and the API key.");
        throw new AiProviderError("The AI service returned an error. Please try again.");
      }
      return parseGeminiResponse(json);
    },
  };
}
