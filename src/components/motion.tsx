"use client";

import { useEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from "react";

// One shared observer for every <Reveal>, instead of one per element.
let observer: IntersectionObserver | null = null;
function getObserver() {
  if (observer || typeof window === "undefined") return observer;
  observer = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        // Also reveal anything already scrolled past (fast flings, End key, anchor jumps),
        // so content can never stay hidden above the viewport.
        if (e.isIntersecting || e.boundingClientRect.bottom < 0) {
          e.target.classList.add("is-visible");
          observer!.unobserve(e.target);
        }
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: [0, 0.12] },
  );
  // Fallback for big jumps where an element never intersects (IO only fires on crossings).
  let frame = 0;
  const sweep = () => {
    frame = 0;
    for (const el of document.querySelectorAll<HTMLElement>(".reveal:not(.is-visible)")) {
      if (el.getBoundingClientRect().top < window.innerHeight) {
        el.classList.add("is-visible");
        observer?.unobserve(el);
      }
    }
  };
  window.addEventListener("scroll", () => (frame ||= requestAnimationFrame(sweep)), { passive: true });
  return observer;
}

/** Fades/slides children in when they scroll into view (respects reduced motion via CSS). */
export function Reveal({
  as: Tag = "div",
  children,
  delay = 0,
  variant = "up",
  className = "",
  ...rest
}: {
  as?: ElementType;
  children: ReactNode;
  delay?: number;
  variant?: "up" | "left" | "right" | "scale";
  className?: string;
  [key: string]: unknown;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    const obs = getObserver();
    if (!el) return;
    if (!obs) {
      el.classList.add("is-visible");
      return;
    }
    obs.observe(el);
    return () => obs.unobserve(el);
  }, []);
  const variantClass = variant === "up" ? "" : `reveal-${variant}`;
  return (
    <Tag ref={ref} className={`reveal ${variantClass} ${className}`} style={{ "--reveal-delay": `${delay}ms` } as CSSProperties} {...rest}>
      {children}
    </Tag>
  );
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Scroll-linked vertical parallax. `speed` > 0 moves slower than the page, < 0 faster. */
export function Parallax({ children, speed = 0.15, className = "" }: { children: ReactNode; speed?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const offset = (rect.top + rect.height / 2 - window.innerHeight / 2) * -speed;
      el.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0)`;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [speed]);
  return (
    <div ref={ref} className={className} style={{ willChange: "transform" }}>
      {children}
    </div>
  );
}

/** Thin bar at the top of the viewport showing how far the reader has scrolled through `targetId`. */
export function ReadingProgress({ targetId }: { targetId: string }) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = document.getElementById(targetId);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = rect.height - window.innerHeight * 0.6;
      const done = Math.min(1, Math.max(0, -rect.top / Math.max(total, 1)));
      setProgress(done);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [targetId]);
  return (
    <div className="fixed inset-x-0 top-0 z-50 h-1 bg-transparent" aria-hidden>
      <div className="h-full origin-left bg-accent transition-transform duration-100" style={{ transform: `scaleX(${progress})` }} />
    </div>
  );
}

/** Returns true once the page has been scrolled past `threshold` px. */
export function useScrolled(threshold = 8) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);
  return scrolled;
}

/** Counts up to `value` when scrolled into view. */
export function CountUp({ value, duration = 1200, suffix = "" }: { value: number; duration?: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) {
      setShown(value);
      return;
    }
    let frame = 0;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - start) / duration);
        setShown(Math.round(value * (1 - Math.pow(1 - p, 3))));
        if (p < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, duration]);
  return (
    <span ref={ref}>
      {shown}
      {suffix}
    </span>
  );
}
