"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Mail } from "lucide-react";
import { api } from "@/lib/client-api";
import { DELIVERY_TIMES, DEFAULT_TIMEZONE } from "@/lib/config";
import { Alert, Button, cn, Input, Label, Select, Switch } from "./ui";
import { ReminderDevice } from "./reminder-device";

type Prefs = {
  displayName: string | null;
  timezone: string;
  preferredDeliveryTime: string;
  emailDailyEnabled: boolean;
  reminderEnabled: boolean;
};

const TIME_LABELS: Record<string, string> = { "07:00": "7:00 AM", "08:00": "8:00 AM", "12:00": "12:00 PM", "18:00": "6:00 PM" };

function timezoneList(current: string): string[] {
  let zones: string[] = [];
  try {
    zones = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? [];
  } catch {
    zones = [];
  }
  return [...new Set([current, DEFAULT_TIMEZONE, ...zones])].sort();
}

export function PreferencesForm({ initial, mode }: { initial: Prefs; mode: "onboarding" | "settings" }) {
  const router = useRouter();
  const [prefs, setPrefs] = useState<Prefs>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const zones = useMemo(() => timezoneList(prefs.timezone), [prefs.timezone]);

  // Onboarding: prefill the timezone from the browser (fallback Asia/Kolkata).
  useEffect(() => {
    if (mode !== "onboarding") return;
    const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (browserTz && browserTz !== initial.timezone) setPrefs((p) => ({ ...p, timezone: browserTz }));
  }, [mode, initial.timezone]);

  function update<K extends keyof Prefs>(key: K, value: Prefs[K]) {
    setSaved(false);
    setPrefs((p) => ({ ...p, [key]: value }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const body = {
      timezone: prefs.timezone,
      preferredDeliveryTime: prefs.preferredDeliveryTime,
      emailDailyEnabled: prefs.emailDailyEnabled,
      reminderEnabled: prefs.reminderEnabled,
      ...(mode === "settings" ? { displayName: prefs.displayName?.trim() || null } : { completeOnboarding: true }),
    };
    const res = await api("/api/me", { method: "PATCH", body });
    if (!res.ok) {
      setSaving(false);
      setError(res.message);
      return;
    }
    if (mode === "onboarding") {
      router.replace("/today?welcome=1");
    } else {
      setSaving(false);
      setSaved(true);
      router.refresh();
    }
  }

  return (
    <form onSubmit={save} className="space-y-6">
      {mode === "settings" && (
        <div>
          <Label htmlFor="displayName">
            Name <span className="font-normal text-muted">(optional)</span>
          </Label>
          <Input id="displayName" value={prefs.displayName ?? ""} maxLength={60} onChange={(e) => update("displayName", e.target.value)} autoComplete="given-name" />
        </div>
      )}

      <div>
        <Switch
          id="reminder"
          label="Daily learning reminder"
          description="We'll send a notification when today's lessons are ready."
          checked={prefs.reminderEnabled}
          onChange={(v) => update("reminderEnabled", v)}
        />
        {prefs.reminderEnabled && <ReminderDevice />}
      </div>

      <fieldset>
        <legend className="mb-2 font-semibold">Preferred delivery time</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup">
          {DELIVERY_TIMES.map((t) => (
            <label
              key={t}
              className={cn(
                "flex cursor-pointer items-center justify-center rounded-2xl border-2 px-3 py-3 font-semibold transition-all has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--focus)]",
                prefs.preferredDeliveryTime === t ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface hover:border-ink/30",
              )}
            >
              <input type="radio" name="deliveryTime" value={t} checked={prefs.preferredDeliveryTime === t} onChange={() => update("preferredDeliveryTime", t)} className="sr-only" />
              {TIME_LABELS[t]}
            </label>
          ))}
        </div>
        <p className="mt-2 text-sm text-muted">Your lessons are in the app all day. This is just when we send the reminder and email.</p>
      </fieldset>

      <div className="rounded-3xl border border-line bg-surface-2/60 p-5">
        <Switch
          id="email"
          label="Send me a daily email"
          description={
            <>
              A short email with today&apos;s lesson titles. Every email has a one-click unsubscribe link.
            </>
          }
          checked={prefs.emailDailyEnabled}
          onChange={(v) => update("emailDailyEnabled", v)}
        />
        {mode === "onboarding" && (
          <p className="mt-3 flex items-center gap-2 text-xs text-muted">
            <Mail className="size-3.5" aria-hidden /> Off by default. We only email you if you switch this on.
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="timezone">Timezone</Label>
        <Select id="timezone" value={prefs.timezone} onChange={(e) => update("timezone", e.target.value)}>
          {zones.map((z) => (
            <option key={z} value={z}>
              {z.replace(/_/g, " ")}
            </option>
          ))}
        </Select>
        <p className="mt-1.5 text-sm text-muted">Your new lessons start at midnight in this timezone.</p>
      </div>

      {error && <Alert tone="error">{error}</Alert>}
      {saved && <Alert tone="success">Preferences saved.</Alert>}

      <Button type="submit" size="lg" loading={saving} className={mode === "onboarding" ? "w-full sm:w-auto" : undefined}>
        {mode === "onboarding" ? (
          <>
            Save and see today&apos;s lessons <ArrowRight className="size-4" aria-hidden />
          </>
        ) : (
          "Save preferences"
        )}
      </Button>
    </form>
  );
}
