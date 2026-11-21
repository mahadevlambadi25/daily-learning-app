import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/auth/session";
import { getLessonForLearner, setProgress } from "@/server/lessons";
import { track } from "@/server/analytics";
import { LessonView } from "@/components/lesson-view";

export const metadata: Metadata = { title: "Lesson" };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ mode?: string }> };

export default async function LessonPage({ params, searchParams }: Props) {
  const user = await requirePageUser();
  const [{ id }, { mode }] = await Promise.all([params, searchParams]);
  const lesson = await getLessonForLearner(id, user.id);
  if (!lesson) notFound();

  await Promise.all([setProgress(user.id, id, "started"), track("lesson_opened", user.id, { lessonId: id, topic: lesson.topic.slug })]);

  return <LessonView lesson={lesson} initialMode={mode === "listen" ? "listen" : "read"} />;
}
