import type { HeatDto, ScoreResponse } from "../../../lib/types";

// Contract every per-discipline scorer component implements. The scorer only
// emits judging actions; the scoring page owns posting, the running score, and
// undo. (Separate component per discipline — mirrors the server's scoring/*.)
export interface ScorerProps {
  heat: HeatDto;
  /**
   * Emit one judging action (becomes ActionLog.actionData on the server).
   * Resolves with the recomputed score, or null if the post failed — scorers
   * that need to know the action landed (Distance's bonus strip) await it.
   */
  onAction: (
    actionData: Record<string, unknown>
  ) => Promise<ScoreResponse | null>;
  /**
   * Rewrite the last logged action in place, keeping its slot in the timeline.
   * Distance/Ice Drop uses it to attach the +0.5 bonuses to the throw that was
   * just logged, instead of making the judge choose them up front.
   */
  onAmendLast?: (
    actionData: Record<string, unknown>
  ) => Promise<ScoreResponse | null>;
  disabled?: boolean;
  /**
   * Finish the run from inside the scorer. Freestyle uses this so each panel
   * judge finishes their own role (the page hides its generic finish button for
   * the 4-tablet panel); other scorers rely on the page's button and ignore it.
   */
  onFinish?: () => void;
  /**
   * Current running score from the server (incl. breakdown). Scorers that
   * derive UI state from progress — Multiple Challenge's next zone, Freestyle's
   * per-role panel — read it here so they stay correct across Undo and the
   * freestyle 4-tablet sync, rather than tracking their own local counters.
   */
  score?: ScoreResponse | null;
}
