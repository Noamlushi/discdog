import { Router } from "express";
import { Types } from "mongoose";
import { ExperienceLevel, MatchStatus, type ScoreDirection } from "../types";
import { Match } from "../models";
import { getScorer } from "../scoring";
import { formatPoints, formatTime } from "../scoring/util";

const router = Router();

interface NamedRef {
  name?: string;
}
interface RankedEntry {
  rank: number;
  matchId: string;
  pitchNumber: number;
  score: number;
  display: string;
  player: string | null;
  dog: string | null;
}

// Display a stored numeric finalScore the way its discipline reads it.
const formatScore = (value: number, direction: ScoreDirection): string =>
  direction === "asc" ? formatTime(value) : formatPoints(value);

// Standard competition ranking (1, 2, 2, 4) over an already-sorted list.
function assignRanks(entries: RankedEntry[]): void {
  let rank = 0;
  let prev: number | null = null;
  entries.forEach((entry, i) => {
    if (prev === null || entry.score !== prev) {
      rank = i + 1;
      prev = entry.score;
    }
    entry.rank = rank;
  });
}

// GET /api/leaderboards/:eventId — ranked leaderboards split by level (Public) §5.1
// No auth: public endpoints are read-only (§9.3). Ranked per discipline using
// that discipline's direction — points descending, times ascending (§3.4).
router.get("/:eventId", async (req, res, next) => {
  try {
    const { eventId } = req.params;
    if (!Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ error: "Invalid event id" });
    }

    const matches = await Match.find({
      eventId,
      status: MatchStatus.Completed,
    })
      .populate("team.playerId", "name")
      .populate("team.dogId", "name")
      .lean();

    // Group completed heats by discipline, then by experience level.
    const byCategory = new Map<string, typeof matches>();
    for (const m of matches) {
      if (typeof m.finalScore !== "number") continue; // unfinished / non-numeric
      const list = byCategory.get(m.categoryId) ?? [];
      list.push(m);
      byCategory.set(m.categoryId, list);
    }

    const categories = [...byCategory.entries()].map(([categoryId, heats]) => {
      const scorer = getScorer(categoryId);
      const direction: ScoreDirection = scorer?.direction ?? "desc";

      const levels: Record<string, RankedEntry[]> = {
        [ExperienceLevel.Beginner]: [],
        [ExperienceLevel.Advanced]: [],
      };

      for (const m of heats) {
        const score = m.finalScore as number;
        levels[m.experienceLevel]?.push({
          rank: 0,
          matchId: String(m._id),
          pitchNumber: m.pitchNumber,
          score,
          display: formatScore(score, direction),
          player: (m.team?.playerId as NamedRef | null)?.name ?? null,
          dog: (m.team?.dogId as NamedRef | null)?.name ?? null,
        });
      }

      for (const level of Object.keys(levels)) {
        levels[level].sort((a, b) =>
          direction === "asc" ? a.score - b.score : b.score - a.score
        );
        assignRanks(levels[level]);
      }

      return {
        categoryId,
        nameHe: scorer?.nameHe ?? categoryId,
        direction,
        levels,
      };
    });

    res.json({ eventId, categories });
  } catch (err) {
    next(err);
  }
});

export default router;
