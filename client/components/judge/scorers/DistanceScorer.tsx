"use client";

import { useState } from "react";
import type { ScorerProps } from "./types";
import { MissButton } from "./TapButton";

// דיסטנס / Ice Drop — 5 distance zones (zone N → N-1 points) plus two optional
// +0.5 bonuses. The judge arms a bonus, then taps the zone the dog caught in;
// the bonuses apply to that catch and reset. Big targets for fat-finger taps.
const ZONES = [
  { zone: 1, points: 0 },
  { zone: 2, points: 1 },
  { zone: 3, points: 2 },
  { zone: 4, points: 3 },
  { zone: 5, points: 4 },
];

export function DistanceScorer({ heat, onAction, disabled }: ScorerProps) {
  const [jumpBonus, setJumpBonus] = useState(false);
  const [zoneBonus, setZoneBonus] = useState(false);

  // Ice Drop's jump bonus is 2 legs in the air; Distance's is 4.
  const jumpLabel =
    heat.categoryId === "IceDrop" ? "קפיצה 2 רגליים" : "קפיצה 4 רגליים";

  const tapZone = (zone: number) => {
    onAction({ zone, jumpBonus, zoneBonus });
    setJumpBonus(false);
    setZoneBonus(false);
  };

  const tapMiss = () => {
    onAction({ miss: true });
    setJumpBonus(false);
    setZoneBonus(false);
  };

  return (
    <div dir="rtl" className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <BonusToggle
          active={jumpBonus}
          onClick={() => setJumpBonus((v) => !v)}
          label={jumpLabel}
        />
        <BonusToggle
          active={zoneBonus}
          onClick={() => setZoneBonus((v) => !v)}
          label="אזור בונוס"
        />
      </div>

      <div className="grid gap-3">
        {ZONES.map((z) => (
          <button
            key={z.zone}
            type="button"
            disabled={disabled}
            onClick={() => tapZone(z.zone)}
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
    </div>
  );
}

function BonusToggle({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex h-16 flex-col items-center justify-center rounded-2xl border text-sm font-bold transition ${
        active
          ? "border-lime bg-lime text-lime-ink shadow-glow"
          : "border-line bg-surface-2 text-muted"
      }`}
    >
      <span>{label}</span>
      <span className="text-xs opacity-80">+0.5</span>
    </button>
  );
}
