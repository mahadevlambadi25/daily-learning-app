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

const SHORT_REGION: Record<string, string> = { US: "US", GB: "UK", IN: "India", AU: "Australia", CA: "Canada", IE: "Ireland", NZ: "New Zealand", ZA: "South Africa" };

/**
 * Accent label for the picker. English voices are named by region ("India", "US", "UK"),
 * others by language ("French"). `long` gives the full region name for group headings.
 */
export function accentLabel(lang: string, long = false): string {
  const [code, region] = norm(lang).split("-");
  if (code?.toLowerCase() !== "en" || !region) return code?.toLowerCase() === "en" ? "English" : languageLabel(code ?? lang);
  const r = region.toUpperCase();
  if (!long && SHORT_REGION[r]) return SHORT_REGION[r];
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(r) ?? r;
  } catch {
    return r;
  }
}

// Browsers don't expose a voice's gender, so it's taken only from voice names whose gender
// is documented by their vendor (Windows desktop, Edge online "Natural", macOS/iOS English
// voices) or stated in the name itself ("Google UK English Male"). Anything else, including
// Android's locale-named voices, shows no gender rather than a guess.
const FEMALE = new Set(
  "zira hazel susan heera catherine aria jenny sonia libby natasha clara neerja emma ava michelle ashley cora elizabeth jane nancy amber maisie samantha karen moira tessa veena fiona victoria allison serena kate nicky zoe".split(" "),
);
const MALE = new Set(
  "david mark george ravi james guy ryan thomas william christopher eric brian andrew roger steffan connor liam prabhat daniel alex fred rishi aaron arthur oliver".split(" "),
);

export function voiceGender(v: VoiceLike): "Female" | "Male" | null {
  const name = v.name.toLowerCase();
  if (/\bfemale\b/.test(name)) return "Female";
  if (/\bmale\b/.test(name)) return "Male";
  for (const word of name.replace(/^(microsoft|google|apple)\s+/, "").split(/[^a-z]+/)) {
    if (FEMALE.has(word)) return "Female";
    if (MALE.has(word)) return "Male";
  }
  return null;
}

/** Short display name for the picker: "Microsoft Zira - English (United States)" → "Zira". */
export function shortVoiceName(v: VoiceLike): string {
  // Android Chrome names voices after their locale ("English United States"); the region badge
  // already says that, so call it what it is.
  if (/^english\b/i.test(v.name.trim())) return "Phone voice";
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
