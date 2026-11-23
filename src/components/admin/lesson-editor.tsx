"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Eye, History, Plus, Save, Trash2 } from "lucide-react";
import { api } from "@/lib/client-api";
import { estimateReadTime, wordCount } from "@/lib/lesson-content";
import { ACTION_LABELS, allowedActions, publishIssues } from "@/lib/lesson-workflow";
import { RIGHTS_BASES, RIGHTS_LABELS, type LessonAction } from "@/lib/validation";
import { StatusBadge } from "./status-badge";
import { LocalTime } from "../local-time";
import { Alert, Button, Card, cn, FieldError, Input, Label, Select, Textarea } from "../ui";

type Source = { sourceTitle: string; sourceUrl: string; authorOrPublisher: string; accessedAt: string; rightsBasis: string; reviewerNote: string };
type Question = { question: string; optionA: string; optionB: string; optionC: string; optionD: string; correctOption: "a" | "b" | "c" | "d"; explanation: string };

export type EditorLesson = {
  id?: string;
  status: string;
  topicId: string;
  title: string;
  hook: string;
  body: string;
  takeaways: [string, string, string];
  actionText: string;
  readTimeOverride: string;
  tags: string;
  editorNotes: string;
  rightsBasis: string;
  requiresSources: boolean;
  isRepeatable: boolean;
  sources: Source[];
  questions: Question[];
  scheduledAt: string | null;
  publishedAt: string | null;
};

type Audit = { id: string; action: string; createdAt: string; details: string };

const AUDIT_LABELS: Record<string, string> = {
  create: "Created",
  update: "Edited",
  auto_publish: "Auto-published (schedule)",
  ai_draft: "AI draft generated",
};

const emptySource = (): Source => ({ sourceTitle: "", sourceUrl: "", authorOrPublisher: "", accessedAt: new Date().toISOString().slice(0, 10), rightsBasis: "", reviewerNote: "" });
const emptyQuestion = (): Question => ({ question: "", optionA: "", optionB: "", optionC: "", optionD: "", correctOption: "a", explanation: "" });

function Counter({ value, max }: { value: number; max: number }) {
  return <span className={cn("text-xs tabular-nums", value > max ? "font-bold text-danger" : "text-muted")}>{value}/{max}</span>;
}

/** Convert an ISO timestamp to the value format of <input type="datetime-local"> in local time. */
function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function LessonEditor({ initial, topics, audit = [] }: { initial: EditorLesson; topics: { id: string; name: string }[]; audit?: Audit[] }) {
  const router = useRouter();
  const [form, setForm] = useState<EditorLesson>(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [status, setStatus] = useState(initial.status);
  const [scheduleAt, setScheduleAt] = useState(toLocalInput(initial.scheduledAt));
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const dirty = JSON.stringify(form) !== saved;
  const words = wordCount(form.body);
  const autoReadTime = estimateReadTime(form.hook, form.body, ...form.takeaways, form.actionText);
  const issues = useMemo(
    () =>
      publishIssues({
        topicId: form.topicId,
        title: form.title,
        hook: form.hook,
        body: form.body,
        takeaway1: form.takeaways[0],
        takeaway2: form.takeaways[1],
        takeaway3: form.takeaways[2],
        actionText: form.actionText,
        rightsBasis: form.rightsBasis || null,
        requiresSources: form.requiresSources,
        sourcesCount: form.sources.filter((s) => s.sourceTitle.trim()).length,
      }),
    [form],
  );

  const set = <K extends keyof EditorLesson>(key: K, value: EditorLesson[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setSource = (i: number, patch: Partial<Source>) => set("sources", form.sources.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const setQuestion = (i: number, patch: Partial<Question>) => set("questions", form.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)));

  function payload() {
    return {
      topicId: form.topicId,
      title: form.title,
      hook: form.hook,
      body: form.body,
      takeaways: form.takeaways,
      actionText: form.actionText,
      readTimeMinutes: form.readTimeOverride ? Number(form.readTimeOverride) : null,
      tags: form.tags,
      editorNotes: form.editorNotes,
      rightsBasis: form.rightsBasis || null,
      requiresSources: form.requiresSources,
      isRepeatable: form.isRepeatable,
      sources: form.sources
        .filter((s) => s.sourceTitle.trim() || s.sourceUrl.trim())
        .map((s) => ({ ...s, rightsBasis: s.rightsBasis || null, accessedAt: s.accessedAt || null })),
      questions: form.questions,
    };
  }

  async function save() {
    setBusy("save");
    setErrors({});
    setMessage(null);
    const res = form.id
      ? await api(`/api/admin/lessons/${form.id}`, { method: "PATCH", body: payload() })
      : await api<{ id: string }>("/api/admin/lessons", { method: "POST", body: payload() });
    setBusy(null);
    if (!res.ok) {
      setErrors(res.fields ?? {});
      setMessage({ tone: "error", text: res.message });
      return;
    }
    if (!form.id) {
      router.replace(`/admin/lessons/${(res.data as { id: string }).id}?created=1`);
      return;
    }
    setSaved(JSON.stringify(form));
    setMessage({ tone: "success", text: "Changes saved." });
    router.refresh();
  }

  async function runAction(action: LessonAction) {
    if (!form.id) return;
    if ((action === "archive" || action === "unpublish") && !confirm(`${ACTION_LABELS[action]}? Learners will stop receiving this lesson.`)) return;
    setBusy(action);
    setMessage(null);
    const needsTime = action === "approve_schedule" || action === "reschedule";
    const res = await api<{ status: string }>(`/api/admin/lessons/${form.id}/status`, {
      method: "POST",
      body: { action, ...(needsTime && scheduleAt ? { scheduledAt: new Date(scheduleAt).toISOString() } : {}) },
    });
    setBusy(null);
    if (!res.ok) {
      setMessage({ tone: "error", text: res.message });
      return;
    }
    setStatus(res.data.status);
    setMessage({ tone: "success", text: `${ACTION_LABELS[action]}: done.` });
    router.refresh();
  }

  async function remove() {
    if (!form.id || !confirm("Delete this lesson permanently? This can't be undone.")) return;
    setBusy("delete");
    setMessage(null);
    const res = await api(`/api/admin/lessons/${form.id}`, { method: "DELETE" });
    setBusy(null);
    if (!res.ok) {
      setMessage({ tone: "error", text: res.message });
      return;
    }
    router.push("/admin");
  }

  const actions = form.id ? allowedActions(status) : [];
  const deletable = !!form.id && (status === "draft" || status === "archived");
  const editable = status !== "archived";
  const err = (k: string) => errors[k];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      {/* ---------------- Form ---------------- */}
      <div className="space-y-6">
        <fieldset disabled={!editable} className="min-w-0 space-y-6">
          <Card className="space-y-5 p-6">
            <h2 className="font-display text-xl font-semibold">Content</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="topic">Primary topic</Label>
                <Select id="topic" value={form.topicId} onChange={(e) => set("topicId", e.target.value)} aria-invalid={!!err("topicId") || undefined}>
                  <option value="">Choose a topic…</option>
                  {topics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
                <FieldError>{err("topicId")}</FieldError>
              </div>
              <div>
                <Label htmlFor="tags">
                  Tags <span className="font-normal text-muted">(optional, comma-separated)</span>
                </Label>
                <Input id="tags" value={form.tags} onChange={(e) => set("tags", e.target.value)} maxLength={200} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="title">Title</Label>
                <Counter value={form.title.length} max={90} />
              </div>
              <Input id="title" value={form.title} onChange={(e) => set("title", e.target.value)} aria-invalid={!!err("title") || undefined} />
              <FieldError>{err("title")}</FieldError>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="hook">Hook</Label>
                <Counter value={form.hook.length} max={300} />
              </div>
              <Textarea id="hook" rows={2} value={form.hook} onChange={(e) => set("hook", e.target.value)} placeholder="1-2 sentences on why this lesson matters." />
              <FieldError>{err("hook")}</FieldError>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="body">Body</Label>
                <span className={cn("text-xs tabular-nums", words && (words < 150 || words > 250) ? "font-bold text-accent" : "text-muted")}>
                  {words} words · target 150-250
                </span>
              </div>
              <Textarea id="body" rows={14} value={form.body} onChange={(e) => set("body", e.target.value)} className="font-[inherit]" />
              <p className="mt-1.5 text-xs text-muted">Plain text. Separate paragraphs with a blank line; start lines with “- ” for a bullet list.</p>
              <FieldError>{err("body")}</FieldError>
            </div>
          </Card>

          <Card className="space-y-5 p-6">
            <h2 className="font-display text-xl font-semibold">Takeaways &amp; action</h2>
            {form.takeaways.map((t, i) => (
              <div key={i}>
                <div className="flex items-center justify-between">
                  <Label htmlFor={`t${i}`}>Key takeaway {i + 1}</Label>
                  <Counter value={t.length} max={160} />
                </div>
                <Input
                  id={`t${i}`}
                  value={t}
                  onChange={(e) => {
                    const next = [...form.takeaways] as [string, string, string];
                    next[i] = e.target.value;
                    set("takeaways", next);
                  }}
                />
                <FieldError>{err(`takeaways.${i}`)}</FieldError>
              </div>
            ))}
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="action">Practical action</Label>
                <Counter value={form.actionText.length} max={500} />
              </div>
              <Textarea id="action" rows={3} value={form.actionText} onChange={(e) => set("actionText", e.target.value)} placeholder="One safe, specific thing to try today." />
              <FieldError>{err("actionText")}</FieldError>
            </div>
            <div className="max-w-xs">
              <Label htmlFor="readTime">Read time (minutes)</Label>
              <Input
                id="readTime"
                type="number"
                min={1}
                max={30}
                value={form.readTimeOverride}
                placeholder={`Auto: ${autoReadTime}`}
                onChange={(e) => set("readTimeOverride", e.target.value)}
              />
              <p className="mt-1.5 text-xs text-muted">Leave blank to calculate at 200 words/minute.</p>
            </div>
          </Card>

          <Card className="space-y-5 p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-xl font-semibold">Sources &amp; rights</h2>
              <Button type="button" variant="secondary" size="sm" onClick={() => set("sources", [...form.sources, emptySource()])} disabled={form.sources.length >= 10}>
                <Plus className="size-4" aria-hidden /> Add source
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="rights">Rights basis</Label>
                <Select id="rights" value={form.rightsBasis} onChange={(e) => set("rightsBasis", e.target.value)}>
                  <option value="">Not yet confirmed</option>
                  {RIGHTS_BASES.map((r) => (
                    <option key={r} value={r}>
                      {RIGHTS_LABELS[r]}
                    </option>
                  ))}
                </Select>
              </div>
              <label className="flex items-center gap-3 self-end rounded-2xl border border-line px-4 py-3 text-sm">
                <input type="checkbox" checked={form.requiresSources} onChange={(e) => set("requiresSources", e.target.checked)} className="size-4 accent-[var(--accent)]" />
                Factual content: sources required
              </label>
            </div>
            {form.sources.length === 0 && <p className="text-sm text-muted">No sources yet.</p>}
            {form.sources.map((s, i) => (
              <div key={i} className="space-y-3 rounded-2xl border border-line bg-surface-2/40 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Source {i + 1}</p>
                  <button type="button" onClick={() => set("sources", form.sources.filter((_, j) => j !== i))} className="grid size-8 place-items-center rounded-full text-muted hover:bg-danger-soft hover:text-danger" aria-label={`Remove source ${i + 1}`}>
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input aria-label="Source title" placeholder="Title" value={s.sourceTitle} onChange={(e) => setSource(i, { sourceTitle: e.target.value })} />
                  <Input aria-label="Source URL" placeholder="https://…" type="url" value={s.sourceUrl} onChange={(e) => setSource(i, { sourceUrl: e.target.value })} />
                  <Input aria-label="Author or publisher" placeholder="Author / publisher" value={s.authorOrPublisher} onChange={(e) => setSource(i, { authorOrPublisher: e.target.value })} />
                  <Input aria-label="Accessed date" type="date" value={s.accessedAt} onChange={(e) => setSource(i, { accessedAt: e.target.value })} />
                  <Select aria-label="Source rights basis" value={s.rightsBasis} onChange={(e) => setSource(i, { rightsBasis: e.target.value })}>
                    <option value="">Rights basis (optional)</option>
                    {RIGHTS_BASES.map((r) => (
                      <option key={r} value={r}>
                        {RIGHTS_LABELS[r]}
                      </option>
                    ))}
                  </Select>
                  <Input aria-label="Reviewer note" placeholder="Reviewer note" value={s.reviewerNote} onChange={(e) => setSource(i, { reviewerNote: e.target.value })} />
                </div>
                <FieldError>{err(`sources.${i}.sourceTitle`) || err(`sources.${i}.sourceUrl`)}</FieldError>
              </div>
            ))}
          </Card>

          <Card className="space-y-5 p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-semibold">Knowledge check</h2>
                <p className="text-sm text-muted">Optional: 1-3 multiple-choice questions, one correct answer each.</p>
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={() => set("questions", [...form.questions, emptyQuestion()])} disabled={form.questions.length >= 3}>
                <Plus className="size-4" aria-hidden /> Add question
              </Button>
            </div>
            {form.questions.map((q, i) => (
              <div key={i} className="space-y-3 rounded-2xl border border-line bg-surface-2/40 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Question {i + 1}</p>
                  <button type="button" onClick={() => set("questions", form.questions.filter((_, j) => j !== i))} className="grid size-8 place-items-center rounded-full text-muted hover:bg-danger-soft hover:text-danger" aria-label={`Remove question ${i + 1}`}>
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <Input aria-label="Question" placeholder="Question" value={q.question} onChange={(e) => setQuestion(i, { question: e.target.value })} />
                <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Options; select the correct answer">
                  {(["a", "b", "c", "d"] as const).map((k) => {
                    const field = `option${k.toUpperCase()}` as "optionA" | "optionB" | "optionC" | "optionD";
                    return (
                      <div key={k} className={cn("flex items-center gap-2 rounded-2xl border-2 p-1 pl-3", q.correctOption === k ? "border-success" : "border-transparent")}>
                        <input type="radio" name={`correct-${i}`} checked={q.correctOption === k} onChange={() => setQuestion(i, { correctOption: k })} aria-label={`Option ${k.toUpperCase()} is correct`} className="size-4 accent-[var(--success)]" />
                        <Input aria-label={`Option ${k.toUpperCase()}`} placeholder={`Option ${k.toUpperCase()}`} value={q[field]} onChange={(e) => setQuestion(i, { [field]: e.target.value } as Partial<Question>)} className="h-10" />
                      </div>
                    );
                  })}
                </div>
                <Input aria-label="Explanation" placeholder="Explanation shown after submitting" value={q.explanation} onChange={(e) => setQuestion(i, { explanation: e.target.value })} />
                <FieldError>{Object.entries(errors).find(([k]) => k.startsWith(`questions.${i}.`))?.[1]}</FieldError>
              </div>
            ))}
          </Card>

          <Card className="space-y-5 p-6">
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="editorNotes">
                  Editor notes <span className="font-normal text-muted">(internal, never shown to learners)</span>
                </Label>
                <Counter value={form.editorNotes.length} max={2000} />
              </div>
              <Textarea id="editorNotes" rows={form.editorNotes ? 6 : 3} value={form.editorNotes} onChange={(e) => set("editorNotes", e.target.value)} placeholder="Review notes, claims to check, open questions…" />
              <FieldError>{err("editorNotes")}</FieldError>
            </div>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" checked={form.isRepeatable} onChange={(e) => set("isRepeatable", e.target.checked)} className="mt-0.5 size-4 accent-[var(--accent)]" />
              <span>
                <span className="font-semibold">Evergreen / repeatable</span>
                <span className="block text-muted">May be re-assigned to a learner after a 60-day cooldown when a topic runs out of fresh lessons.</span>
              </span>
            </label>
          </Card>
        </fieldset>
      </div>

      {/* ---------------- Sidebar ---------------- */}
      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <Card className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-muted">Status</span>
            <StatusBadge status={status} />
          </div>
          {message && <Alert tone={message.tone === "success" ? "success" : "error"}>{message.text}</Alert>}
          <div className="flex flex-wrap gap-2">
            {editable && (
              <Button onClick={save} loading={busy === "save"} disabled={!dirty && !!form.id} className="flex-1">
                <Save className="size-4" aria-hidden /> {form.id ? "Save changes" : "Create draft"}
              </Button>
            )}
            {form.id && (
              <Link href={`/admin/lessons/${form.id}/preview`} target="_blank" className="inline-flex h-11 items-center gap-2 rounded-full border border-line px-4 text-[15px] font-semibold hover:bg-surface-2">
                <Eye className="size-4" aria-hidden /> Preview
              </Link>
            )}
          </div>
          {dirty && form.id && <p className="text-xs font-semibold text-accent">Unsaved changes. Save before changing status.</p>}
        </Card>

        <Card className="space-y-3 p-5">
          <h2 className="font-semibold">Publish checklist</h2>
          {issues.errors.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-success">
              <CheckCircle2 className="size-4" aria-hidden /> Ready for review and publishing.
            </p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {issues.errors.map((e) => (
                <li key={e} className="flex gap-2 text-danger">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {e}
                </li>
              ))}
            </ul>
          )}
          {issues.warnings.map((w) => (
            <p key={w} className="text-sm text-accent">
              {w}
            </p>
          ))}
        </Card>

        {actions.length > 0 && (
          <Card className="space-y-3 p-5">
            <h2 className="font-semibold">Editorial workflow</h2>
            {(actions.includes("approve_schedule") || actions.includes("reschedule")) && (
              <div>
                <Label htmlFor="scheduleAt" className="text-xs">
                  Publish at (your local time)
                </Label>
                <Input id="scheduleAt" type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} className="h-10" />
              </div>
            )}
            <div className="grid gap-2">
              {actions.map((a) => {
                const destructive = a === "archive" || a === "unpublish";
                const primary = a === "approve_publish" || a === "submit";
                const needsTime = (a === "approve_schedule" || a === "reschedule") && !scheduleAt;
                return (
                  <Button
                    key={a}
                    variant={primary ? "primary" : destructive ? "ghost" : "secondary"}
                    className={destructive ? "text-danger" : undefined}
                    onClick={() => runAction(a)}
                    loading={busy === a}
                    disabled={dirty || !!busy || needsTime}
                  >
                    {ACTION_LABELS[a]}
                  </Button>
                );
              })}
            </div>
            <p className="text-xs text-muted">AI may assist drafting, but every lesson needs human editorial and factual review before publishing.</p>
            {deletable && (
              <Button variant="ghost" className="w-full text-danger" onClick={remove} loading={busy === "delete"} disabled={!!busy}>
                <Trash2 className="size-4" aria-hidden /> Delete permanently
              </Button>
            )}
          </Card>
        )}

        {audit.length > 0 && (
          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-semibold">
              <History className="size-4" aria-hidden /> Approval record
            </h2>
            <ol className="mt-3 space-y-2 text-sm">
              {audit.map((a) => (
                <li key={a.id} className="flex justify-between gap-3">
                  <span className="font-medium">{AUDIT_LABELS[a.action] ?? ACTION_LABELS[a.action as LessonAction] ?? a.action.replace(/_/g, " ")}</span>
                  <LocalTime iso={a.createdAt} className="shrink-0 text-muted" />
                </li>
              ))}
            </ol>
          </Card>
        )}
      </aside>
    </div>
  );
}
