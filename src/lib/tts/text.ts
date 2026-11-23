/**
 * Word mapping for read-aloud highlighting. Pure and deterministic (no Intl.Segmenter), so the
 * server and browser render exactly the same word spans and speech offsets map back to them.
 */

export type Word = { start: number; end: number };
export type Piece = { text: string; word?: number };

// Letters, combining marks and digits, allowing inner apostrophes ("don't", "it’s").
// Hyphenated words split into parts, matching how speech engines report boundaries.
const WORD = /[\p{L}\p{M}\p{N}]+(?:['’][\p{L}\p{M}\p{N}]+)*/gu;

/** Word ranges in `text` (character offsets, end exclusive). */
export function findWords(text: string): Word[] {
  const words: Word[] = [];
  for (const m of text.matchAll(WORD)) words.push({ start: m.index!, end: m.index! + m[0].length });
  return words;
}

/** Splits text into word / non-word pieces that concatenate back to the original string. */
export function toPieces(text: string): Piece[] {
  const pieces: Piece[] = [];
  let pos = 0;
  findWords(text).forEach((w, i) => {
    if (w.start > pos) pieces.push({ text: text.slice(pos, w.start) });
    pieces.push({ text: text.slice(w.start, w.end), word: i });
    pos = w.end;
  });
  if (pos < text.length) pieces.push({ text: text.slice(pos) });
  return pieces;
}

/**
 * Index of the word a speech boundary refers to: the word containing `charIndex`, or the next
 * word if the boundary points at spaces/punctuation. Returns -1 when past the last word.
 */
export function wordAt(words: Word[], charIndex: number): number {
  let lo = 0;
  let hi = words.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (words[mid].end > charIndex) {
      ans = mid;
      hi = mid - 1;
    } else lo = mid + 1;
  }
  return ans;
}

/**
 * Splits a segment into sentence-sized chunks for speaking (long single utterances are cut off
 * by some engines). Each chunk keeps its start offset so boundary positions map back exactly.
 */
export function speechChunks(text: string, from = 0, maxLen = 220): { start: number; text: string }[] {
  const chunks: { start: number; text: string }[] = [];
  let start = from;
  while (start < text.length) {
    // Skip leading whitespace so chunks start on content.
    while (start < text.length && /\s/.test(text[start])) start++;
    if (start >= text.length) break;
    let end = text.length;
    const rest = text.slice(start);
    const sentence = rest.search(/[.!?…](?=\s|$)/);
    if (sentence >= 0) end = start + sentence + 1;
    if (end - start > maxLen) {
      // Very long sentence: break at the last space within the limit.
      const cut = text.lastIndexOf(" ", start + maxLen);
      end = cut > start ? cut : start + maxLen;
    }
    chunks.push({ start, text: text.slice(start, end) });
    start = end;
  }
  return chunks;
}
