"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut, Trash2 } from "lucide-react";
import { api } from "@/lib/client-api";
import { Alert, Button, Input, Label } from "./ui";

export function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  return (
    <Button
      variant="secondary"
      loading={loading}
      onClick={async () => {
        setLoading(true);
        await api("/api/auth/logout", { method: "POST" });
        router.push("/login");
        router.refresh();
      }}
    >
      <LogOut className="size-4" aria-hidden /> Sign out
    </Button>
  );
}

/** Self-service deletion with an explicit typed confirmation. */
export function DeleteAccount() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setLoading(true);
    setError(null);
    const res = await api("/api/me", { method: "DELETE", body: { confirm } });
    if (res.ok) {
      router.push("/?deleted=1");
      router.refresh();
      return;
    }
    setLoading(false);
    setError(res.message);
  }

  if (!open) {
    return (
      <Button variant="ghost" className="text-danger" onClick={() => setOpen(true)}>
        <Trash2 className="size-4" aria-hidden /> Delete my account
      </Button>
    );
  }

  return (
    <div className="rounded-3xl border border-danger/40 bg-danger-soft p-5">
      <p className="font-semibold text-danger">Delete your account permanently?</p>
      <p className="mt-1 text-sm">
        This removes your profile, topics, progress, bookmarks and email preferences. It can&apos;t be undone.
      </p>
      <div className="mt-4">
        <Label htmlFor="confirm-delete">Type DELETE to confirm</Label>
        <Input id="confirm-delete" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" className="max-w-xs" />
      </div>
      {error && <Alert tone="error" className="mt-3">{error}</Alert>}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="danger" onClick={remove} disabled={confirm !== "DELETE"} loading={loading}>
          Delete account
        </Button>
        <Button variant="secondary" onClick={() => { setOpen(false); setConfirm(""); }}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
