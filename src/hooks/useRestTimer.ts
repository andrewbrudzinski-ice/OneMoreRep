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
 */
export function useRestTimer(): RestTimer {
  const [remaining, setRemaining] = useState(0);
  const [total, setTotal] = useState(0);
  const [running, setRunning] = useState(false);
  const [active, setActive] = useState(false);
  const buzzedRef = useRef(false);

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          if (!buzzedRef.current) {
            buzzedRef.current = true;
            gentleBuzz();
          }
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [running]);

  // Stop running once it hits zero.
  useEffect(() => {
    if (active && remaining === 0 && running) {
      setRunning(false);
    }
  }, [remaining, running, active]);

  const start = useCallback((seconds: number) => {
    if (seconds <= 0) return;
    buzzedRef.current = false;
    setTotal(seconds);
    setRemaining(seconds);
    setActive(true);
    setRunning(true);
  }, []);

  const pause = useCallback(() => setRunning(false), []);
  const resume = useCallback(() => {
    if (remaining > 0) setRunning(true);
  }, [remaining]);

  const addTime = useCallback((seconds: number) => {
    setRemaining((r) => r + seconds);
    setTotal((t) => t + seconds);
    setActive(true);
  }, []);

  const skip = useCallback(() => {
    setRunning(false);
    setActive(false);
    setRemaining(0);
    setTotal(0);
  }, []);

  return { remaining, total, running, active, start, pause, resume, addTime, skip };
}
