import type { HeatDto, ScoreResponse } from "../../../lib/types";

// Contract every per-discipline scorer component implements. The scorer only
// emits judging actions; the scoring page owns posting, the running score, and
// undo. (Separate component per discipline — mirrors the server's scoring/*.)
export interface ScorerProps {
  heat: HeatDto;
  /** Emit one judging action (becomes ActionLog.actionData on the server). */
  onAction: (actionData: Record<string, unknown>) => void | Promise<void>;
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
