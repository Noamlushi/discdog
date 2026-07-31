"use client";

import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import { formatClock } from "../../lib/disciplines";

// Spectator-facing run clock for a live heat. Counts down the remaining run
// time from the server-stamped `liveStartedAt`, so it stays accurate across
// reloads and late joins (§3.4). Turns amber in the last 15s, red at 0.
export function LiveCountdown({
  liveStartedAt,
  durationSeconds,
}: {
  liveStartedAt: string | null | undefined;
  durationSeconds: number;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!liveStartedAt) {
    return (
      <span className="inline-flex items-center gap-1 font-score text-2xl font-bold tabular-nums text-muted">
        <Timer className="h-5 w-5" />
        {formatClock(durationSeconds)}
      </span>
    );
  }

  const elapsed = (now - new Date(liveStartedAt).getTime()) / 1000;
  const left = durationSeconds - elapsed;
  const tone =
    left <= 0 ? "text-danger" : left <= 15 ? "text-gold" : "text-ink";

  return (
    <span
      className={`inline-flex items-center gap-1 font-score text-2xl font-bold tabular-nums ${tone}`}
    >
      <Timer className="h-5 w-5" />
      {left <= 0 ? "נגמר" : formatClock(left)}
    </span>
  );
}
