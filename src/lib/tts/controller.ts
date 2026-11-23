import { findWords, speechChunks, wordAt, type Word } from "./text";
import type { VoiceLike } from "./voices";

/**
 * Read-aloud engine for the Listen player, independent of React and of the real browser API
 * (both are injected) so it can be unit-tested.
 *
 * Sync model: each sentence-sized chunk is spoken as its own utterance; the browser's
 * `onboundary` events report a `charIndex` within that chunk, which is offset by the chunk's
 * start to find the exact word in the segment. No timers drive the highlight.
 *
 * If a voice never reports word boundaries, the controller says so (`boundary: "none"`) and
 * falls back to highlighting the whole segment. It never fakes word timing.
 */

export type Status = "idle" | "playing" | "paused" | "done";
export type BoundarySupport = "unknown" | "word" | "none";
/** `word: null` = segment-level highlight (fallback when word boundaries aren't available). */
export type Highlight = { seg: number; word: number | null } | null;

export type BoundaryEventLike = { name?: string; charIndex: number; charLength?: number };
export type UtteranceLike = {
  text: string;
  rate: number;
  lang: string;
  voice: VoiceLike | null;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onboundary: ((e: BoundaryEventLike) => void) | null;
};
export type SynthLike = { speak(u: UtteranceLike): void; cancel(): void; paused?: boolean; resume?(): void };
export type Timers = { set(fn: () => void, ms: number): unknown; clear(id: unknown): void };

export type ControllerOptions = {
  synth: SynthLike;
  createUtterance: (text: string) => UtteranceLike;
  segments: string[];
  onHighlight: (h: Highlight) => void;
  onStatus?: (s: Status) => void;
  onBoundary?: (b: BoundarySupport) => void;
  onProgress?: (fraction: number) => void;
  timers?: Timers;
  /** How long to wait for the first word boundary before deciding the voice doesn't send any. */
  boundaryTimeoutMs?: number;
};

const defaultTimers: Timers = { set: (fn, ms) => setTimeout(fn, ms), clear: (id) => clearTimeout(id as ReturnType<typeof setTimeout>) };

export class SpeechController {
  private readonly o: Required<Omit<ControllerOptions, "onStatus" | "onBoundary" | "onProgress">> &
    Pick<ControllerOptions, "onStatus" | "onBoundary" | "onProgress">;
  private readonly words: Word[][];
  private run = 0;
  private seg = 0;
  private word = -1;
  private status: Status = "idle";
  private rate = 1;
  private voice: VoiceLike | null = null;
  private boundary: BoundarySupport = "unknown";
  private watchdog: unknown = null;
  private disposed = false;

  constructor(opts: ControllerOptions) {
    this.o = { timers: defaultTimers, boundaryTimeoutMs: 1500, ...opts };
    this.words = opts.segments.map(findWords);
  }

  // ---- public API -------------------------------------------------------------------

  get state() {
    return { status: this.status, seg: this.seg, word: this.word, rate: this.rate, boundary: this.boundary };
  }

  /** Play from the start, or resume from the current word after a pause. */
  play(): void {
    if (this.disposed || this.status === "playing") return;
    if (this.status === "paused") this.start(this.seg, this.resumeOffset());
    else this.start(0, 0, true);
  }

  /** Stops audio but keeps the current word highlighted so Resume continues from it. */
  pause(): void {
    if (this.status !== "playing") return;
    this.cancelSpeech();
    this.setStatus("paused");
  }

  restart(): void {
    if (this.disposed) return;
    this.start(0, 0, true);
  }

  /** Stops and clears the highlight. */
  stop(): void {
    if (this.disposed) return;
    this.cancelSpeech();
    this.seg = 0;
    this.word = -1;
    this.emit(null);
    this.o.onProgress?.(0);
    this.setStatus("idle");
  }

  setRate(rate: number): void {
    this.rate = rate;
    if (this.status === "playing") this.start(this.seg, this.resumeOffset());
  }

  /** Changing voice re-checks boundary support, since it differs between voices. */
  setVoice(voice: VoiceLike | null): void {
    this.voice = voice;
    this.setBoundary("unknown");
    if (this.status === "playing") this.start(this.seg, this.resumeOffset());
  }

  /** Call on unmount/navigation: silences audio and ignores any late engine events. */
  dispose(): void {
    this.cancelSpeech();
    this.disposed = true;
  }

  // ---- internals --------------------------------------------------------------------

  private resumeOffset(): number {
    return this.word >= 0 ? (this.words[this.seg][this.word]?.start ?? 0) : 0;
  }

  private start(seg: number, from: number, fromScratch = false): void {
    this.cancelSpeech();
    const run = this.run;
    if (fromScratch) {
      this.word = -1;
      this.emit(null);
    }
    this.setStatus("playing");
    // Defer one tick: some engines drop speak() issued synchronously after cancel().
    this.o.timers.set(() => this.speakSegment(run, seg, from), 0);
  }

  private speakSegment(run: number, seg: number, from: number): void {
    if (run !== this.run || this.disposed) return;
    if (seg >= this.o.segments.length) return this.finish();
    if (seg !== this.seg) this.word = -1;
    this.seg = seg;
    this.o.onProgress?.(seg / this.o.segments.length);
    if (this.boundary === "none") this.emit({ seg, word: null });
    const chunks = speechChunks(this.o.segments[seg], from);
    if (!chunks.length) return this.speakSegment(run, seg + 1, 0);
    this.speakChunk(run, seg, chunks, 0);
  }

  private speakChunk(run: number, seg: number, chunks: { start: number; text: string }[], k: number): void {
    if (run !== this.run || this.disposed) return;
    if (k >= chunks.length) return this.speakSegment(run, seg + 1, 0);
    const chunk = chunks[k];
    const words = this.words[seg];
    let sawBoundary = false;

    const u = this.o.createUtterance(chunk.text);
    u.rate = this.rate;
    if (this.voice) {
      u.voice = this.voice;
      u.lang = this.voice.lang;
    } else u.lang = "en";

    u.onstart = () => {
      if (run !== this.run) return;
      if (this.boundary === "unknown") {
        this.clearWatchdog();
        this.watchdog = this.o.timers.set(() => {
          if (run === this.run && !sawBoundary && this.boundary === "unknown") this.noBoundaries();
        }, this.o.boundaryTimeoutMs);
      }
    };
    u.onboundary = (e) => {
      if (run !== this.run || this.disposed) return;
      if (e.name && e.name !== "word") return; // ignore sentence boundaries
      sawBoundary = true;
      if (this.boundary !== "word") {
        this.clearWatchdog();
        this.setBoundary("word");
      }
      const w = wordAt(words, chunk.start + e.charIndex);
      if (w >= 0 && w !== this.word) {
        this.word = w;
        this.emit({ seg, word: w });
      }
    };
    const next = () => {
      if (run !== this.run || this.disposed) return;
      this.clearWatchdog();
      // A chunk with several words but no boundary at all: this voice doesn't report them.
      if (!sawBoundary && this.boundary === "unknown" && findWords(chunk.text).length > 1) this.noBoundaries();
      this.speakChunk(run, seg, chunks, k + 1);
    };
    u.onend = next;
    u.onerror = (e) => {
      if (run !== this.run) return;
      if (e.error === "interrupted" || e.error === "canceled") return;
      next(); // skip a chunk the engine couldn't speak rather than stalling
    };

    if (this.o.synth.paused) this.o.synth.resume?.();
    this.o.synth.speak(u);
  }

  private noBoundaries(): void {
    this.setBoundary("none");
    this.emit({ seg: this.seg, word: null });
  }

  private finish(): void {
    this.seg = 0;
    this.word = -1;
    this.emit(null);
    this.o.onProgress?.(1);
    this.setStatus("done");
  }

  private cancelSpeech(): void {
    this.run++; // invalidates every callback from earlier utterances
    this.clearWatchdog();
    this.o.synth.cancel();
  }

  private clearWatchdog(): void {
    if (this.watchdog != null) this.o.timers.clear(this.watchdog);
    this.watchdog = null;
  }

  private emit(h: Highlight): void {
    if (!this.disposed) this.o.onHighlight(h);
  }

  private setStatus(s: Status): void {
    this.status = s;
    if (!this.disposed) this.o.onStatus?.(s);
  }

  private setBoundary(b: BoundarySupport): void {
    this.boundary = b;
    if (!this.disposed) this.o.onBoundary?.(b);
  }
}

/** Follow-along: how far to scroll so the active word sits mid-band; 0 when it's already visible. */
export function followScrollDelta(rect: { top: number; bottom: number }, band: { top: number; bottom: number }): number {
  if (rect.top >= band.top && rect.bottom <= band.bottom) return 0;
  return Math.round((rect.top + rect.bottom) / 2 - (band.top + band.bottom) / 2);
}
