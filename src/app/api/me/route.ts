import { noContent, ok, parseJson, route } from "@/lib/api";
import { profileUpdateSchema } from "@/lib/validation";
import { destroySession, requireApiUser } from "@/lib/auth/session";
import { enforceRateLimit } from "@/lib/rate-limit";
import { localDate } from "@/lib/time";
import { deleteAccount, updateProfile } from "@/server/users";
import { assignDailyLessons } from "@/server/feed";
import { z } from "zod";

export const GET = route(async () => {
  const user = await requireApiUser();
  return ok({ id: user.id, email: user.email, isAdmin: user.isAdmin, ...user.profile });
});

export const PATCH = route(async (req) => {
  const user = await requireApiUser();
  enforceRateLimit(req, "me-patch", 30, 60_000, user.id);
  const patch = await parseJson(req, profileUpdateSchema);
  const profile = await updateProfile(user.id, patch);
  // First-time signup: assign a starter feed immediately rather than waiting for the job (PRD §9).
  if (patch.completeOnboarding) await assignDailyLessons(user.id, localDate(profile.timezone));
  return ok({
    displayName: profile.displayName,
    timezone: profile.timezone,
    preferredDeliveryTime: profile.preferredDeliveryTime,
    emailDailyEnabled: profile.emailDailyEnabled,
    reminderEnabled: profile.reminderEnabled,
    onboardedAt: profile.onboardedAt,
  });
});

/** Account deletion. Requires typing DELETE to confirm. */
export const DELETE = route(async (req) => {
  const user = await requireApiUser();
  await parseJson(req, z.object({ confirm: z.literal("DELETE", { errorMap: () => ({ message: "Type DELETE to confirm." }) }) }));
  await destroySession();
  await deleteAccount(user.id);
  return noContent();
});
