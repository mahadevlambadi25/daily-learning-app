import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getAuditTrail, getLessonForEdit } from "@/server/admin-lessons";
import { getTopicCatalogue } from "@/server/topics";
import { LessonEditor, type EditorLesson } from "@/components/admin/lesson-editor";
import { Alert } from "@/components/ui";

export const metadata: Metadata = { title: "Edit lesson" };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> };

export default async function EditLessonPage({ params, searchParams }: Props) {
  const [{ id }, { created }] = await Promise.all([params, searchParams]);
  const [lesson, topics, audit] = await Promise.all([getLessonForEdit(id), getTopicCatalogue(), getAuditTrail(id)]);
  if (!lesson) notFound();

  const initial: EditorLesson = {
    id: lesson.id,
    status: lesson.status,
    topicId: lesson.topicId,
    title: lesson.title,
    hook: lesson.hook,
    body: lesson.body,
    takeaways: [lesson.takeaway1, lesson.takeaway2, lesson.takeaway3],
    actionText: lesson.actionText,
    readTimeOverride: lesson.readTimeOverride ? String(lesson.readTimeMinutes) : "",
    tags: lesson.tags,
    editorNotes: lesson.editorNotes,
    rightsBasis: lesson.rightsBasis ?? "",
    requiresSources: lesson.requiresSources,
    isRepeatable: lesson.isRepeatable,
    sources: lesson.sources.map((s) => ({
      sourceTitle: s.sourceTitle,
      sourceUrl: s.sourceUrl ?? "",
      authorOrPublisher: s.authorOrPublisher ?? "",
      accessedAt: s.accessedAt ? s.accessedAt.toISOString().slice(0, 10) : "",
      rightsBasis: s.rightsBasis ?? "",
      reviewerNote: s.reviewerNote ?? "",
    })),
    questions: lesson.questions.map((q) => ({
      question: q.question,
      optionA: q.optionA,
      optionB: q.optionB,
      optionC: q.optionC,
      optionD: q.optionD,
      correctOption: q.correctOption as "a" | "b" | "c" | "d",
      explanation: q.explanation,
    })),
    scheduledAt: lesson.scheduledAt?.toISOString() ?? null,
    publishedAt: lesson.publishedAt?.toISOString() ?? null,
  };

  return (
    <div>
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Lessons
      </Link>
      <h1 className="mt-4 mb-6 font-display text-3xl font-semibold tracking-tight text-balance">{lesson.title}</h1>
      {created === "ai" ? (
        <Alert className="mb-6">
          AI draft created. Check every claim listed in Editor notes against a credible source, confirm or replace the suggested
          sources, choose a rights basis, then submit it for review.
        </Alert>
      ) : (
        created && <Alert tone="success" className="mb-6">Draft created. Complete the checklist, then submit it for review.</Alert>
      )}
      <LessonEditor
        initial={initial}
        topics={topics.map((t) => ({ id: t.id, name: t.name }))}
        audit={audit.map((a) => ({ id: a.id, action: a.action, createdAt: a.createdAt.toISOString(), details: a.details }))}
      />
    </div>
  );
}
