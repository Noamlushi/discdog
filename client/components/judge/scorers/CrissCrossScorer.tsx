"use client";

import type { ScorerProps } from "./types";
import { TapButton, MissButton } from "./TapButton";

// קריס קרוס (Criss Cross) — rulebook p.26 / server scoring/crissCross.ts.
// 4 discs, 60s. Four numbered corner zones thrown in a crossing pattern
// (2 → 1 → 4 → 3); each zone scores its own number, plus a central Jackpot +2.
//
// action: { zone: 1..4 } | { jackpot: true }
const ZONES = [4, 3, 2, 1]; // highest value first — easiest to reach for the thumb
export function CrissCrossScorer({ onAction, disabled }: ScorerProps) {
  return (
    <div dir="rtl" className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {ZONES.map((zone) => (
          <button
            key={zone}
            type="button"
            disabled={disabled}
            onClick={() => onAction({ zone })}
            className="flex h-24 flex-col items-center justify-center rounded-2xl border border-line bg-surface transition active:scale-[0.99] active:bg-lime/10 disabled:opacity-40"
          >
            <span className="text-3xl font-black">אזור {zone}</span>
            <span className="font-score text-sm text-accent">{zone} נק'</span>
          </button>
        ))}
      </div>
      <TapButton
        label="ג'קפוט"
        hint="תפיסה במרכז"
        points="+2 נק'"
        tone="live"
        disabled={disabled}
        onClick={() => onAction({ jackpot: true })}
      />
      <MissButton disabled={disabled} onClick={() => onAction({ miss: true })} />
    </div>
  );
}
