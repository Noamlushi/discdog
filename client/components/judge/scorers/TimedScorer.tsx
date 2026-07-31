"use client";

import { Check, Hand } from "lucide-react";
import type { ScorerProps } from "./types";
import { MissButton } from "./TapButton";

// Timed disciplines — Multiple Challenge, J'Trail, Time Trail. Ranked by
// completion time (lower wins); the clock is stopped by the page's "סיים מקצה"
// button, which posts { completed, elapsedSeconds }. This scorer only logs the
// catches that make up the required sequence.
//
// action: { type: "catch", zone? }   (zone only for Multiple Challenge's order)
//
// Catch count is read from the server score breakdown so Undo and reloads stay
// correct rather than tracking a local counter.

// Multiple Challenge — 4 discs, strict zone order (rulebook pp.15–16).
const MC_SEQUENCE = [
  { zone: 1, nameHe: "ציאן", color: "bg-cyan-400" },
  { zone: 2, nameHe: "אדום", color: "bg-red-500" },
  { zone: 3, nameHe: "סגול", color: "bg-purple-500" },
  { zone: 4, nameHe: "ג'קפוט", color: "bg-amber-400" },
];

// Required catches for the trail disciplines.
const TRAIL_REQUIRED: Record<string, { count: number; lineHe: string }> = {
  JTrail: { count: 3, lineHe: "מעבר לקו ה-20 מ'" },
  TimeTrail: { count: 2, lineHe: "מעבר לקו ה-18 מ'" },
};

export function TimedScorer({ heat, onAction, disabled, score }: ScorerProps) {
  const catches = Number(score?.breakdown?.catches ?? 0);

  if (heat.categoryId === "MultipleChallenge") {
    return (
      <MultipleChallenge catches={catches} onAction={onAction} disabled={disabled} />
    );
  }

  const cfg = TRAIL_REQUIRED[heat.categoryId] ?? { count: 0, lineHe: "" };
  return (
    <TrailCatch
      catches={catches}
      required={cfg.count}
      lineHe={cfg.lineHe}
      onAction={onAction}
      disabled={disabled}
    />
  );
}

function MultipleChallenge({
  catches,
  onAction,
  disabled,
}: {
  catches: number;
  onAction: ScorerProps["onAction"];
  disabled?: boolean;
}) {
  const done = catches >= MC_SEQUENCE.length;
  return (
    <div dir="rtl" className="space-y-3">
      <p className="text-center text-sm text-muted">
        תפוס לפי הסדר. השעון נעצר בלחיצה על “סיים מקצה”.
      </p>
      {MC_SEQUENCE.map((step, i) => {
        const caught = i < catches;
        const isNext = i === catches;
        return (
          <button
            key={step.zone}
            type="button"
            disabled={disabled || !isNext}
            onClick={() => onAction({ type: "catch", zone: step.zone })}
            className={`flex h-tap w-full items-center justify-between rounded-2xl border px-5 transition active:scale-[0.99] ${
              caught
                ? "border-lime/40 bg-lime/15"
                : isNext
                  ? "border-accent bg-surface active:bg-lime/10"
                  : "border-line bg-surface-2 opacity-50"
            }`}
          >
            <span className="flex items-center gap-3">
              <span className={`h-6 w-6 rounded-full ${step.color}`} />
              <span className="text-xl font-bold">
                {i + 1}. {step.nameHe}
              </span>
            </span>
            {caught && <Check className="h-6 w-6 text-accent" />}
          </button>
        );
      })}
      {done && (
        <p className="rounded-xl bg-lime/10 p-3 text-center text-sm font-bold text-accent">
          הרצף הושלם — הקש “סיים מקצה” לעצירת השעון.
        </p>
      )}
      <MissButton disabled={disabled} onClick={() => onAction({ miss: true })} />
    </div>
  );
}

function TrailCatch({
  catches,
  required,
  lineHe,
  onAction,
  disabled,
}: {
  catches: number;
  required: number;
  lineHe: string;
  onAction: ScorerProps["onAction"];
  disabled?: boolean;
}) {
  const done = required > 0 && catches >= required;
  return (
    <div dir="rtl" className="space-y-4">
      <div className="flex items-center justify-center gap-2">
        {Array.from({ length: required }, (_, i) => (
          <span
            key={i}
            className={`h-4 w-12 rounded-full ${
              i < catches ? "bg-lime" : "bg-surface-2"
            }`}
          />
        ))}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onAction({ type: "catch" })}
        className="flex h-40 w-full flex-col items-center justify-center gap-2 rounded-3xl bg-lime text-lime-ink shadow-glow transition active:scale-[0.99] disabled:opacity-40"
      >
        <Hand className="h-12 w-12" />
        <span className="text-3xl font-black">תפיסה</span>
        <span className="text-sm opacity-80">{lineHe}</span>
      </button>
      <p className="text-center text-sm text-muted">
        {done
          ? `${required} תפיסות — הקש “סיים מקצה” לעצירת השעון.`
          : `${catches}/${required} תפיסות`}
      </p>
      <MissButton disabled={disabled} onClick={() => onAction({ miss: true })} />
    </div>
  );
}
