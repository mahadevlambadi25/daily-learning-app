"use client";

import { useState } from "react";
import { CheckCircle2, HelpCircle, RotateCcw, XCircle } from "lucide-react";
import { api } from "@/lib/client-api";
import { Alert, Button, cn } from "./ui";

type Question = { id: string; question: string; options: Record<"a" | "b" | "c" | "d", string> };
type Result = { questionId: string; selected: string | null; correctOption: string; isCorrect: boolean; explanation: string };

/** 1-3 multiple-choice knowledge check; answers are scored on the server after submit. */
export function Quiz({ lessonId, questions, disabled }: { lessonId: string; questions: Question[]; disabled?: boolean }) {
  const [answers, setAnswers] = useState<Record<string, "a" | "b" | "c" | "d">>({});
  const [results, setResults] = useState<{ score: number; total: number; results: Result[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const complete = questions.every((q) => answers[q.id]);

  async function submit() {
    setLoading(true);
    setError(null);
    const res = await api<{ score: number; total: number; results: Result[] }>(`/api/lessons/${lessonId}/quiz`, { method: "POST", body: { answers } });
    setLoading(false);
    if (res.ok) setResults(res.data);
    else setError(res.message);
  }

  function retry() {
    setAnswers({});
    setResults(null);
  }

  const byId = new Map(results?.results.map((r) => [r.questionId, r]));

  return (
    <section aria-labelledby="quiz-heading" className="rounded-3xl border border-line bg-surface p-6 shadow-card sm:p-8">
      <div className="flex items-center justify-between gap-3">
        <h2 id="quiz-heading" className="flex items-center gap-2 font-display text-2xl font-semibold">
          <HelpCircle className="size-6 text-accent" aria-hidden /> Quick check
        </h2>
        {results && (
          <span className={cn("rounded-full px-3 py-1 text-sm font-bold", results.score === results.total ? "bg-success-soft text-success" : "bg-accent-soft text-accent")}>
            {results.score}/{results.total} correct
          </span>
        )}
      </div>

      <div className="mt-6 space-y-8">
        {questions.map((q, qi) => {
          const r = byId.get(q.id);
          return (
            <fieldset key={q.id} disabled={!!results || disabled}>
              <legend className="font-semibold">
                {qi + 1}. {q.question}
              </legend>
              <div className="mt-3 grid gap-2">
                {(Object.keys(q.options) as ("a" | "b" | "c" | "d")[]).map((key) => {
                  const chosen = answers[q.id] === key;
                  const isCorrect = r && r.correctOption === key;
                  const isWrongPick = r && chosen && !r.isCorrect;
                  return (
                    <label
                      key={key}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-2xl border-2 px-4 py-3 transition-all has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--focus)]",
                        !r && (chosen ? "border-accent bg-accent-soft" : "border-line hover:border-ink/30"),
                        isCorrect && "border-success bg-success-soft",
                        isWrongPick && "border-danger bg-danger-soft",
                        r && !isCorrect && !isWrongPick && "border-line opacity-60",
                        (results || disabled) && "cursor-default",
                      )}
                    >
                      <input
                        type="radio"
                        name={`q-${q.id}`}
                        value={key}
                        checked={chosen}
                        onChange={() => setAnswers((a) => ({ ...a, [q.id]: key }))}
                        className="sr-only"
                      />
                      <span
                        className={cn(
                          "grid size-7 shrink-0 place-items-center rounded-full border-2 text-xs font-bold uppercase",
                          chosen && !r ? "border-accent bg-accent text-accent-ink" : "border-line",
                        )}
                        aria-hidden
                      >
                        {key}
                      </span>
                      <span className="flex-1">{q.options[key]}</span>
                      {isCorrect && <CheckCircle2 className="size-5 text-success" aria-label="Correct answer" />}
                      {isWrongPick && <XCircle className="size-5 text-danger" aria-label="Your answer, incorrect" />}
                    </label>
                  );
                })}
              </div>
              {r && (
                <p className={cn("mt-3 rounded-2xl px-4 py-3 text-sm", r.isCorrect ? "bg-success-soft text-success" : "bg-surface-2")} role="status">
                  <strong>{r.isCorrect ? "Correct. " : "Not quite. "}</strong>
                  <span className="text-ink">{r.explanation}</span>
                </p>
              )}
            </fieldset>
          );
        })}
      </div>

      {error && <Alert tone="error" className="mt-6">{error}</Alert>}
      <div className="mt-6">
        {results ? (
          <Button variant="secondary" onClick={retry}>
            <RotateCcw className="size-4" aria-hidden /> Try again
          </Button>
        ) : (
          <Button onClick={submit} disabled={!complete || disabled} loading={loading}>
            Check answers
          </Button>
        )}
        {disabled && <p className="mt-2 text-sm text-muted">Quiz is disabled in preview.</p>}
      </div>
    </section>
  );
}
