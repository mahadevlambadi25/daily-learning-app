import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { findWords, speechChunks, toPieces, wordAt } from "@/lib/tts/text";
import { followScrollDelta, SpeechController, type Highlight, type Status, type UtteranceLike } from "@/lib/tts/controller";
import { pickVoice, shortVoiceName, SYSTEM_DEFAULT, voiceLabel, voicesForMenu, type VoiceLike } from "@/lib/tts/voices";
import { Speakable } from "@/components/speakable";

// ---- Fakes --------------------------------------------------------------------------------

type FakeUtterance = UtteranceLike & { id: number };

class FakeSynth {
  spoken: FakeUtterance[] = [];
  current: FakeUtterance | null = null;
  cancels = 0;
  private n = 0;
  createUtterance = (text: string): UtteranceLike => {
    const u: FakeUtterance = { id: ++this.n, text, rate: 1, lang: "", voice: null, onstart: null, onend: null, onerror: null, onboundary: null };
    return u;
  };
  speak(u: UtteranceLike) {
    // A real engine queues; the controller never queues more than one, so overlap would show here.
    if (this.current) throw new Error(`overlapping audio: "${this.current.text}" still speaking`);
    this.current = u as FakeUtterance;
    this.spoken.push(this.current);
    this.current.onstart?.();
  }
  cancel() {
    this.cancels++;
    const u = this.current;
    this.current = null;
    u?.onerror?.({ error: "interrupted" });
  }
  /** Fires a word boundary at the start of `word` in the current utterance. */
  boundaryAtWord(word: string, nth = 0) {
    const u = this.current!;
    let idx = -1;
    for (let i = 0; i <= nth; i++) idx = u.text.indexOf(word, idx + 1);
    if (idx < 0) throw new Error(`"${word}" not in "${u.text}"`);
    u.onboundary?.({ name: "word", charIndex: idx, charLength: word.length });
  }
  /** Speaks the whole current utterance word by word, then ends it. */
  speakAll() {
    const u = this.current!;
    for (const w of findWords(u.text)) u.onboundary?.({ name: "word", charIndex: w.start });
    this.end();
  }
  end() {
    const u = this.current!;
    this.current = null;
    u.onend?.();
  }
  fail(error: string) {
    const u = this.current!;
    this.current = null;
    u.onerror?.({ error });
  }
}

class FakeTimers {
  private q = new Map<number, { fn: () => void; at: number }>();
  private id = 0;
  now = 0;
  set = (fn: () => void, ms: number) => {
    this.q.set(++this.id, { fn, at: this.now + ms });
    return this.id;
  };
  clear = (id: unknown) => void this.q.delete(id as number);
  /** Advances time, running due callbacks in order. */
  tick(ms = 0) {
    const target = this.now + ms;
    for (;;) {
      const due = [...this.q.entries()].filter(([, t]) => t.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      this.q.delete(due[0]);
      this.now = due[1].at;
      due[1].fn();
    }
    this.now = target;
  }
}

function setup(segments: string[]) {
  const synth = new FakeSynth();
  const timers = new FakeTimers();
  const highlights: Highlight[] = [];
  const statuses: Status[] = [];
  const boundaries: string[] = [];
  const c = new SpeechController({
    synth,
    createUtterance: synth.createUtterance,
    segments,
    timers,
    onHighlight: (h) => highlights.push(h),
    onStatus: (s) => statuses.push(s),
    onBoundary: (b) => boundaries.push(b),
  });
  const last = () => highlights[highlights.length - 1];
  return { synth, timers, c, highlights, statuses, boundaries, last };
}

const voice = (name: string, lang: string, extra: Partial<VoiceLike> = {}): VoiceLike => ({
  name,
  lang,
  voiceURI: `uri:${name}`,
  localService: true,
  default: false,
  ...extra,
});

// ---- Text mapping ---------------------------------------------------------------------------

describe("tts text mapping", () => {
  it("finds words, keeping contractions and splitting on punctuation", () => {
    const t = "Don't stop — it’s 2026, café-time!";
    expect(findWords(t).map((w) => t.slice(w.start, w.end))).toEqual(["Don't", "stop", "it’s", "2026", "café", "time"]);
  });

  it("pieces rebuild the exact original text", () => {
    for (const t of ["Hello, world.", "  spaced  out  ", "“Quoted” (and) more…", "", "नमस्ते दुनिया"]) {
      expect(toPieces(t).map((p) => p.text).join("")).toBe(t);
    }
  });

  it("maps a charIndex to the word containing it, or the next word", () => {
    const t = "One, two three.";
    const w = findWords(t);
    expect(wordAt(w, 0)).toBe(0);
    expect(wordAt(w, 2)).toBe(0); // inside "One"
    expect(wordAt(w, 3)).toBe(1); // the comma → next word
    expect(wordAt(w, t.indexOf("three"))).toBe(2);
    expect(wordAt(w, t.length - 1)).toBe(-1); // final period: no word left
    expect(wordAt([], 0)).toBe(-1);
  });

  it("splits long text into sentence chunks whose offsets point back into the original", () => {
    const t = "First sentence here. Second one! " + "word ".repeat(80).trim() + ".";
    const chunks = speechChunks(t, 0, 120);
    expect(chunks.length).toBeGreaterThan(3);
    for (const ch of chunks) {
      expect(t.slice(ch.start, ch.start + ch.text.length)).toBe(ch.text);
      expect(ch.text.length).toBeLessThanOrEqual(120);
    }
    expect(chunks[0].text).toBe("First sentence here.");
    expect(chunks[1].text).toBe("Second one!");
  });

  it("chunks can start mid-text (resume)", () => {
    const t = "Alpha beta. Gamma delta.";
    expect(speechChunks(t, t.indexOf("beta"))).toEqual([
      { start: 6, text: "beta." },
      { start: 12, text: "Gamma delta." },
    ]);
  });

  it("Speakable renders the original text with one span per word", () => {
    const html = renderToStaticMarkup(createElement(Speakable, { text: "It's a test, ok?" }));
    expect(html).toBe('<span data-w="0">It&#x27;s</span> <span data-w="1">a</span> <span data-w="2">test</span>, <span data-w="3">ok</span>?');
  });
});

// ---- Controller -----------------------------------------------------------------------------

describe("speech controller", () => {
  it("highlights exactly the word the engine reports, one at a time, across segments", () => {
    const { synth, timers, c, highlights } = setup(["Hello world.", "Second part here."]);
    c.play();
    timers.tick();
    synth.boundaryAtWord("Hello");
    synth.boundaryAtWord("world");
    synth.boundaryAtWord("world"); // duplicate event → no extra highlight
    synth.end();
    timers.tick();
    synth.boundaryAtWord("Second");
    synth.boundaryAtWord("here");
    expect(highlights).toEqual([null, { seg: 0, word: 0 }, { seg: 0, word: 1 }, { seg: 1, word: 0 }, { seg: 1, word: 2 }]);
  });

  it("maps boundaries in later chunks using the chunk's offset", () => {
    const long = "One two. Three four.";
    const { synth, timers, c, last } = setup([long]);
    c.play();
    timers.tick();
    synth.speakAll(); // "One two."
    expect(synth.current?.text).toBe("Three four.");
    synth.boundaryAtWord("four"); // charIndex 6 in the chunk → word 3 in the segment
    expect(last()).toEqual({ seg: 0, word: 3 });
  });

  it("ignores sentence boundaries", () => {
    const { synth, timers, c, highlights } = setup(["A b c."]);
    c.play();
    timers.tick();
    synth.current!.onboundary!({ name: "sentence", charIndex: 4 });
    expect(highlights).toEqual([null]);
  });

  it("pause keeps the word; resume continues from that word", () => {
    const { synth, timers, c, last, statuses } = setup(["Alpha beta gamma delta."]);
    c.play();
    timers.tick();
    synth.boundaryAtWord("Alpha");
    synth.boundaryAtWord("gamma");
    c.pause();
    expect(synth.current).toBeNull(); // silent
    expect(last()).toEqual({ seg: 0, word: 2 }); // still highlighted
    expect(statuses.at(-1)).toBe("paused");
    c.play();
    timers.tick();
    expect(synth.current?.text).toBe("gamma delta.");
    synth.boundaryAtWord("delta");
    expect(last()).toEqual({ seg: 0, word: 3 });
  });

  it("restart goes back to the first word; stop clears the highlight", () => {
    const { synth, timers, c, last, statuses } = setup(["One two.", "Three."]);
    c.play();
    timers.tick();
    synth.speakAll();
    timers.tick();
    synth.boundaryAtWord("Three");
    c.restart();
    expect(last()).toBeNull();
    timers.tick();
    expect(synth.current?.text).toBe("One two.");
    synth.boundaryAtWord("One");
    expect(last()).toEqual({ seg: 0, word: 0 });
    c.stop();
    expect(synth.current).toBeNull();
    expect(last()).toBeNull();
    expect(statuses.at(-1)).toBe("idle");
  });

  it("finishing clears the highlight and reports done; play again starts over", () => {
    const { synth, timers, c, last, statuses } = setup(["Only one."]);
    c.play();
    timers.tick();
    synth.speakAll();
    timers.tick();
    expect(last()).toBeNull();
    expect(statuses.at(-1)).toBe("done");
    c.play();
    timers.tick();
    expect(synth.current?.text).toBe("Only one.");
  });

  it("speed change restarts at the current word with the new rate, with no overlap", () => {
    const { synth, timers, c } = setup(["Alpha beta gamma."]);
    c.play();
    timers.tick();
    synth.boundaryAtWord("beta");
    c.setRate(1.5); // FakeSynth throws if a second utterance starts while one is live
    timers.tick();
    expect(synth.current?.text).toBe("beta gamma.");
    expect(synth.current?.rate).toBe(1.5);
  });

  it("voice change restarts at the current word with the new voice and re-checks boundaries", () => {
    const { synth, timers, c, boundaries } = setup(["Alpha beta gamma."]);
    c.play();
    timers.tick();
    synth.boundaryAtWord("beta");
    const v = voice("Veena", "en-IN");
    c.setVoice(v);
    timers.tick();
    expect(synth.current?.voice).toBe(v);
    expect(synth.current?.lang).toBe("en-IN");
    expect(synth.current?.text).toBe("beta gamma.");
    expect(boundaries).toEqual(["word", "unknown"]);
  });

  it("events from a cancelled utterance are ignored", () => {
    const { synth, timers, c, last } = setup(["Alpha beta gamma."]);
    c.play();
    timers.tick();
    const old = synth.current!;
    synth.boundaryAtWord("Alpha");
    c.setRate(2);
    timers.tick();
    old.onboundary?.({ name: "word", charIndex: old.text.indexOf("gamma") });
    old.onend?.();
    expect(last()).toEqual({ seg: 0, word: 0 });
    expect(synth.spoken).toHaveLength(2);
  });

  it("falls back to segment highlight when the voice sends no word boundaries", () => {
    const { synth, timers, c, last, boundaries } = setup(["No boundaries here.", "Next part."]);
    c.play();
    timers.tick();
    timers.tick(1500); // watchdog
    expect(boundaries.at(-1)).toBe("none");
    expect(last()).toEqual({ seg: 0, word: null });
    synth.end();
    timers.tick();
    expect(last()).toEqual({ seg: 1, word: null });
  });

  it("detects missing boundaries when an utterance ends before the watchdog", () => {
    const { synth, timers, c, boundaries } = setup(["Quick short text."]);
    c.play();
    timers.tick();
    synth.end();
    expect(boundaries.at(-1)).toBe("none");
  });

  it("dispose silences audio and ignores late events", () => {
    const { synth, timers, c, highlights } = setup(["Alpha beta."]);
    c.play();
    timers.tick();
    const u = synth.current!;
    c.dispose();
    expect(synth.current).toBeNull();
    const before = highlights.length;
    u.onboundary?.({ name: "word", charIndex: 6 });
    u.onend?.();
    timers.tick(5000);
    c.play();
    timers.tick();
    expect(highlights.length).toBe(before);
    expect(synth.spoken).toHaveLength(1);
  });

  it("skips a chunk the engine fails on instead of stalling", () => {
    const { synth, timers, c } = setup(["Bad one.", "Good one."]);
    c.play();
    timers.tick();
    synth.fail("synthesis-failed");
    timers.tick();
    expect(synth.current?.text).toBe("Good one.");
  });
});

// ---- Voices ---------------------------------------------------------------------------------

describe("voice selection", () => {
  const voices = [
    voice("Zira", "en-US"),
    voice("Hazel", "en-GB"),
    voice("Heera", "en-IN"),
    voice("Hortense", "fr-FR"),
    voice("Catherine", "en-AU"),
    voice("David", "en_US", { default: true }),
  ];

  it("menu lists English voices: India, US, UK, then others", () => {
    expect(voicesForMenu(voices).map((v) => v.name)).toEqual(["Heera", "David", "Zira", "Hazel", "Catherine"]);
  });

  it("menu falls back to all voices when none are English", () => {
    expect(voicesForMenu([voice("Hortense", "fr-FR")]).map((v) => v.name)).toEqual(["Hortense"]);
  });

  it("labels include language and region", () => {
    expect(voiceLabel(voice("Heera", "en-IN"))).toMatch(/Heera.*English.*India/);
  });

  it("short names drop vendor and language suffixes for the picker", () => {
    expect(shortVoiceName(voice("Microsoft Zira - English (United States)", "en-US"))).toBe("Zira");
    expect(shortVoiceName(voice("Microsoft Neerja Online (Natural) - English (India)", "en-IN"))).toBe("Neerja");
    expect(shortVoiceName(voice("Google UK English Female", "en-GB"))).toBe("UK English Female");
    expect(shortVoiceName(voice("Samantha", "en-US"))).toBe("Samantha");
  });

  it("restores a saved voice, by URI then by name", () => {
    expect(pickVoice(voices, { uri: "uri:Hazel", name: "Hazel", lang: "en-GB" })?.name).toBe("Hazel");
    expect(pickVoice(voices, { uri: "gone", name: "Zira", lang: "en-US" })?.name).toBe("Zira");
  });

  it("falls back to the saved language, then the user's language, when the saved voice is gone", () => {
    expect(pickVoice(voices, { uri: "gone", name: "Gone", lang: "en-IN" })?.name).toBe("Heera");
    expect(pickVoice(voices, { uri: "gone", name: "Gone", lang: "xx" }, "en-GB")?.name).toBe("Hazel");
  });

  it("respects an explicit System default choice", () => {
    expect(pickVoice(voices, { uri: SYSTEM_DEFAULT, name: "", lang: "" })).toBeNull();
  });

  it("returns null (system default) when the device lists no voices", () => {
    expect(pickVoice([], null)).toBeNull();
    expect(pickVoice([voice("Hortense", "fr-FR")], null)).toBeNull();
  });
});

// ---- Follow along ---------------------------------------------------------------------------

describe("follow along", () => {
  const band = { top: 100, bottom: 700 };
  it("doesn't scroll while the word is comfortably visible", () => {
    expect(followScrollDelta({ top: 300, bottom: 330 }, band)).toBe(0);
  });
  it("brings an off-screen word near the middle", () => {
    expect(followScrollDelta({ top: 900, bottom: 930 }, band)).toBe(515);
    expect(followScrollDelta({ top: 40, bottom: 70 }, band)).toBe(-345);
  });
});
