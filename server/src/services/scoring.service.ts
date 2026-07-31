import { Types } from "mongoose";
import { Match, ActionLog, type IMatch } from "../models";
import { getScorer, type ScoreResult, type DisciplineScorer } from "../scoring";
import { FREESTYLE_PANEL_COUNT } from "../scoring/freestyle";
import { Discipline, MatchStatus } from "../types";
import type { ActionData } from "../scoring/types";

// Orchestrates the action-log → score recompute used by the scoring routes.
// Keeps the per-discipline math in src/scoring; this layer only loads the log,
// runs the matching scorer, and persists the resulting finalScore.

export interface RecomputeResult {
  matchId: string;
  eventId: string;
  categoryId: string;
  scorer: DisciplineScorer;
  result: ScoreResult;
}

/** Ordered action payloads for a heat (oldest → newest). */
async function loadActions(matchId: Types.ObjectId): Promise<ActionData[]> {
  const logs = await ActionLog.find({ matchId })
    .sort({ createdAt: 1, _id: 1 })
    .lean();
  return logs.map((l) => (l.actionData ?? {}) as ActionData);
}

/**
 * Recompute a heat's score from its full action log and persist it.
 * Timed disciplines that haven't finished yet yield a non-finite value, which
 * we leave unstored (no finalScore) until the run completes.
 */
export async function recomputeMatchScore(
  matchId: string
): Promise<RecomputeResult | null> {
  const match = await Match.findById(matchId);
  if (!match) return null;

  const scorer = getScorer(match.categoryId);
  if (!scorer) return null;

  const result = scorer.score(await loadActions(match._id as Types.ObjectId));

  match.finalScore = Number.isFinite(result.value) ? result.value : undefined;
  await match.save();

  return {
    matchId: String(match._id),
    eventId: String(match.eventId),
    categoryId: match.categoryId,
    scorer,
    result,
  };
}

/** One persisted action with its run-clock timestamp, for the review timeline. */
export interface TimelineEntry {
  timestamp: string; // run-clock at the tap, e.g. "00:45"
  actionData: ActionData;
  at?: Date; // wall-clock createdAt
}

export interface HeatStats extends RecomputeResult {
  /** Full ordered action log (oldest → newest) for the throw-by-throw timeline. */
  timeline: TimelineEntry[];
}

/**
 * Read-only heat summary for the post-run review (judge log / results page):
 * the recomputed score + breakdown (catches, misses, …) and the ordered action
 * timeline. Recomputed from the persisted log, so it needs no extra schema.
 */
export async function getHeatStats(matchId: string): Promise<HeatStats | null> {
  if (!Types.ObjectId.isValid(matchId)) return null;

  const match = await Match.findById(matchId);
  if (!match) return null;

  const scorer = getScorer(match.categoryId);
  if (!scorer) return null;

  const logs = await ActionLog.find({ matchId: match._id })
    .sort({ createdAt: 1, _id: 1 })
    .lean();

  const actions = logs.map((l) => (l.actionData ?? {}) as ActionData);
  const result = scorer.score(actions);

  return {
    matchId: String(match._id),
    eventId: String(match.eventId),
    categoryId: match.categoryId,
    scorer,
    result,
    timeline: logs.map((l) => ({
      timestamp: l.timestamp,
      actionData: (l.actionData ?? {}) as ActionData,
      at: (l as { createdAt?: Date }).createdAt,
    })),
  };
}

/** Append one judging action, then recompute. Returns null if the heat is unknown. */
export async function appendAction(
  matchId: string,
  timestamp: string,
  actionData: ActionData
): Promise<RecomputeResult | null> {
  if (!Types.ObjectId.isValid(matchId)) return null;
  const match = await Match.findById(matchId).select("_id");
  if (!match) return null;

  await ActionLog.create({ matchId, timestamp, actionData });
  return recomputeMatchScore(matchId);
}

/**
 * Freestyle is judged by a 4-tablet panel; each judge finishes their own role
 * independently (`{ role, done: true }`). The heat only completes — for the
 * leaderboard and live view — once EVERY panel judge has finished, so one
 * judge's (possibly accidental) finish never ends the heat for the others.
 *
 * Returns the match only if this call transitioned it to Completed, so the
 * caller can broadcast `match_status_changed` exactly once. §5.2
 */
export async function completeFreestyleIfAllDone(
  matchId: string,
  panelsDone: number
): Promise<IMatch | null> {
  if (panelsDone < FREESTYLE_PANEL_COUNT) return null;
  if (!Types.ObjectId.isValid(matchId)) return null;

  const match = await Match.findById(matchId);
  if (
    !match ||
    match.categoryId !== Discipline.Freestyle ||
    match.status === MatchStatus.Completed
  ) {
    return null;
  }

  match.status = MatchStatus.Completed;
  await match.save();
  return match;
}

/** Remove the most recent action for a heat (Undo), then recompute. */
export async function undoLastAction(
  matchId: string
): Promise<RecomputeResult | null> {
  if (!Types.ObjectId.isValid(matchId)) return null;

  const last = await ActionLog.findOne({ matchId }).sort({
    createdAt: -1,
    _id: -1,
  });
  if (last) await last.deleteOne();

  return recomputeMatchScore(matchId);
}
