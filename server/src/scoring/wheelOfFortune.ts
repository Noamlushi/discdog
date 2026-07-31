import { Discipline } from "../types";
import type { DisciplineScorer, ActionData, ScoreResult } from "./types";
import { formatPoints, countMisses } from "./util";

// גלגל המזל (Wheel of Fortune) — rulebook p.20 (scoring confirmed by the owner).
// 1 disc, 60s. Two nested target squares at the field centre, thrown from 4
// throw points at varying distances (move to the next point after every throw,
// caught or not). Score favours the dog — one leg inside the area earns the
// higher of the two values:
//   outer (large square)  = 5
//   inner (small square)  = 10
//
// action: { area: "outer" | "inner" } · misses — { miss: true }

const AREA_POINTS: Record<string, number> = { outer: 5, inner: 10 };

export const wheelOfFortune: DisciplineScorer = {
  key: Discipline.WheelOfFortune,
  nameHe: "גלגל המזל",
  discs: 1,
  direction: "desc",
  durationSeconds: () => 60,

  score(actions: ActionData[]): ScoreResult {
    let total = 0;
    let catches = 0;
    for (const a of actions) {
      const pts = AREA_POINTS[String(a.area)] ?? 0;
      if (pts > 0) catches += 1;
      total += pts;
    }
    const misses = countMisses(actions);
    return {
      value: total,
      display: formatPoints(total),
      breakdown: { catches, misses },
    };
  },
};
