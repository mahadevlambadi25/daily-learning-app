"use client";

import Link from "next/link";
import { useState } from "react";
import { MailX } from "lucide-react";
import { api } from "@/lib/client-api";
import { Alert, Button } from "./ui";

export function UnsubscribeConfirm({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function confirm() {
    setState("loading");
    const res = await api(`/api/unsubscribe?token=${encodeURIComponent(token)}`, { method: "POST" });
    if (res.ok) setState("done");
    else {
      setError(res.message);
      setState("error");
    }
  }

  return (
    <div className="w-full rounded-3xl border border-line bg-surface p-8 text-center shadow-card">
      <div className="mx-auto grid size-16 place-items-center rounded-3xl bg-accent-soft text-accent">
        <MailX className="size-8" aria-hidden />
      </div>
      {state === "done" ? (
        <>
          <h1 className="mt-6 font-display text-3xl font-semibold">You&apos;re unsubscribed</h1>
          <p className="mt-2 text-muted">You won&apos;t receive daily emails any more. Your lessons are still waiting in the app.</p>
          <Link href="/settings#preferences" className="mt-6 inline-block font-semibold text-accent hover:underline">
            Manage preferences
          </Link>
        </>
      ) : (
        <>
          <h1 className="mt-6 font-display text-3xl font-semibold">Stop daily emails?</h1>
          <p className="mt-2 text-muted">You can turn them back on anytime in Settings.</p>
          {!token && <Alert tone="error" className="mt-4 text-left">This link is missing its token. Use the link from your email.</Alert>}
          {state === "error" && <Alert tone="error" className="mt-4 text-left">{error}</Alert>}
          <Button onClick={confirm} loading={state === "loading"} disabled={!token} size="lg" className="mt-6 w-full">
            Unsubscribe
          </Button>
        </>
      )}
    </div>
  );
}
