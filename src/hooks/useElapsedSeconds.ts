import { useEffect, useState } from 'react';

/** Seconds elapsed since `startISO`, ticking every second. */
export function useElapsedSeconds(startISO: string | null | undefined): number {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!startISO) {
      setSeconds(0);
      return;
    }
    const start = new Date(startISO).getTime();
    const tick = () => setSeconds(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startISO]);

  return seconds;
}

/** Format seconds as m:ss or h:mm:ss. */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}
