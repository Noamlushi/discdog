// Dispatcher for the per-discipline scoring modules. Each discipline keeps its
// own scoring code in its own file (see the rulebook references in each); this
// barrel only maps a Match.categoryId to the right scorer and re-exports the
// shared contract.

import { Discipline } from "../types";
import type { DisciplineScorer } from "./types";

import { distance } from "./distance";
import { iceDrop } from "./iceDrop";
import { multipleChallenge } from "./multipleChallenge";
import { agility } from "./agility";
import { wheelOfFortune } from "./wheelOfFortune";
import { jTrail } from "./jTrail";
import { shuffle } from "./shuffle";
import { crissCross } from "./crissCross";
import { timeTrail } from "./timeTrail";
import { freestyle } from "./freestyle";

const SCORERS: Record<Discipline, DisciplineScorer> = {
  [Discipline.Distance]: distance,
  [Discipline.IceDrop]: iceDrop,
  [Discipline.MultipleChallenge]: multipleChallenge,
  [Discipline.Agility]: agility,
  [Discipline.WheelOfFortune]: wheelOfFortune,
  [Discipline.JTrail]: jTrail,
  [Discipline.Shuffle]: shuffle,
  [Discipline.CrissCross]: crissCross,
  [Discipline.TimeTrail]: timeTrail,
  [Discipline.Freestyle]: freestyle,
};

/** Resolve the scorer for a Match.categoryId, or undefined if unknown. */
export function getScorer(categoryId: string): DisciplineScorer | undefined {
  return SCORERS[categoryId as Discipline];
}

/** True if the categoryId maps to a known discipline. */
export function isDiscipline(categoryId: string): categoryId is Discipline {
  return categoryId in SCORERS;
}

export { SCORERS };
export type { DisciplineScorer, ScoreResult, ActionData } from "./types";
