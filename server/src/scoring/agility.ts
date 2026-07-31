import { Discipline } from "../types";
import type { DisciplineScorer, ActionData, ScoreResult } from "./types";
import { formatPoints, countMisses } from "./util";

// פריזג'יליטי (Frisbee Agility) — rulebook p.18.
// 1 disc, 60s. The dog clears obstacles (hurdles / tunnel) and catches in zones:
//   obstacle cleared                 = 5
//   catch in first zone  (red)       = 3
//   catch in second zone (cyan)      = 10
//   catch in Jackpot centre          = +10
//
// Dogs under 35cm have the hurdle bar lowered (§3.3 / Dog.isUnder35cm) — that
// is an equipment alert, not a scoring change.
//
// action:
//   { type: "obstacle" }
//   { type: "catch", zone: "red" | "cyan" | "jackpot" }
//   { miss: true }   — a dropped catch

const OBSTACLE_POINTS = 5;
const CATCH_POINTS: Record<string, number> = { red: 3, cyan: 10, jackpot: 10 };

export const agility: DisciplineScorer = {
  key: Discipline.Agility,
  nameHe: "פריזג'יליטי",
  discs: 1,
  direction: "desc",
  durationSeconds: () => 60,

  score(actions: ActionData[]): ScoreResult {
    let total = 0;
    let catches = 0;
    let obstacles = 0;
    for (const a of actions) {
      if (a.type === "obstacle") {
        total += OBSTACLE_POINTS;
        obstacles += 1;
      } else if (a.type === "catch") {
        total += CATCH_POINTS[String(a.zone)] ?? 0;
        catches += 1;
      }
    }
    const misses = countMisses(actions);
    return {
      value: total,
      display: formatPoints(total),
      breakdown: { catches, misses, obstacles },
    };
  },
};
