import { Discipline } from "../types";
import type { DisciplineScorer, ActionData, ScoreResult } from "./types";
import { formatPoints, num, countMisses } from "./util";

// דיסטנס (Distance) — rulebook p.13.
// 1 disc, 90s. The field is split into 5 distance zones. A team may make more
// than 5 throws; only their **best 5** throw values count, capped at 25 points.
//   zone 1 = 0 · zone 2 = 1 · zone 3 = 2 · zone 4 = 3 · zone 5 = 4
//   +0.5 for a catch jumped with all 4 legs in the air
//   +0.5 for a catch in the bonus (central) zone
//
// action: { zone: 1..5, jumpBonus?: boolean, zoneBonus?: boolean }

const ZONE_POINTS: Record<number, number> = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4 };
const COUNTED_THROWS = 5;
const MAX_SCORE = 25;

/** How many throws count toward the score — exported for the league export sheets. */
export const DISTANCE_COUNTED_THROWS = COUNTED_THROWS;

/** Points for a single throw — zone value plus the two optional +0.5 bonuses. */
export function throwValue(a: ActionData): number {
  let v = ZONE_POINTS[num(a.zone)] ?? 0;
  if (a.jumpBonus) v += 0.5;
  if (a.zoneBonus) v += 0.5;
  return v;
}

export const distance: DisciplineScorer = {
  key: Discipline.Distance,
  nameHe: "דיסטנס",
  discs: 1,
  direction: "desc",
  durationSeconds: () => 90,

  score(actions: ActionData[]): ScoreResult {
    // Keep the highest 5 throw values — not the first 5.
    const best = actions
      .map(throwValue)
      .sort((x, y) => y - x)
      .slice(0, COUNTED_THROWS);
    const total = Math.min(
      best.reduce((sum, v) => sum + v, 0),
      MAX_SCORE
    );
    const misses = countMisses(actions);
    const catches = actions.length - misses;
    return {
      value: total,
      display: formatPoints(total),
      breakdown: { catches, misses },
    };
  },
};
