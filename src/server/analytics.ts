import { prisma } from "@/lib/db";
import type { AnalyticsEventName } from "@/lib/validation";

type Props = Record<string, string | number | boolean | null | undefined>;

/**
 * First-party event log (PRD §16). Failures are swallowed: analytics must never break a user flow.
 * To forward to PostHog/Plausible later, add the call here.
 */
export async function track(name: AnalyticsEventName, userId: string | null, properties: Props = {}): Promise<void> {
  try {
    await prisma.analyticsEvent.create({
      data: { name, userId, properties: JSON.stringify(properties) },
    });
  } catch (err) {
    console.warn("[analytics] failed to record", name, err);
  }
}
