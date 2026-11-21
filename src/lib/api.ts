import { NextResponse } from "next/server";
import { ZodError, type z, type ZodTypeAny } from "zod";
import { fieldErrors } from "./validation";

/** Consistent JSON envelope: { data, error, meta } (PRD §14). */
export type Envelope<T> = {
  data: T | null;
  error: { code: string; message: string; fields?: Record<string, string> } | null;
  meta?: Record<string, unknown>;
};

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export function ok<T>(data: T, init: { status?: number; meta?: Record<string, unknown> } = {}) {
  const body: Envelope<T> = { data, error: null, ...(init.meta ? { meta: init.meta } : {}) };
  return NextResponse.json(body, { status: init.status ?? 200 });
}

export function noContent() {
  return new NextResponse(null, { status: 204 });
}

export function fail(status: number, code: string, message: string, fields?: Record<string, string>) {
  const body: Envelope<null> = { data: null, error: { code, message, ...(fields ? { fields } : {}) } };
  return NextResponse.json(body, { status });
}

/** Parses and validates a JSON body, throwing a 400 ApiError with field messages on failure. */
export async function parseJson<S extends ZodTypeAny>(req: Request, schema: S): Promise<z.output<S>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError(400, "invalid_json", "Request body must be valid JSON.");
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const fields = fieldErrors(result.error);
    throw new ApiError(400, "validation_error", Object.values(fields)[0] ?? "Invalid input.", fields);
  }
  return result.data;
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/**
 * Wraps a route handler: maps ApiError/ZodError to proper status codes and hides
 * unexpected errors (never leaks raw database messages to clients).
 */
export function route<C = unknown>(handler: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof ApiError) return fail(err.status, err.code, err.message, err.fields);
      if (err instanceof ZodError) {
        const fields = fieldErrors(err);
        return fail(400, "validation_error", Object.values(fields)[0] ?? "Invalid input.", fields);
      }
      // Next.js uses thrown errors for redirect()/notFound(); let them propagate.
      if (err && typeof err === "object" && "digest" in err) throw err;
      console.error("[api] unexpected error", req.method, new URL(req.url).pathname, err);
      return fail(500, "internal_error", "Something went wrong. Please try again.");
    }
  };
}
