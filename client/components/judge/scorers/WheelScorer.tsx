"use client";

import type { ScorerProps } from "./types";
import { TapButton, MissButton } from "./TapButton";

// גלגל המזל (Wheel of Fortune) — rulebook p.20 / server scoring/wheelOfFortune.ts.
// 1 disc, 60s. Four throws from points at increasing distance; one leg inside an
// area scores the higher value. Outer square = 5, inner square = 10. A miss is
// logged too so the action log mirrors the four throws.
//
// action: { area: "outer" | "inner" } | { miss: true }
export function WheelScorer({ onAction, disabled }: ScorerProps) {
  return (
    <div dir="rtl" className="space-y-3">
      <TapButton
        label="ריבוע פנימי"
        hint="רגל אחת בריבוע הקטן"
        points="10 נק'"
        tone="live"
        disabled={disabled}
        onClick={() => onAction({ area: "inner" })}
      />
      <TapButton
        label="ריבוע חיצוני"
        hint="רגל אחת בריבוע הגדול"
        points="5 נק'"
        tone="nav"
        disabled={disabled}
        onClick={() => onAction({ area: "outer" })}
      />
      <MissButton disabled={disabled} onClick={() => onAction({ miss: true })} />
    </div>
  );
}
