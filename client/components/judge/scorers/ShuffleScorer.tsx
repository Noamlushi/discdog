"use client";

import { Plus } from "lucide-react";
import type { ScorerProps } from "./types";
import { MissButton } from "./TapButton";

// שאפל ב-30 (Shuffle in 30) — rulebook p.24 / server scoring/shuffle.ts.
// 2 discs, 30s. Pure volume: 1 point per catch. The judge just hammers one big
// button for every catch; the running total lives on the scoring page.
//
// action: { caught: true } | { miss: true }
export function ShuffleScorer({ onAction, disabled }: ScorerProps) {
  return (
    <div dir="rtl" className="space-y-3">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onAction({ caught: true })}
        className="flex h-40 w-full flex-col items-center justify-center gap-2 rounded-3xl bg-lime text-lime-ink shadow-glow transition active:scale-[0.99] disabled:opacity-40"
      >
        <Plus className="h-12 w-12" />
        <span className="text-3xl font-black">תפיסה</span>
        <span className="text-sm opacity-80">נקודה אחת לכל תפיסה</span>
      </button>
      <MissButton disabled={disabled} onClick={() => onAction({ miss: true })} />
      <p className="text-center text-sm text-muted">
        הקש על כל תפיסה תוך 30 שניות. טעות? Undo בפינה.
      </p>
    </div>
  );
}
