"use client";

import { useEffect, useRef, useState } from "react";
import { Info, LoaderCircle, Pause, Play, RotateCcw, Square, Volume2 } from "lucide-react";
import { SpeechController, type BoundarySupport, type Highlight, type Status, type UtteranceLike } from "@/lib/tts/controller";
import { loadRate, loadSavedVoice, pickVoice, saveRate, saveVoice, SYSTEM_DEFAULT, voicesForMenu } from "@/lib/tts/voices";
import { cn } from "./ui";
import { VoicePicker } from "./voice-picker";

const RATES = [0.75, 1, 1.25, 1.5, 1.75] as const;

/**
 * Browser-native read-aloud (PRD §10) with word-by-word highlighting.
 * The SpeechController does the speaking and reports which word the voice is on (from the
 * browser's own word-boundary events); this component is only the controls around it.
 * Never autoplays, and always goes silent when it unmounts or the page is hidden.
 */
export function ListenPlayer({
  segments,
  onHighlight,
  onFirstPlay,
}: {
  segments: string[];
  onHighlight: (h: Highlight) => void;
  onFirstPlay?: () => void;
}) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceUri, setVoiceUri] = useState<string>(SYSTEM_DEFAULT);
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [rate, setRate] = useState(1);
  const [boundary, setBoundary] = useState<BoundarySupport>("unknown");
  const [voicesSettled, setVoicesSettled] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const ctrl = useRef<SpeechController | null>(null);
  const started = useRef(false);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const rateRef = useRef(1);
  const highlightRef = useRef(onHighlight);
  useEffect(() => {
    highlightRef.current = onHighlight;
  }, [onHighlight]);

  // Support check + saved speed (client only, so server and first client render match).
  useEffect(() => {
    const ok = typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
    setSupported(ok);
    const r = loadRate(RATES, 1);
    rateRef.current = r;
    setRate(r);
  }, []);

  // Voices arrive asynchronously (and can change, e.g. when a language pack installs).
  useEffect(() => {
    if (!supported) return;
    const synth = window.speechSynthesis;
    const load = () => {
      const list = synth.getVoices();
      setVoices(list);
      const current = voiceRef.current;
      // Keep the chosen voice if it's still there; otherwise restore the saved one or fall back.
      if (current && list.some((v) => v.voiceURI === current.voiceURI)) return;
      const v = pickVoice(list, loadSavedVoice(), navigator.language || "en-US");
      voiceRef.current = v;
      setVoiceUri(v?.voiceURI ?? SYSTEM_DEFAULT);
      ctrl.current?.setVoice(v);
    };
    load();
    synth.addEventListener("voiceschanged", load);
    const t = setTimeout(() => setVoicesSettled(true), 2500); // don't flash "no voices" while they load
    return () => {
      synth.removeEventListener("voiceschanged", load);
      clearTimeout(t);
    };
  }, [supported]);

  // One controller per lesson script.
  useEffect(() => {
    if (!supported) return;
    const synth = window.speechSynthesis;
    const c = new SpeechController({
      synth: synth as unknown as ConstructorParameters<typeof SpeechController>[0]["synth"],
      createUtterance: (text) => new SpeechSynthesisUtterance(text) as unknown as UtteranceLike,
      segments,
      onHighlight: (h) => highlightRef.current(h),
      onStatus: setStatus,
      onBoundary: setBoundary,
      onProgress: setProgress,
      onWaiting: setWaiting,
    });
    c.setRate(rateRef.current);
    c.setVoice(voiceRef.current);
    ctrl.current = c;
    const onHide = () => c.stop();
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      c.dispose();
      ctrl.current = null;
      highlightRef.current(null);
      setStatus("idle");
      setProgress(0);
      setWaiting(false);
    };
  }, [supported, segments]);

  function play() {
    if (!started.current) {
      started.current = true;
      onFirstPlay?.();
    }
    ctrl.current?.play();
  }
  function cycleRate() {
    changeRate(RATES[(RATES.indexOf(rate as (typeof RATES)[number]) + 1) % RATES.length]);
  }
  function changeRate(r: number) {
    rateRef.current = r;
    setRate(r);
    saveRate(r);
    ctrl.current?.setRate(r);
  }
  function changeVoice(uri: string) {
    const v = uri === SYSTEM_DEFAULT ? null : (voices.find((x) => x.voiceURI === uri) ?? null);
    voiceRef.current = v;
    setVoiceUri(v?.voiceURI ?? SYSTEM_DEFAULT);
    saveVoice(v);
    ctrl.current?.setVoice(v);
  }

  if (supported === false) {
    return (
      <div role="status" className="flex items-start gap-3 rounded-3xl border border-line bg-surface-2 p-5 text-sm">
        <Info className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
        <div>
          <p className="font-semibold">Read-aloud isn&apos;t available here</p>
          <p className="mt-1 text-muted">Your browser doesn&apos;t support speech playback. Try a recent version of Chrome, Edge, Safari or Firefox.</p>
        </div>
      </div>
    );
  }

  const playing = status === "playing";
  const menu = voicesForMenu(voices);
  const pct = Math.round(progress * 100);

  const loading = playing && waiting;

  return (
    <div className="rounded-2xl border border-line bg-surface px-3 py-2.5 shadow-card sm:px-4" aria-label="Read-aloud player" role="region">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <button
          type="button"
          onClick={playing ? () => ctrl.current?.pause() : play}
          disabled={supported === null}
          aria-label={loading ? "Starting, tap to pause" : playing ? "Pause" : status === "paused" ? "Resume" : "Play"}
          aria-busy={loading}
          className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-accent-ink shadow-card transition-transform active:scale-95 disabled:opacity-60"
        >
          {loading ? (
            <LoaderCircle className="size-5 animate-spin" aria-hidden />
          ) : playing ? (
            <Pause className="size-5" fill="currentColor" aria-hidden />
          ) : (
            <Play className="ml-0.5 size-5" fill="currentColor" aria-hidden />
          )}
        </button>

        <div className="min-w-0 flex-1 basis-0">
          <p className="flex items-center gap-1.5 truncate text-sm font-semibold" aria-live="polite">
            {loading ? (
              "Starting…"
            ) : playing ? (
              <>
                <Equalizer /> Listening
              </>
            ) : status === "paused" ? (
              "Paused"
            ) : status === "done" ? (
              "Finished"
            ) : (
              <>
                <Volume2 className="size-4 shrink-0 text-accent" aria-hidden /> <span className="truncate">Listen to this lesson</span>
              </>
            )}
          </p>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-2" aria-hidden>
            <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Speed, voice, restart, stop: their own row on phones, inline on wider screens. */}
        <div className="flex w-full items-center gap-1.5 sm:w-auto sm:gap-2">
          <button
            type="button"
            onClick={cycleRate}
            aria-label={`Playback speed ${rate}×. Tap to change.`}
            title="Playback speed"
            className="h-8 w-14 shrink-0 rounded-full bg-surface-2 text-xs font-bold tabular-nums transition-colors hover:bg-accent-soft"
          >
            {rate}×
          </button>
          <VoicePicker voices={menu} value={voiceUri} onChange={changeVoice} disabled={supported === null} className="flex-1 sm:w-48 sm:flex-none" />
          <button
            type="button"
            onClick={() => ctrl.current?.restart()}
            aria-label="Restart from the beginning"
            title="Restart"
            className="grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
          >
            <RotateCcw className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => ctrl.current?.stop()}
            aria-label="Stop"
            title="Stop"
            disabled={status === "idle"}
            className="grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-40"
          >
            <Square className="size-4" />
          </button>
        </div>
      </div>

      {boundary === "none" ? (
        <p role="status" className="mt-1.5 text-[11px] leading-snug text-muted">
          This voice follows along sentence by sentence.
        </p>
      ) : supported && voicesSettled && !voices.length ? (
        <p className="mt-2 text-[11px] text-muted">Your device didn&apos;t list any voices, so its default voice is used.</p>
      ) : null}
    </div>
  );
}

function Equalizer() {
  return (
    <span className="inline-flex h-4 items-end gap-0.5" aria-hidden>
      {[0, 150, 300].map((d) => (
        <span key={d} className="w-1 animate-[eq_0.9s_ease-in-out_infinite] rounded-full bg-accent" style={{ animationDelay: `${d}ms`, height: "100%" }} />
      ))}
      <style>{`@keyframes eq{0%,100%{transform:scaleY(.3)}50%{transform:scaleY(1)}} span[style]{transform-origin:bottom}`}</style>
    </span>
  );
}
