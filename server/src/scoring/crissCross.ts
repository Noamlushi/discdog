import { Discipline } from "../types";
import type { DisciplineScorer, ActionData, ScoreResult } from "./types";
import { formatPoints, num, countMisses } from "./util";

// קריס קרוס (Criss Cross) — rulebook p.26 (scoring confirmed by the owner).
// 4 discs, 60s. Four numbered corner zones thrown in a crossing pattern
// (e.g. 2 → 1 → 4 → 3) plus a central Jackpot. Each numbered zone is worth its
// own number, and a Jackpot catch adds 2:
//   zone 1 = 1 · zone 2 = 2 · zone 3 = 3 · zone 4 = 4
//   Jackpot centre = +2
//
// action: { zone: 1..4, jackpot?: boolean } · misses — { miss: true }

const JACKPOT_BONUS = 2;

export const crissCross: DisciplineScorer = {
  key: Discipline.CrissCross,
  nameHe: "קריס קרוס",
  discs: 4,
  direction: "desc",
  durationSeconds: () => 60,

  score(actions: ActionData[]): ScoreResult {
    let total = 0;
    let catches = 0;
    for (const a of actions) {
      const zone = num(a.zone);
      let scored = false;
      if (zone >= 1 && zone <= 4) {
        total += zone; // zone N = N points
        scored = true;
      }
      if (a.jackpot) {
        total += JACKPOT_BONUS;
        scored = true;
      }
      if (scored) catches += 1;
    }
    const misses = countMisses(actions);
    return {
      value: total,
      display: formatPoints(total),
      breakdown: { catches, misses },
    };
  },
};
