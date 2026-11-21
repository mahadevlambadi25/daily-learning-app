"use client";

import { useEffect, useState } from "react";
import { BellOff, BellRing, Info } from "lucide-react";
import { api } from "@/lib/client-api";
import { Button } from "./ui";

type State = "loading" | "unsupported" | "unconfigured" | "denied" | "off" | "on";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/** Per-device opt-in for push reminders (permission + subscription live in the browser). */
export function ReminderDevice() {
  const [state, setState] = useState<State>("loading");
  const [key, setKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setState("unsupported");
        return;
      }
      const res = await api<{ configured: boolean; publicKey: string | null }>("/api/push");
      if (!res.ok || !res.data.configured || !res.data.publicKey) {
        setState("unconfigured");
        return;
      }
      setKey(res.data.publicKey);
      if (Notification.permission === "denied") {
        setState("denied");
        return;
      }
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  async function enable() {
    if (!key) return;
    setBusy(true);
    setNote(null);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) }));
      const res = await api("/api/push/subscription", { method: "POST", body: sub.toJSON() });
      if (!res.ok) {
        setNote(res.message);
        return;
      }
      setState("on");
    } catch {
      setNote(isIos() ? "On iPhone and iPad, first add this app to your Home Screen (Share → Add to Home Screen), then turn reminders on from there." : "Couldn't turn on notifications in this browser.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setNote(null);
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await api("/api/push/subscription", { method: "DELETE", body: { endpoint: sub.endpoint } });
      await sub.unsubscribe().catch(() => undefined);
    }
    setBusy(false);
    setState("off");
  }

  async function test() {
    setBusy(true);
    const res = await api("/api/push/test", { method: "POST" });
    setBusy(false);
    setNote(res.ok ? "Test sent. It should appear in a few seconds." : res.message);
  }

  if (state === "loading") return null;

  return (
    <div className="mt-3 rounded-2xl bg-surface-2/60 p-4 text-sm" aria-live="polite">
      {state === "on" && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 font-semibold text-success">
            <BellRing className="size-4" aria-hidden /> This device gets your reminder.
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={test} loading={busy}>
              Send a test
            </Button>
            <Button size="sm" variant="ghost" onClick={disable} disabled={busy}>
              Turn off here
            </Button>
          </div>
        </div>
      )}
      {state === "off" && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-muted">Allow notifications on this device to get your reminder.</p>
          <Button size="sm" onClick={enable} loading={busy}>
            <BellRing className="size-4" aria-hidden /> Turn on notifications
          </Button>
        </div>
      )}
      {state === "denied" && (
        <p className="flex items-start gap-2 text-muted">
          <BellOff className="mt-0.5 size-4 shrink-0" aria-hidden /> Notifications are blocked for this site. Allow them in your browser&apos;s site settings, then reload.
        </p>
      )}
      {state === "unsupported" && (
        <p className="flex items-start gap-2 text-muted">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden /> This browser can&apos;t show reminders. Daily email still works, and your lessons are always waiting in the app.
        </p>
      )}
      {state === "unconfigured" && (
        <p className="flex items-start gap-2 text-muted">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden /> Reminder notifications aren&apos;t set up on this server yet.
        </p>
      )}
      {note && <p className="mt-2 text-muted">{note}</p>}
    </div>
  );
}
