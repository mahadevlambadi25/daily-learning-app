import { ok, parseJson, route } from "@/lib/api";
import { signupSchema } from "@/lib/validation";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createSession } from "@/lib/auth/session";
import { createUser } from "@/server/users";
import { z } from "zod";

const body = signupSchema.extend({ timezone: z.string().max(64).optional() });

export const POST = route(async (req) => {
  enforceRateLimit(req, "signup", 5, 15 * 60_000);
  const input = await parseJson(req, body);
  const user = await createUser({
    email: input.email,
    password: input.password,
    displayName: input.displayName || undefined,
    timezone: input.timezone, // browser-detected; validated, falls back to Asia/Kolkata
  });
  await createSession(user.id);
  return ok({ id: user.id, email: user.email, next: "/onboarding/topics" }, { status: 201 });
});
