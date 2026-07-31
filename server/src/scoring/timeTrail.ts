import { Discipline } from "../types";
import type { DisciplineScorer, ActionData, ScoreResult } from "./types";
import { formatTime, num, countMisses } from "./util";

// Time Trail — rulebook pp.27–28.
// 1 disc, 60s max. Land 2 catches beyond the 18m line in the fastest time.
// Knockout finals carry 16 teams (§7.2). Ranked by completion time (lower wins).
//
// action:
//   { type: "catch" }                              // a catch beyond the 18m line
//   { completed: true, elapsedSeconds: number }    // timer stop on the 2nd catch

export const TIMETRAIL_FINALS_TEAMS = 16;
const REQUIRED_CATCHES = 2;

export const timeTrail: DisciplineScorer = {
  key: Discipline.TimeTrail,
  nameHe: "Time Trail",
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
