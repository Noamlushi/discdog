"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import type { ScorerProps } from "./types";
import type { ScoreResponse } from "../../../lib/types";
import { MissButton } from "./TapButton";

// דיסטנס / Ice Drop — 5 distance zones (zone N → N-1 points) plus two optional
// +0.5 bonuses (see server scoring/distance.ts).
//
// Flow: one tap logs the throw. Tapping a zone records it immediately with no
// bonus — the common case is a single tap — and the throw then shows up in a
// strip below the zones where the judge can still add "אזור בונוס" and/or the
// jump bonus to it. Adding a bonus amends that same throw (POST /scoring/amend)
// rather than logging a second one, so the timeline stays one row per throw.
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

/** Total actions the server has for this heat (catches + misses). */
function throwCount(score: ScoreResponse | null | undefined): number | null {
  const b = score?.breakdown;
  if (!b) return null;
  return (b.catches ?? 0) + (b.misses ?? 0);
}

/** The throw the bonus strip is attached to — always the last one logged. */
type LastThrow = {
  zone: number;
  points: number;
  jumpBonus: boolean;
  zoneBonus: boolean;
  /** Server throw count when it was logged; a change means it is no longer last. */
  count: number | null;
};

export function DistanceScorer({
  heat,
  onAction,
  onAmendLast,
  disabled,
  score,
}: ScorerProps) {
  const [last, setLast] = useState<LastThrow | null>(null);
  const [busy, setBusy] = useState(false);

  // Ice Drop's jump bonus is 2 legs in the air; Distance's is 4.
  const jumpLabel =
    heat.categoryId === "IceDrop" ? "קפיצה 2 רגליים" : "קפיצה 4 רגליים";

  // Drop the strip once the throw it points at is no longer the last action —
  // e.g. the judge hit the global Undo, or the panel synced another action.
  useEffect(() => {
    if (!last || busy) return;
    const n = throwCount(score);
    if (n !== null && last.count !== null && n !== last.count) setLast(null);
  }, [score, last, busy]);

  const tapZone = async (z: (typeof ZONES)[number]) => {
    setBusy(true);
    try {
      const r = await onAction({
        zone: z.zone,
        jumpBonus: false,
        zoneBonus: false,
      });
      // Only offer bonuses on a throw the server actually accepted.
      setLast(
        r
          ? {
              zone: z.zone,
              points: z.points,
              jumpBonus: false,
              zoneBonus: false,
              count: throwCount(r),
            }
          : null
      );
    } finally {
      setBusy(false);
    }
  };

  // Toggle one of the two bonuses on the throw just logged. Both may apply to
  // the same catch, so these are independent toggles rather than a choice.
  const toggleBonus = async (which: "jump" | "zone") => {
    if (!last || !onAmendLast) return;
    const next = {
      ...last,
      jumpBonus: which === "jump" ? !last.jumpBonus : last.jumpBonus,
      zoneBonus: which === "zone" ? !last.zoneBonus : last.zoneBonus,
    };
    setBusy(true);
    try {
      const r = await onAmendLast({
        zone: next.zone,
        jumpBonus: next.jumpBonus,
        zoneBonus: next.zoneBonus,
      });
      if (r) setLast({ ...next, count: throwCount(r) });
    } finally {
      setBusy(false);
    }
  };

  const tapMiss = async () => {
    setBusy(true);
    try {
      await onAction({ miss: true });
      setLast(null); // a miss can't take a bonus
    } finally {
      setBusy(false);
    }
  };

  const lastTotal = last
    ? last.points + (last.jumpBonus ? BONUS : 0) + (last.zoneBonus ? BONUS : 0)
    : 0;

  return (
    <div dir="rtl" className="space-y-4">
      <div className="grid gap-3">
        {ZONES.map((z) => (
          <button
            key={z.zone}
            type="button"
            disabled={disabled || busy}
            onClick={() => tapZone(z)}
            className="flex h-tap items-center justify-between rounded-2xl border border-line bg-surface px-6 transition active:scale-[0.99] active:bg-lime/10 disabled:opacity-40"
          >
            <span className="text-2xl font-black">אזור {z.zone}</span>
            <span className="rounded-full bg-lime/15 px-4 py-1 font-score text-lg font-bold text-accent">
              {z.points} נק'
            </span>
          </button>
        ))}
      </div>

      {/* Bonus strip for the throw just logged — optional, so a plain catch
          stays a single tap. */}
      {last && onAmendLast && (
        <div className="rounded-2xl border border-lime/30 bg-lime/5 p-3">
          <div className="flex items-center justify-between px-1 pb-2">
            <span className="text-sm font-bold">
              נרשם: אזור {last.zone}
            </span>
            <span className="font-score text-lg font-black text-accent">
              {fmt(lastTotal)} נק'
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <BonusChip
              active={last.zoneBonus}
              disabled={disabled || busy}
              onClick={() => toggleBonus("zone")}
              label="אזור בונוס"
            />
            <BonusChip
              active={last.jumpBonus}
              disabled={disabled || busy}
              onClick={() => toggleBonus("jump")}
              label={jumpLabel}
            />
          </div>
        </div>
      )}

      <MissButton disabled={disabled || busy} onClick={tapMiss} />
    </div>
  );
}

// One bonus toggle on the last throw. Both chips can be on at once (+1 total).
function BonusChip({
  active,
  disabled,
  onClick,
  label,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
      className={`flex h-16 items-center justify-center gap-2 rounded-2xl border text-sm font-black transition active:scale-[0.99] disabled:opacity-40 ${
        active
          ? "border-lime bg-lime text-lime-ink shadow-glow"
          : "border-line bg-surface"
      }`}
    >
      {active && <Check className="h-4 w-4 shrink-0" />}
      <span>{label}</span>
      <span className="text-xs opacity-70">+{fmt(BONUS)}</span>
    </button>
  );
}
