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
 * Read-aloud script, in reading order: title, hook, body, the "Key takeaways" heading and items,
 * then the "Try this today" heading and action. Each segment is exactly the text shown on screen
 * for one element (so speech character offsets map 1:1 onto the rendered words).
 * Returned indexes let the UI attach each element to its segment number.
 */
export function speechSegments(lesson: { title: string; hook?: string; body: string; takeaways: string[]; actionText: string }) {
  const segments = [lesson.title];
  const hookIndex = lesson.hook ? segments.push(lesson.hook) - 1 : -1;
  const bodyStart = segments.length;
  for (const b of parseBody(lesson.body)) {
    if (b.type === "p") segments.push(b.text);
    else segments.push(...b.items);
  }
  const takeawayStart = segments.length;
  segments.push(TAKEAWAYS_HEADING, ...lesson.takeaways, ACTION_HEADING, lesson.actionText);
  return { segments, hookIndex, bodyStart, takeawayStart };
}

export const TAKEAWAYS_HEADING = "Key takeaways";
export const ACTION_HEADING = "Try this today";
