import { Discipline } from "../types";
import type { DisciplineScorer, ActionData, ScoreResult } from "./types";
import { formatTime, num, countMisses } from "./util";

// מולטיפול צ'אלנג' (Multiple Challenge) — rulebook pp.15–16.
// 4 discs, 60s. The team must land 4 catches in strict zone order
// (cyan → red → purple → Jackpot centre) and finish as fast as possible behind
// the throw line. Ranked by completion time (lower is better).
//
// action:
//   { type: "catch", zone: 1..4 }                       // progress
//   { completed: true, elapsedSeconds: number }         // timer stop on finish

const REQUIRED_CATCHES = 4;

export const multipleChallenge: DisciplineScorer = {
  key: Discipline.MultipleChallenge,
  nameHe: "מולטיפול צ'אלנג'",
  discs: 4,
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
    // Not yet finished — ranks last among timed runs until completion.
    return {
      value: Number.POSITIVE_INFINITY,
      display: `${catches}/${REQUIRED_CATCHES}`,
      breakdown: { catches, misses },
    };
  },
};
