import { useEffect, useState } from 'react';

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * One shared 0→1 animation pass for a screen. Every metric on the screen
 * multiplies its final value by this progress so the counting numbers and the
 * bars fill in step (spec: 620ms rAF pass with easeOutCubic). Replays whenever
 * `key` changes — e.g. a data reload — so fresh data counts up again.
 *
 * Respects `prefers-reduced-motion: reduce` by jumping straight to 1 (no count).
 * The lower clamp on `p` matters: the first rAF timestamp can precede the
 * captured start, and a negative `p` would render negative metrics.
 */
export function useAnimationProgress(key: unknown, durationMs = 620): number {
  const [progress, setProgress] = useState(() => (prefersReducedMotion() ? 1 : 0));

  useEffect(() => {
    if (prefersReducedMotion()) {
      setProgress(1);
      return;
    }

    let raf = 0;
    let start = 0;
    setProgress(0);

    const tick = (t: number) => {
      if (start === 0) start = t;
      const raw = Math.max(0, Math.min(1, (t - start) / durationMs));
      // easeOutCubic
      setProgress(1 - Math.pow(1 - raw, 3));
      if (raw < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [key, durationMs]);

  return progress;
}
