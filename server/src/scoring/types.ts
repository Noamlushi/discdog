import type { Discipline, ScoreDirection, ExperienceLevel } from "../types";

// Shared contract for the per-discipline scoring modules (one file each in this
// folder). Each discipline owns its own scoring code; this interface only
// defines the shape the dispatcher (`scoring/index.ts`) and routes rely on.

/** A single persisted judging action's payload (ActionLog.actionData, §4.5). */
export type ActionData = Record<string, unknown>;

/** Outcome of scoring a heat from its ordered action log. */
export interface ScoreResult {
  /** Numeric value used for ranking — points, or elapsed seconds for timed events. */
  value: number;
  /** Human-readable score for boards/UI, e.g. "18.5" or "01:23". */
  display: string;
  /** Optional per-component breakdown for the judge UI / live panel. */
  breakdown?: Record<string, number>;
}

/** Contract every discipline scoring module implements. */
export interface DisciplineScorer {
  /** Discipline key — matches Match.categoryId. */
  readonly key: Discipline;
  /** Hebrew display name (as in the rulebook). */
  readonly nameHe: string;
  /** Number of discs used in this discipline. */
  readonly discs: number;
  /** Ranking direction for finalScore (desc = points, asc = time). */
  readonly direction: ScoreDirection;
  /** Run duration in seconds for the given experience level. */
  durationSeconds(level: ExperienceLevel): number;
  /** Compute the running/final score from the ordered action log. */
  score(actions: ActionData[]): ScoreResult;
}
