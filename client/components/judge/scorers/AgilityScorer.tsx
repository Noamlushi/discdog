"use client";

import type { ScorerProps } from "./types";
import { TapButton, MissButton } from "./TapButton";

// פריזג'יליטי (Frisbee Agility) — rulebook p.18 / server scoring/agility.ts.
// 1 disc, 60s. Obstacle cleared = 5, catch in red zone = 3, cyan zone = 10,
// Jackpot centre = +10. Dogs under 35cm just get a lowered hurdle bar — an
// equipment note for the judge, not a scoring change.
//
// action: { type: "obstacle" } | { type: "catch", zone: "red"|"cyan"|"jackpot" }
export function AgilityScorer({ onAction, disabled }: ScorerProps) {
  return (
    <div dir="rtl" className="space-y-3">
      <TapButton
        label="מכשול"
        hint="משוכה / מנהרה שעבר"
        points="+5 נק'"
        tone="nav"
        disabled={disabled}
        onClick={() => onAction({ type: "obstacle" })}
      />
      <TapButton
        label="תפיסה — ציאן"
        hint="אזור שני"
        points="+10 נק'"
        tone="live"
        disabled={disabled}
        onClick={() => onAction({ type: "catch", zone: "cyan" })}
      />
      <TapButton
        label="תפיסה — אדום"
        hint="אזור ראשון"
        points="+3 נק'"
        disabled={disabled}
        onClick={() => onAction({ type: "catch", zone: "red" })}
      />
      <TapButton
        label="ג'קפוט"
        hint="תפיסה במרכז"
        points="+10 נק'"
        tone="live"
        disabled={disabled}
        onClick={() => onAction({ type: "catch", zone: "jackpot" })}
      />
      <MissButton disabled={disabled} onClick={() => onAction({ miss: true })} />
    </div>
  );
}
