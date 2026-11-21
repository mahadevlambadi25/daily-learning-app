import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth/session";
import { getTopicCatalogue } from "@/server/topics";
import { getActiveTopicIds } from "@/server/users";
import { TopicPicker } from "@/components/topic-picker";
import { OnboardingSteps } from "@/components/onboarding-steps";

export const metadata: Metadata = { title: "Choose your topics" };

export default async function OnboardingTopicsPage() {
  const user = await requirePageUser({ onboarded: false });
  const [topics, selected] = await Promise.all([getTopicCatalogue(), getActiveTopicIds(user.id)]);
  return (
    <>
      <OnboardingSteps current={0} />
      <TopicPicker topics={topics} initialSelected={selected} mode="onboarding" />
    </>
  );
}
