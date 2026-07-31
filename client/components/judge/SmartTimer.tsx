"use client";

import { useEffect, useState } from "react";
import { formatClock } from "../../lib/disciplines";

// §6.2 — resilient run timer. Elapsed time is derived from an epoch start
// (`startedAt`), so it stays correct across re-renders, navigation, and remounts
// rather than counting ticks that can drift or reset.
export function SmartTimer({
  startedAt,
  countdownSeconds,
}: {
  startedAt: number;
  /** When set, counts down from this many seconds instead of counting up. */
  countdownSeconds?: number;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const elapsed = Math.max(0, (now - startedAt) / 1000);
  const isCountdown = countdownSeconds !== undefined;
  const remaining = isCountdown
    ? Math.max(0, countdownSeconds - elapsed)
    : 0;
  const expired = isCountdown && remaining <= 0;

  return (
    <div
      className={`font-score text-6xl font-bold tabular-nums ${
        expired ? "text-danger" : "text-accent"
      }`}
      role="timer"
      aria-live="off"
    >
      {formatClock(isCountdown ? remaining : elapsed)}
    </div>
  );
}

/** Seconds elapsed since an epoch start — used for action timestamps. */
export function elapsedSince(startedAt: number | null): number {
  if (!startedAt) return 0;
  return Math.max(0, (Date.now() - startedAt) / 1000);
}
