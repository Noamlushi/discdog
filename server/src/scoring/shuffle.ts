import { Discipline } from "../types";
import type { DisciplineScorer, ActionData, ScoreResult } from "./types";
import { formatPoints, countMisses } from "./util";

// שאפל ב-30 (Shuffle in 30) — rulebook p.24.
// 2 discs, 30s. Pure volume: every successful catch is worth 1 point; the score
// is simply how many catches the team landed in the window. Highest wins.
//
// action: one entry per successful catch — { caught: true } · misses — { miss: true }

export const shuffle: DisciplineScorer = {
  key: Discipline.Shuffle,
  nameHe: "שאפל ב-30",
  discs: 2,
  direction: "desc",
  durationSeconds: () => 30,

  score(actions: ActionData[]): ScoreResult {
    const catches = actions.filter((a) => a.caught === true).length;
    const misses = countMisses(actions);
    return {
      value: catches,
      display: formatPoints(catches),
      breakdown: { catches, misses },
    };
  },
};
