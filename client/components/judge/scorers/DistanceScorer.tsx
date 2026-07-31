"use client";

import { useCallback, useEffect, useState } from "react";
import type { ScorerProps } from "./types";
import { MissButton } from "./TapButton";

// דיסטנס / Ice Drop — 5 distance zones (zone N → N-1 points) plus two optional
// +0.5 bonuses (see server scoring/distance.ts). Flow: the judge taps the zone
// the dog caught in **first**, then a sheet asks which bonus applied — bonus
// zone, legs in the air, both, or none. One tap per step, big fat-finger targets.
const ZONES = [
  { zone: 1, points: 0 },
  { zone: 2, points: 1 },
  { zone: 3, points: 2 },
  { zone: 4, points: 3 },
  { zone: 5, points: 4 },
];

const BONUS = 0.5;

/** "2" / "2.5" — drop the trailing .0 so the pills stay short. */
function fmt(v: number) {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

export function DistanceScorer({ heat, onAction, disabled }: ScorerProps) {
  // The zone awaiting its bonus answer; null = no sheet open.
  const [pending, setPending] = useState<(typeof ZONES)[number] | null>(null);

  // Ice Drop's jump bonus is 2 legs in the air; Distance's is 4.
  const jumpLabel =
    heat.categoryId === "IceDrop" ? "קפיצה 2 רגליים" : "קפיצה 4 רגליים";

  const close = useCallback(() => setPending(null), []);

  const commit = (zone: number, jumpBonus: boolean, zoneBonus: boolean) => {
    onAction({ zone, jumpBonus, zoneBonus });
    close();
  };

  const tapMiss = () => {
    onAction({ miss: true });
    close();
  };

  // Esc cancels the sheet without logging a throw.
  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, close]);

  return (
    <div dir="rtl" className="space-y-4">
      <div className="grid gap-3">
        {ZONES.map((z) => (
          <button
            key={z.zone}
            type="button"
            disabled={disabled}
            onClick={() => setPending(z)}
            className="flex h-tap items-center justify-between rounded-2xl border border-line bg-surface px-6 transition active:scale-[0.99] active:bg-lime/10 disabled:opacity-40"
          >
            <span className="text-2xl font-black">אזור {z.zone}</span>
            <span className="rounded-full bg-lime/15 px-4 py-1 font-score text-lg font-bold text-accent">
              {z.points} נק'
            </span>
          </button>
        ))}
      </div>

      <MissButton disabled={disabled} onClick={tapMiss} />

      {pending && (
        <BonusSheet
          zone={pending.zone}
          points={pending.points}
          jumpLabel={jumpLabel}
          disabled={disabled}
          onPick={(jumpBonus, zoneBonus) =>
            commit(pending.zone, jumpBonus, zoneBonus)
          }
          onCancel={close}
        />
      )}
    </div>
  );
}

// Bonus step — opens right after a zone tap. Every option logs the throw in a
// single tap, so a catch is never more than two taps away.
function BonusSheet({
  zone,
  points,
  jumpLabel,
  disabled,
  onPick,
  onCancel,
}: {
  zone: number;
  points: number;
  jumpLabel: string;
  disabled?: boolean;
  onPick: (jumpBonus: boolean, zoneBonus: boolean) => void;
  onCancel: () => void;
}) {
  const options = [
    {
      key: "none",
      label: "ללא בונוס",
      jumpBonus: false,
      zoneBonus: false,
      total: points,
    },
    {
      key: "zone",
      label: "אזור בונוס",
      jumpBonus: false,
      zoneBonus: true,
      total: points + BONUS,
    },
    {
      key: "jump",
      label: jumpLabel,
      jumpBonus: true,
      zoneBonus: false,
      total: points + BONUS,
    },
    {
      key: "both",
      label: `אזור בונוס + ${jumpLabel}`,
      jumpBonus: true,
      zoneBonus: true,
      total: points + BONUS * 2,
    },
  ];

  return (
    <div
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-label={`בונוס לאזור ${zone}`}
      onClick={onCancel}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md space-y-3 rounded-3xl border border-line bg-surface-2 p-4 shadow-soft"
      >
        <div className="flex items-center justify-between px-2">
          <span className="text-xl font-black">אזור {zone}</span>
          <span className="text-sm text-muted">בחר בונוס</span>
        </div>

        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            disabled={disabled}
            onClick={() => onPick(o.jumpBonus, o.zoneBonus)}
            className="flex h-tap w-full items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-5 text-start transition active:scale-[0.99] active:bg-lime/10 disabled:opacity-40"
          >
            <span className="text-lg font-black">{o.label}</span>
            <span className="shrink-0 rounded-full bg-lime/15 px-4 py-1 font-score text-lg font-bold text-accent">
              {fmt(o.total)} נק'
            </span>
          </button>
        ))}

        <button
          type="button"
          onClick={onCancel}
          className="h-14 w-full rounded-2xl border border-line bg-surface-2 text-base font-bold text-muted transition active:scale-[0.99]"
        >
          ביטול
        </button>
      </div>
    </div>
  );
}
