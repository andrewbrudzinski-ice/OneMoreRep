import { useCallback, useEffect, useRef, useState } from 'react';

export interface RestTimer {
  /** Remaining seconds (0 when idle/finished). */
  remaining: number;
  /** Total for the current countdown (for progress display). */
  total: number;
  running: boolean;
  active: boolean;
  start: (seconds: number) => void;
  pause: () => void;
  resume: () => void;
  addTime: (seconds: number) => void;
  skip: () => void;
}

function gentleBuzz() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate?.([120, 60, 120]);
    } catch {
      // ignore
    }
  }
}

/**
 * Non-blocking rest timer: auto-start on set completion, with Pause / +30s /
 * Skip. A gentle vibrate fires at zero (respecting the device's silent mode
 * via the Vibration API). Keep logging while it runs.
 *
 * The countdown is derived from a target **end timestamp**, not a tick counter,
 * so it stays correct across background/suspend: phones freeze `setInterval`
 * when the app is swiped away, but on return we recompute from the wall clock —
 * showing the right remaining time and firing the buzz if it already elapsed.
 * (Alerting you *while* the app is backgrounded still isn't possible on a local
 * web app — that needs server push.)
 */
export function useRestTimer(): RestTimer {
  const [remaining, setRemaining] = useState(0);
  const [total, setTotal] = useState(0);
  const [running, setRunning] = useState(false);
  const [active, setActive] = useState(false);
  const endAtRef = useRef<number | null>(null);
  const buzzedRef = useRef(false);

  // Recompute `remaining` from the target end time; buzz + stop once it hits 0.
  const sync = useCallback(() => {
    const endAt = endAtRef.current;
    if (endAt === null) return;
    const secs = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
    setRemaining(secs);
    if (secs <= 0) {
      endAtRef.current = null;
      setRunning(false);
      if (!buzzedRef.current) {
        buzzedRef.current = true;
        gentleBuzz();
      }
    }
  }, []);

  useEffect(() => {
    if (!running) return;
    sync(); // immediate, so returning to the app corrects instantly
    const interval = setInterval(sync, 250);
    const onVisible = () => {
      if (document.visibilityState === 'visible') sync();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [running, sync]);

  const start = useCallback((seconds: number) => {
    if (seconds <= 0) return;
    buzzedRef.current = false;
    endAtRef.current = Date.now() + seconds * 1000;
    setTotal(seconds);
    setRemaining(seconds);
    setActive(true);
    setRunning(true);
  }, []);

  const pause = useCallback(() => {
    const endAt = endAtRef.current;
    if (endAt !== null) {
      // Freeze at the exact remaining, not the last-rendered value.
      setRemaining(Math.max(0, Math.ceil((endAt - Date.now()) / 1000)));
    }
    endAtRef.current = null;
    setRunning(false);
  }, []);

  const resume = useCallback(() => {
    if (remaining > 0) {
      endAtRef.current = Date.now() + remaining * 1000;
      setRunning(true);
    }
  }, [remaining]);

  const addTime = useCallback(
    (seconds: number) => {
      buzzedRef.current = false;
      const next = Math.max(0, remaining + seconds);
      setTotal((t) => t + seconds);
      setRemaining(next);
      setActive(true);
      if (next > 0) {
        // Extend (or restart, if it had finished) toward the new end time.
        endAtRef.current = Date.now() + next * 1000;
        setRunning(true);
      }
    },
    [remaining],
  );

  const skip = useCallback(() => {
    endAtRef.current = null;
    setRunning(false);
    setActive(false);
    setRemaining(0);
    setTotal(0);
  }, []);

  return { remaining, total, running, active, start, pause, resume, addTime, skip };
}
