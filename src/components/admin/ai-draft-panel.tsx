"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { api } from "@/lib/client-api";
import { Alert, Button, Card, FieldError, Label, Select, Textarea } from "../ui";

/** "Generate draft" (PRD P1): topic + objective + source notes -> a Draft for human review. */
export function AiDraftPanel({ topics, configured }: { topics: { id: string; name: string }[]; configured: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState({ topicId: "", objective: "", sourceNotes: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrors({});
    setError(null);
    const res = await api<{ id: string }>("/api/admin/lessons/generate", { method: "POST", body: form });
    if (res.ok) {
      router.push(`/admin/lessons/${res.data.id}?created=ai`);
      return;
    }
    setLoading(false);
    setErrors(res.fields ?? {});
    setError(res.message);
  }

  return (
    <Card className="mb-6 overflow-hidden">
      <div className="border-b border-line bg-accent-soft/60 px-6 py-4">
        <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
          <Sparkles className="size-5 text-accent" aria-hidden /> Generate a draft with AI
        </h2>
        <p className="mt-1 text-sm text-muted">
          Gemini writes a first draft in the lesson format and lists the claims to check. It&apos;s saved as a Draft. An editor must
          verify facts and sources and confirm the rights basis before it can be submitted.
        </p>
      </div>
      {!configured ? (
        <p className="px-6 py-5 text-sm text-muted">
          AI drafting is off. Set <code className="rounded bg-surface-2 px-1.5 py-0.5">GEMINI_API_KEY</code> in the server environment to enable it.
        </p>
      ) : (
        <form onSubmit={generate} className="grid gap-4 p-6 md:grid-cols-2">
          <div>
            <Label htmlFor="ai-topic">Topic</Label>
            <Select id="ai-topic" value={form.topicId} onChange={(e) => setForm({ ...form, topicId: e.target.value })} required>
              <option value="">Choose a topic…</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
            <FieldError>{errors.topicId}</FieldError>
          </div>
          <div>
            <Label htmlFor="ai-objective">Learning objective</Label>
            <Textarea
              id="ai-objective"
              rows={2}
              maxLength={300}
              value={form.objective}
              onChange={(e) => setForm({ ...form, objective: e.target.value })}
              placeholder="e.g. Explain the 50/30/20 budgeting rule and when it doesn't fit"
              required
            />
            <FieldError>{errors.objective}</FieldError>
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="ai-notes">
              Source notes <span className="font-normal text-muted">(optional: facts, links or excerpts you trust)</span>
            </Label>
            <Textarea id="ai-notes" rows={4} maxLength={4000} value={form.sourceNotes} onChange={(e) => setForm({ ...form, sourceNotes: e.target.value })} />
            <FieldError>{errors.sourceNotes}</FieldError>
          </div>
          {error && !Object.keys(errors).length && <Alert tone="error" className="md:col-span-2">{error}</Alert>}
          <div className="md:col-span-2">
            <Button type="submit" loading={loading}>
              <Sparkles className="size-4" aria-hidden /> {loading ? "Writing draft…" : "Generate draft"}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
