"use client";

import { useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center px-4 text-center">
      <h1 className="font-display text-3xl font-semibold">Something went wrong</h1>
      <p className="mt-2 max-w-sm text-muted">
        Sorry about that. Please try again{error.digest ? ` (reference ${error.digest})` : ""}.
      </p>
      <Button onClick={reset} className="mt-6">
        <RefreshCw className="size-4" aria-hidden /> Try again
      </Button>
    </div>
  );
}
