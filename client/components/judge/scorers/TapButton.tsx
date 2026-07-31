"use client";

import type { ReactNode } from "react";
import { XCircle } from "lucide-react";

// Shared oversized tap target for the discipline scorers — big enough for
// fat-finger taps on a phone in the sun (§3.3 / §8.2). A label on the right and
// an optional points pill on the left, mirroring DistanceScorer's zone rows.
export function TapButton({
  label,
  hint,
  points,
  tone = "neutral",
  disabled,
  onClick,
}: {
  label: ReactNode;
  hint?: string;
  /** Optional pill text, e.g. "+5 נק'". */
  points?: string;
  tone?: "neutral" | "live" | "nav";
  disabled?: boolean;
  onClick: () => void;
}) {
  const toneCls =
    tone === "live"
      ? "border-lime/30 bg-lime/10 active:bg-lime/20"
      : tone === "nav"
        ? "border-accent/30 bg-accent/10 active:bg-accent/20"
        : "border-line bg-surface active:bg-lime/10";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex h-tap items-center justify-between rounded-2xl border px-6 transition active:scale-[0.99] disabled:opacity-40 ${toneCls}`}
    >
      <span className="flex flex-col items-start">
        <span className="text-2xl font-black">{label}</span>
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </span>
      {points && (
        <span className="rounded-full bg-lime/15 px-4 py-1 font-score text-lg font-bold text-accent">
          {points}
        </span>
      )}
    </button>
  );
}

// Shared "miss" button — logs a failed attempt ({ miss: true }) so the team can
// review their catch ratio afterwards. Scores nothing; styled apart from the
// scoring buttons so it isn't tapped by accident.
export function MissButton({
  disabled,
  onClick,
}: {
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex h-16 w-full items-center justify-center gap-2 rounded-2xl border border-danger/40 bg-danger/10 text-lg font-black text-danger transition active:scale-[0.99] active:bg-danger/20 disabled:opacity-40"
    >
      <XCircle className="h-5 w-5" />
      החטאה
    </button>
  );
}
