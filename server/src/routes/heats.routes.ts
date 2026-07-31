import { Router } from "express";
import type { Server } from "socket.io";
import { Types } from "mongoose";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";
import { MatchStatus, UserRole } from "../types";
import { Match } from "../models";
import { getScorer } from "../scoring";
import { emitStatusChanged } from "../services/heat-status.service";

const router = Router();

const VALID_STATUSES = new Set<string>(Object.values(MatchStatus));

// GET /api/heats?eventId=&pitch=&status= — list heats for the judge/live screens
// (public read, §9.3). Ordered by scheduled time, with team names populated.
router.get("/", async (req, res, next) => {
  try {
    const { eventId, pitch, status } = req.query;
    const filter: Record<string, unknown> = {};

    if (eventId) {
      if (!Types.ObjectId.isValid(String(eventId))) {
        return res.status(400).json({ error: "Invalid eventId" });
      }
      filter.eventId = eventId;
    }
    if (pitch !== undefined && pitch !== "") filter.pitchNumber = Number(pitch);
    if (typeof status === "string" && VALID_STATUSES.has(status)) {
      filter.status = status;
    }

    const heats = await Match.find(filter)
      .sort({ scheduledTime: 1 })
      .populate("team.playerId", "name")
      .populate("team.dogId", "name")
      .lean();
    res.json(heats);
  } catch (err) {
    next(err);
  }
});

// PUT /api/heats/:id/status — update heat status (Admin | Judge) §5.1
// Pending | On-Deck | Live | Completed — broadcasts `match_status_changed`.
router.put(
  "/:id/status",
  authenticate,
  requireRole(UserRole.Admin, UserRole.Organizer, UserRole.Judge),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { status, elapsedSeconds } = req.body ?? {};

      if (!Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: "Invalid heat id" });
      }
      if (typeof status !== "string" || !VALID_STATUSES.has(status)) {
        return res.status(400).json({
          error: `status must be one of: ${[...VALID_STATUSES].join(", ")}`,
        });
      }

      const match = await Match.findById(id);
      if (!match) return res.status(404).json({ error: "Heat not found" });

      // Stamp the run-start when entering Live (resets on a genuine restart) so
      // the spectator view can show an accurate "time left" countdown (§3.4).
      if (status === MatchStatus.Live && match.status !== MatchStatus.Live) {
        match.liveStartedAt = new Date();
      }

      match.status = status as MatchStatus;

      // Timed disciplines (direction "asc") finalise on completion: persist the
      // stopwatch's elapsed seconds as the numeric finalScore (§4.4).
      const scorer = getScorer(match.categoryId);
      if (
        status === MatchStatus.Completed &&
        scorer?.direction === "asc" &&
        Number.isFinite(Number(elapsedSeconds))
      ) {
        match.finalScore = Number(elapsedSeconds);
      }

      await match.save();

      const io = req.app.get("io") as Server | undefined;
      const payload = await emitStatusChanged(io, match);

      res.json(payload);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
