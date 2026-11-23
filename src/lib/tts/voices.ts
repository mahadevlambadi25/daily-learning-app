/**
 * Voice selection helpers. Only voices the browser actually reports are shown: no invented
 * names, and no assumption that male/female or any accent is available on every device.
 */

export type VoiceLike = Pick<SpeechSynthesisVoice, "name" | "lang" | "voiceURI" | "localService" | "default">;
export type SavedVoice = { uri: string; name: string; lang: string };

export const VOICE_STORAGE_KEY = "daylight.tts.voice";
export const RATE_STORAGE_KEY = "daylight.tts.rate";
/** Value used for "let the browser choose". */
export const SYSTEM_DEFAULT = "";

const ENGLISH_ORDER = ["en-IN", "en-US", "en-GB"];

const norm = (lang: string) => lang.replace("_", "-");

/** "English (India)" style label from a BCP-47 tag, falling back to the raw tag. */
export function languageLabel(lang: string): string {
  const tag = norm(lang);
  try {
    const dn = new Intl.DisplayNames(["en"], { type: "language" });
    return dn.of(tag) ?? tag;
  } catch {
    return tag;
  }
}

/** Option label: the voice's real name plus its language/accent, e.g. "Microsoft Heera – English (India)". */
export function voiceLabel(v: VoiceLike): string {
  const lang = languageLabel(v.lang);
  return v.name.toLowerCase().includes(lang.toLowerCase()) ? v.name : `${v.name} – ${lang}`;
}

/** Short display name for the picker: "Microsoft Zira - English (United States)" → "Zira". */
export function shortVoiceName(v: VoiceLike): string {
  const short = v.name
    .replace(/^(Microsoft|Google|Apple)\s+/i, "")
    .replace(/\s+(Online\s+\(Natural\)\s*)?[-–]\s+.*$/i, "")
    .replace(/\s+Online\s+\(Natural\)$/i, "")
    .trim();
  return short || v.name;
}

function rank(v: VoiceLike): number {
  const lang = norm(v.lang);
  const i = ENGLISH_ORDER.findIndex((l) => lang.toLowerCase() === l.toLowerCase());
  if (i >= 0) return i;
  if (lang.toLowerCase().startsWith("en")) return ENGLISH_ORDER.length;
  return 99;
}

/**
 * Voices to offer for English lessons: English ones first (India, US, UK, then others), each
 * group sorted by name. If the device has no English voice at all, every voice is offered.
 */
export function voicesForMenu<T extends VoiceLike>(voices: T[]): T[] {
  const english = voices.filter((v) => norm(v.lang).toLowerCase().startsWith("en"));
  const list = english.length ? english : voices;
  return [...list].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

/**
 * The voice to use: the saved one if it still exists (matched by URI, then name), otherwise a
 * voice for the saved language, otherwise a local voice matching the user's language, then any
 * English voice. `null` means "system default".
 */
export function pickVoice<T extends VoiceLike>(voices: T[], saved: SavedVoice | null, userLang = "en-US"): T | null {
  if (!voices.length) return null;
  if (saved && saved.uri === SYSTEM_DEFAULT && !saved.name) return null; // user chose "System default"
  if (saved) {
    const exact = voices.find((v) => v.voiceURI === saved.uri) ?? voices.find((v) => v.name === saved.name);
    if (exact) return exact;
    const sameLang = voices.filter((v) => norm(v.lang).toLowerCase() === norm(saved.lang).toLowerCase());
    if (sameLang.length) return sameLang.find((v) => v.localService) ?? sameLang[0];
  }
  const lang = norm(userLang).toLowerCase();
  const english = voices.filter((v) => norm(v.lang).toLowerCase().startsWith("en"));
  return (
    english.find((v) => norm(v.lang).toLowerCase() === lang && v.localService) ??
    english.find((v) => norm(v.lang).toLowerCase() === lang) ??
    english.find((v) => v.default) ??
    english.find((v) => v.localService) ??
    english[0] ??
    null
  );
}

// ---- Preferences (per device; storage may be unavailable, e.g. private mode) ---------

export function loadSavedVoice(): SavedVoice | null {
  try {
    const raw = localStorage.getItem(VOICE_STORAGE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as SavedVoice;
    return typeof v?.uri === "string" && typeof v?.name === "string" ? v : null;
  } catch {
    return null;
  }
}

/** `null` remembers an explicit "System default" choice (stored with an empty URI). */
export function saveVoice(v: VoiceLike | null): void {
  try {
    const saved: SavedVoice = v ? { uri: v.voiceURI, name: v.name, lang: v.lang } : { uri: SYSTEM_DEFAULT, name: "", lang: "" };
    localStorage.setItem(VOICE_STORAGE_KEY, JSON.stringify(saved));
  } catch {
    /* storage unavailable: preference just isn't remembered */
  }
}

export function loadRate(allowed: readonly number[], fallback = 1): number {
  try {
    const r = Number(localStorage.getItem(RATE_STORAGE_KEY));
    return allowed.includes(r) ? r : fallback;
  } catch {
    return fallback;
  }
}

export function saveRate(rate: number): void {
  try {
    localStorage.setItem(RATE_STORAGE_KEY, String(rate));
  } catch {
    /* ignore */
  }
}
