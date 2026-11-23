"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Info, Pause, Play, RotateCcw, Square, Volume2 } from "lucide-react";
import { cn } from "./ui";

const RATES = [0.75, 1, 1.25, 1.5, 1.75];

type Status = "idle" | "playing" | "paused" | "done";

/**
 * Browser-native read-aloud (PRD §10). Speaks one segment at a time, which avoids long-utterance
 * cut-offs in some browsers and lets us highlight and follow the current paragraph.
 * Pause is implemented as cancel + remember position, which behaves consistently across browsers.
 * Never autoplays, and always stops when the component unmounts or the page is hidden.
 */
export function ListenPlayer({
  segments,
  onSegmentChange,
  onFirstPlay,
}: {
  segments: string[];
  onSegmentChange: (index: number | null) => void;
  onFirstPlay?: () => void;
}) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [noVoices, setNoVoices] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [index, setIndex] = useState(0);
  const [rate, setRate] = useState(1);
  const runId = useRef(0);
  const started = useRef(false);
  const voice = useRef<SpeechSynthesisVoice | null>(null);

  // Detect support and pick an English voice once voices load.
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
      setSupported(false);
      return;
    }
    setSupported(true);
    const synth = window.speechSynthesis;
    const pick = () => {
      const voices = synth.getVoices();
      if (!voices.length) return false;
      const lang = navigator.language || "en-US";
      voice.current =
        voices.find((v) => v.lang === lang && v.localService) ??
        voices.find((v) => v.lang.startsWith("en") && v.localService) ??
        voices.find((v) => v.lang.startsWith("en")) ??
        voices[0];
      setNoVoices(false);
      return true;
    };
    if (!pick()) {
      synth.addEventListener("voiceschanged", pick);
      const t = setTimeout(() => {
        if (!synth.getVoices().length) setNoVoices(true);
      }, 2500);
      return () => {
        synth.removeEventListener("voiceschanged", pick);
        clearTimeout(t);
      };
    }
  }, []);

  const stopSpeech = useCallback(() => {
    runId.current++; // invalidates callbacks from cancelled utterances
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  const speakFrom = useCallback(
    (start: number, speed: number) => {
      stopSpeech();
      const id = runId.current;
      const synth = window.speechSynthesis;
      const speak = (i: number) => {
        if (id !== runId.current) return;
        if (i >= segments.length) {
          setStatus("done");
          setIndex(0);
          onSegmentChange(null);
          return;
        }
        setIndex(i);
        onSegmentChange(i);
        const u = new SpeechSynthesisUtterance(segments[i]);
        u.rate = speed;
        if (voice.current) {
          u.voice = voice.current;
          u.lang = voice.current.lang;
        }
        u.onend = () => speak(i + 1);
        u.onerror = (e) => {
          if (id !== runId.current) return;
          if (e.error === "interrupted" || e.error === "canceled") return;
          speak(i + 1);
        };
        synth.speak(u);
      };
      setStatus("playing");
      speak(start);
    },
    [segments, onSegmentChange, stopSpeech],
  );

  // Stop cleanly on route change/unmount and when the tab is closed.
  useEffect(() => {
    const onHide = () => stopSpeech();
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      stopSpeech();
      onSegmentChange(null);
    };
  }, [stopSpeech, onSegmentChange]);

  function play() {
    if (!started.current) {
      started.current = true;
      onFirstPlay?.();
    }
    speakFrom(status === "done" ? 0 : index, rate);
  }
  function pause() {
    stopSpeech();
    setStatus("paused");
  }
  function restart() {
    speakFrom(0, rate);
  }
  function stop() {
    stopSpeech();
    setStatus("idle");
    setIndex(0);
    onSegmentChange(null);
  }
  function changeRate(r: number) {
    setRate(r);
    if (status === "playing") speakFrom(index, r);
  }

  if (supported === false || noVoices) {
    return (
      <div role="status" className="flex items-start gap-3 rounded-3xl border border-line bg-surface-2 p-5 text-sm">
        <Info className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
        <div>
          <p className="font-semibold">Read-aloud isn&apos;t available here</p>
          <p className="mt-1 text-muted">
            {supported === false
              ? "Your browser doesn't support speech playback. Try a recent version of Chrome, Edge, Safari or Firefox."
              : "No speech voice is installed on this device. You can add one in your system's language or accessibility settings."}
          </p>
        </div>
      </div>
    );
  }

  const playing = status === "playing";
  const progress = segments.length ? Math.round(((status === "done" ? segments.length : index) / segments.length) * 100) : 0;

  return (
    <div className="rounded-3xl border border-line bg-surface p-4 shadow-lift sm:p-5" aria-label="Read-aloud player" role="region">
      <div className="flex items-center gap-3 sm:gap-4">
        <button
          type="button"
          onClick={playing ? pause : play}
          disabled={supported === null}
          aria-label={playing ? "Pause" : status === "paused" ? "Resume" : "Play"}
          className={cn(
            "grid size-14 shrink-0 place-items-center rounded-full bg-accent text-accent-ink shadow-card transition-transform hover:scale-105 active:scale-95",
            playing && "animate-pulse-ring",
          )}
        >
          {playing ? <Pause className="size-6" fill="currentColor" /> : <Play className="ml-0.5 size-6" fill="currentColor" />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-semibold" aria-live="polite">
            {playing ? (
              <>
                <Equalizer /> Listening…
              </>
            ) : status === "paused" ? (
              "Paused"
            ) : status === "done" ? (
              "Finished"
            ) : (
              <>
                <Volume2 className="size-4 text-accent" aria-hidden /> Press play to hear this lesson
              </>
            )}
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
            <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={restart} aria-label="Restart from the beginning" title="Restart" className="grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink">
            <RotateCcw className="size-4" />
          </button>
          <button type="button" onClick={stop} aria-label="Stop" title="Stop" disabled={status === "idle"} className="grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-40">
            <Square className="size-4" />
          </button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        <div className="flex items-center gap-1" role="group" aria-label="Playback speed">
          {RATES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => changeRate(r)}
              aria-pressed={rate === r}
              className={cn("rounded-full px-2.5 py-1 text-xs font-semibold transition-colors", rate === r ? "bg-ink text-bg" : "text-muted hover:bg-surface-2")}
            >
              {r}×
            </button>
          ))}
        </div>
        <p className="text-xs text-muted">The voice comes from your device, so it varies.</p>
      </div>
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
