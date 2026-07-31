import { Discipline } from "../types";
import type { DisciplineScorer, ActionData, ScoreResult } from "./types";
import { formatPoints, num, countMisses } from "./util";

// Ice Drop — rulebook p.9.
// 1 disc, 90s. Same 5-zone structure as Distance, but the field is shaped like
// frozen drop positions and the jump bonus is for 2 legs in the air.
//   zone 1 = 0 · zone 2 = 1 · zone 3 = 2 · zone 4 = 3 · zone 5 = 4
//   +0.5 for a catch jumped with 2 legs in the air
//   +0.5 for a catch in the bonus zone
//   the best 5 throws counted (not the first 5), capped at 25.
//
// action: { zone: 1..5, jumpBonus?: boolean, zoneBonus?: boolean }

const ZONE_POINTS: Record<number, number> = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4 };
const COUNTED_THROWS = 5;
const MAX_SCORE = 25;

/** Points for a single throw — zone value plus the two optional +0.5 bonuses. */
function throwValue(a: ActionData): number {
  let v = ZONE_POINTS[num(a.zone)] ?? 0;
  if (a.jumpBonus) v += 0.5;
  if (a.zoneBonus) v += 0.5;
  return v;
}

export const iceDrop: DisciplineScorer = {
  key: Discipline.IceDrop,
  nameHe: "Ice Drop",
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
