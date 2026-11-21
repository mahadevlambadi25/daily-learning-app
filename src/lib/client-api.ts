/** Browser-side helper for the JSON API envelope. Never throws for HTTP errors. */
export type ApiResult<T> =
  | { ok: true; data: T; meta?: Record<string, unknown> }
  | { ok: false; status: number; message: string; fields?: Record<string, string> };

export async function api<T = unknown>(url: string, init: { method?: string; body?: unknown } = {}): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method: init.method ?? "GET",
      headers: init.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      credentials: "same-origin",
    });
    if (res.status === 204) return { ok: true, data: null as T };
    const json = await res.json().catch(() => null);
    if (res.ok && json) return { ok: true, data: json.data as T, meta: json.meta };
    return {
      ok: false,
      status: res.status,
      message: json?.error?.message ?? "Something went wrong. Please try again.",
      fields: json?.error?.fields,
    };
  } catch {
    return { ok: false, status: 0, message: "You appear to be offline. Check your connection and try again." };
  }
}

export function track(name: "lesson_listen_started", properties?: Record<string, string | number | boolean>) {
  void api("/api/events", { method: "POST", body: { name, properties } });
}
