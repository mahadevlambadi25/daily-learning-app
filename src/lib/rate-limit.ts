import { ApiError } from "./api";

/**
 * Fixed-window in-memory rate limiter. Adequate for a single-instance MVP;
 * swap for a shared store (e.g. Redis/Upstash) when running multiple instances.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 10_000) pruneExpired(now);
    return { allowed: true, retryAfter: 0 };
  }
  bucket.count++;
  if (bucket.count > limit) return { allowed: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  return { allowed: true, retryAfter: 0 };
}

function pruneExpired(now: number) {
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] || req.headers.get("x-real-ip") || "local").trim();
}

/** Throws a 429 ApiError when the caller exceeds `limit` requests per `windowMs`. */
export function enforceRateLimit(req: Request, scope: string, limit: number, windowMs = 60_000, id?: string) {
  const { allowed, retryAfter } = rateLimit(`${scope}:${id ?? clientIp(req)}`, limit, windowMs);
  if (!allowed) throw new ApiError(429, "rate_limited", `Too many requests. Try again in ${retryAfter}s.`);
}

export function resetRateLimits() {
  buckets.clear();
}
