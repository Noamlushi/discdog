import { Router, type Request } from "express";
import type { Server } from "socket.io";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";
import { Discipline, UserRole } from "../types";
import {
  appendAction,
  amendLastAction,
  undoLastAction,
  getHeatStats,
  completeFreestyleIfAllDone,
  type RecomputeResult,
} from "../services/scoring.service";
import { emitStatusChanged } from "../services/heat-status.service";
import { SERVER_EVENTS, eventRoom } from "../sockets/events";

const router = Router();

// Normalise a non-finite (unfinished timed) score to null for the wire.
const wireScore = (value: number): number | null =>
  Number.isFinite(value) ? value : null;

// Push the recomputed score to the heat's event room (§5.2). Freestyle also
// drives the 4-tablet panel sync off the very same recompute.
function broadcastScore(req: Request, rc: RecomputeResult): void {
  const io = req.app.get("io") as Server | undefined;
  if (!io) return;

  const payload = {
    matchId: rc.matchId,
    eventId: rc.eventId,
    categoryId: rc.categoryId,
    score: wireScore(rc.result.value),
    display: rc.result.display,
    breakdown: rc.result.breakdown ?? null,
  };

  const room = io.to(eventRoom(rc.eventId));
  room.emit(SERVER_EVENTS.LIVE_SCORE_UPDATED, payload);
  if (rc.categoryId === Discipline.Freestyle) {
    room.emit(SERVER_EVENTS.FREESTYLE_SYNC, payload);
  }
}

// GET /api/scoring/:matchId — heat review: score, breakdown (catches/misses) and
// the throw-by-throw timeline. Read-only and used by both the judge log and the
// public results view, so it isn't role-gated. §6.2
router.get("/:matchId", authenticate, async (req, res, next) => {
  try {
    const stats = await getHeatStats(req.params.matchId);
    if (!stats) {
      return res.status(404).json({ error: "Unknown match or discipline" });
    }
    res.json({
      matchId: stats.matchId,
      eventId: stats.eventId,
      categoryId: stats.categoryId,
      score: wireScore(stats.result.value),
      display: stats.result.display,
      breakdown: stats.result.breakdown ?? null,
      timeline: stats.timeline,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/scoring/action — persist a judging tap to the action log (Judge) §5.1
router.post(
  "/action",
  authenticate,
  requireRole(UserRole.Admin, UserRole.Organizer, UserRole.Judge),
  async (req, res, next) => {
    try {
      const { matchId, timestamp, actionData } = req.body ?? {};
      if (
        !matchId ||
        typeof timestamp !== "string" ||
        typeof actionData !== "object" ||
        actionData === null
      ) {
        return res.status(400).json({
          error: "matchId, timestamp and actionData are required",
        });
      }

      const rc = await appendAction(matchId, timestamp, actionData);
      if (!rc) return res.status(404).json({ error: "Unknown match or discipline" });

      broadcastScore(req, rc);

      // Freestyle: when the last of the 4 panel judges finishes their own
      // scoring, complete the heat for everyone and broadcast the status (§5.2).
      if (rc.categoryId === Discipline.Freestyle) {
        const completed = await completeFreestyleIfAllDone(
          rc.matchId,
          rc.result.breakdown?.panelsDone ?? 0
        );
        if (completed) {
          await emitStatusChanged(req.app.get("io") as Server | undefined, completed);
        }
      }

      res.status(201).json({
        score: wireScore(rc.result.value),
        display: rc.result.display,
        breakdown: rc.result.breakdown ?? null,
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/scoring/amend — rewrite the last action in place (Judge) §5.1.
// Distance/Ice Drop logs the zone on the catch and adds the +0.5 bonuses to
// that same throw a moment later; that is an amendment, not a new throw.
router.post(
  "/amend",
  authenticate,
  requireRole(UserRole.Admin, UserRole.Organizer, UserRole.Judge),
  async (req, res, next) => {
    try {
      const { matchId, actionData } = req.body ?? {};
      if (
        !matchId ||
        typeof actionData !== "object" ||
        actionData === null
      ) {
        return res
          .status(400)
          .json({ error: "matchId and actionData are required" });
      }

      const rc = await amendLastAction(matchId, actionData);
      if (!rc) {
        return res
          .status(404)
          .json({ error: "Unknown match, or no action to amend" });
      }

      broadcastScore(req, rc);
      res.json({
        score: wireScore(rc.result.value),
        display: rc.result.display,
        breakdown: rc.result.breakdown ?? null,
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/scoring/undo — remove the last action on mistake (Judge) §5.1
router.post(
  "/undo",
  authenticate,
  requireRole(UserRole.Admin, UserRole.Organizer, UserRole.Judge),
  async (req, res, next) => {
    try {
      const { matchId } = req.body ?? {};
      if (!matchId) return res.status(400).json({ error: "matchId is required" });

      const rc = await undoLastAction(matchId);
      if (!rc) return res.status(404).json({ error: "Unknown match or discipline" });

      broadcastScore(req, rc);
      res.json({
        score: wireScore(rc.result.value),
        display: rc.result.display,
        breakdown: rc.result.breakdown ?? null,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
