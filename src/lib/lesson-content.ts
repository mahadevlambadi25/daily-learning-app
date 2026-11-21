import { WORDS_PER_MINUTE } from "./config";

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Estimated read time in whole minutes (min 1) at 200 wpm, across all reader-visible text. */
export function estimateReadTime(...texts: string[]): number {
  const words = texts.reduce((sum, t) => sum + wordCount(t || ""), 0);
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

export type BodyBlock = { type: "p"; text: string } | { type: "ul"; items: string[] };

/**
 * Parses plain-text lesson bodies into blocks. Paragraphs are separated by blank lines and
 * lines starting with "- " become list items. Output is rendered as React text, never HTML,
 * so admin input can't inject markup (stored-XSS protection).
 */
export function parseBody(body: string): BodyBlock[] {
  const blocks: BodyBlock[] = [];
  for (const chunk of body.replace(/\r\n/g, "\n").split(/\n\s*\n/)) {
    const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    let para: string[] = [];
    let list: string[] = [];
    const flushPara = () => { if (para.length) { blocks.push({ type: "p", text: para.join(" ") }); para = []; } };
    const flushList = () => { if (list.length) { blocks.push({ type: "ul", items: list }); list = []; } };
    for (const line of lines) {
      if (/^[-•*]\s+/.test(line)) { flushPara(); list.push(line.replace(/^[-•*]\s+/, "")); }
      else { flushList(); para.push(line); }
    }
    flushPara();
    flushList();
  }
  return blocks;
}

/**
 * Read-aloud script: title, body, takeaways and the practical action (no UI labels).
 * `takeawayStart` is the index of the "Key takeaways." segment so the UI can map
 * segments back to the elements it highlights.
 */
export function speechSegments(lesson: { title: string; body: string; takeaways: string[]; actionText: string }) {
  const segments = [lesson.title];
  for (const b of parseBody(lesson.body)) {
    if (b.type === "p") segments.push(b.text);
    else segments.push(...b.items);
  }
  const takeawayStart = segments.length;
  segments.push("Key takeaways.", ...lesson.takeaways, "Try this today.", lesson.actionText);
  return { segments, takeawayStart };
}
