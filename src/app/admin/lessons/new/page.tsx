import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTopicCatalogue } from "@/server/topics";
import { LessonEditor, type EditorLesson } from "@/components/admin/lesson-editor";
import { AiDraftPanel } from "@/components/admin/ai-draft-panel";
import { getDraftProvider } from "@/server/ai";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "New lesson" };

export default async function NewLessonPage() {
  const topics = await getTopicCatalogue();
  const topicOptions = topics.map((t) => ({ id: t.id, name: t.name }));
  const blank: EditorLesson = {
    status: "draft",
    topicId: "",
    title: "",
    hook: "",
    body: "",
    takeaways: ["", "", ""],
    actionText: "",
    readTimeOverride: "",
    tags: "",
    editorNotes: "",
    rightsBasis: "original",
    requiresSources: true,
    isRepeatable: false,
    sources: [],
    questions: [],
    scheduledAt: null,
    publishedAt: null,
  };
  return (
    <div>
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Lessons
      </Link>
      <h1 className="mt-4 mb-6 font-display text-3xl font-semibold tracking-tight">New lesson</h1>
      <AiDraftPanel topics={topicOptions} configured={getDraftProvider() !== null} />
      <h2 className="mb-4 font-display text-xl font-semibold">Or write it yourself</h2>
      <LessonEditor initial={blank} topics={topicOptions} />
    </div>
  );
}
