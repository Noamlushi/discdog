import { Discipline } from "../types";
import type { DisciplineScorer, ActionData, ScoreResult } from "./types";
import { formatTime, num, countMisses } from "./util";

// J'Trail — rulebook pp.21–23.
// 1 disc, 60s. Two stages:
//   • Preliminaries — land 3 catches beyond the 20m line in the fastest time.
//   • Tournament    — top 8 teams advance to a knockout bracket (§7.2).
// Ranked by completion time (lower is better).
//
// action:
//   { type: "catch" }                              // a catch beyond the 20m line
//   { completed: true, elapsedSeconds: number }    // timer stop on the 3rd catch

export const JTRAIL_FINALS_TEAMS = 8;
const REQUIRED_CATCHES = 3;

export const jTrail: DisciplineScorer = {
  key: Discipline.JTrail,
  nameHe: "J'Trail",
  discs: 1,
  direction: "asc",
  durationSeconds: () => 60,

  score(actions: ActionData[]): ScoreResult {
    const catches = actions.filter((a) => a.type === "catch").length;
    const misses = countMisses(actions);
    const completion = [...actions].reverse().find((a) => a.completed);

    if (completion) {
      const seconds = num(completion.elapsedSeconds);
      return {
        value: seconds,
        display: formatTime(seconds),
        breakdown: { catches, misses, seconds },
      };
    }
    return {
      value: Number.POSITIVE_INFINITY,
      display: `${catches}/${REQUIRED_CATCHES}`,
      breakdown: { catches, misses },
    };
  },
};
