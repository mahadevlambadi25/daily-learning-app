import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Eye } from "lucide-react";
import { loadForPreview, toLearnerLesson } from "@/server/lessons";
import { StatusBadge } from "@/components/admin/status-badge";
import { LessonView } from "@/components/lesson-view";

export const metadata: Metadata = { title: "Preview" };
export const dynamic = "force-dynamic";

/** Learner view of any lesson status, for editors. Actions are disabled. */
export default async function PreviewLessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lesson = await loadForPreview(id);
  if (!lesson) notFound();
  return (
    <div>
      <div className="mx-auto mb-8 flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-2xl bg-ink px-5 py-3 text-sm text-bg">
        <span className="flex items-center gap-2 font-semibold">
          <Eye className="size-4" aria-hidden /> Learner preview <StatusBadge status={lesson.status} />
        </span>
        <Link href={`/admin/lessons/${id}`} className="font-semibold underline">
          Back to editor
        </Link>
      </div>
      <LessonView lesson={toLearnerLesson(lesson, { completed: false, bookmarked: false })} preview />
    </div>
  );
}
