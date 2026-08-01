import { Router } from "express";
import type { Server } from "socket.io";
import { Types } from "mongoose";
import * as XLSX from "xlsx";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";
import { requireEventManager } from "../middleware/requireManager";
import { Discipline, ExperienceLevel, UserRole } from "../types";
import { Event, Match } from "../models";
import { SCORERS } from "../scoring";
import { generateSchedule } from "../services/scheduler.service";
import { SERVER_EVENTS, eventRoom } from "../sockets/events";

const router = Router();

const DISCIPLINES = new Set<string>(Object.values(Discipline));

// Hebrew labels for the export — disciplines pull from each scorer's nameHe so
// they stay in sync with the rest of the app; levels are a small fixed map.
const DISCIPLINE_HE: Record<string, string> = Object.fromEntries(
  Object.entries(SCORERS).map(([k, s]) => [k, s.nameHe])
);
const LEVEL_HE: Record<string, string> = {
  [ExperienceLevel.Beginner]: "מתחילים",
  [ExperienceLevel.Advanced]: "מתקדמים",
};

// Israel-local HH:mm for the scheduled time (stored as UTC).
function timeHHmm(d: Date): string {
  return new Intl.DateTimeFormat("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jerusalem",
  }).format(d);
}

// Keep only valid Discipline→seconds overrides from an untrusted body.
function sanitizeOverrides(
  raw: unknown
): Partial<Record<Discipline, number>> | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const out: Partial<Record<Discipline, number>> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const n = Number(v);
    if (DISCIPLINES.has(k) && Number.isFinite(n) && n > 0) {
      out[k as Discipline] = n;
    }
  }
  return Object.keys(out).length ? out : undefined;
}

// POST /api/schedule/generate — run the scheduling engine (Admin) §5.1 / §7
router.post(
  "/generate",
  authenticate,
  requireRole(UserRole.Admin, UserRole.Organizer),
  requireEventManager,
  async (req, res, next) => {
    try {
      const { eventId, slotOverrides } = req.body ?? {};
      if (!eventId || !Types.ObjectId.isValid(eventId)) {
        return res.status(400).json({ error: "A valid eventId is required" });
      }

      const report = await generateSchedule(eventId, {
        slotOverrides: sanitizeOverrides(slotOverrides),
      });
      if (!report) return res.status(404).json({ error: "Event not found" });

      res.json(report);
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/schedule/swap — swap scheduledTime + pitchNumber between two heats
// Used by the manual drag/reorder UI (Admin) §3.2
router.patch(
  "/swap",
  authenticate,
  requireRole(UserRole.Admin),
  async (req, res, next) => {
    try {
      const { matchIdA, matchIdB } = req.body ?? {};
      if (!Types.ObjectId.isValid(matchIdA) || !Types.ObjectId.isValid(matchIdB)) {
        return res.status(400).json({ error: "matchIdA and matchIdB must be valid ids" });
      }
      const [a, b] = await Promise.all([
        Match.findById(matchIdA),
        Match.findById(matchIdB),
      ]);
      if (!a || !b) return res.status(404).json({ error: "One or both heats not found" });

      const tmpTime = a.scheduledTime;
      const tmpPitch = a.pitchNumber;
      a.scheduledTime = b.scheduledTime;
      a.pitchNumber = b.pitchNumber;
      b.scheduledTime = tmpTime;
      b.pitchNumber = tmpPitch;

      await Promise.all([a.save(), b.save()]);
      res.json({ swapped: [String(a._id), String(b._id)] });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/schedule/reorder — reassign scheduled times for an ordered list of
// heats within a single pitch. Takes the current sorted times and assigns the
// i-th time to the i-th heat in heatIds. §3.2 manual drag reordering.
//
// Body: { eventId, heatIds }. The eventId is what the ownership gate resolves,
// so an Organizer can reorder the competitions/league rounds they manage — and
// the heats are then checked to belong to that event.
router.patch(
  "/reorder",
  authenticate,
  requireRole(UserRole.Admin, UserRole.Organizer),
  requireEventManager,
  async (req, res, next) => {
    try {
      const { eventId, heatIds } = req.body ?? {};
      if (!eventId || !Types.ObjectId.isValid(String(eventId))) {
        return res.status(400).json({ error: "A valid eventId is required" });
      }
      if (
        !Array.isArray(heatIds) ||
        heatIds.length === 0 ||
        heatIds.some((id: unknown) => !Types.ObjectId.isValid(String(id)))
      ) {
        return res
          .status(400)
          .json({ error: "heatIds must be a non-empty array of valid ids" });
      }

      const heats = await Match.find({ _id: { $in: heatIds }, eventId });
      if (heats.length !== heatIds.length) {
        return res
          .status(404)
          .json({ error: "One or more heats not found in this event" });
      }

      // Redistribute the existing sorted times across the new order.
      const sortedTimes = [...heats]
        .sort((a, b) => a.scheduledTime.getTime() - b.scheduledTime.getTime())
        .map((h) => h.scheduledTime);

      const idToHeat = new Map(heats.map((h) => [String(h._id), h]));
      await Promise.all(
        (heatIds as string[]).map((id, i) => {
          const heat = idToHeat.get(id)!;
          heat.scheduledTime = sortedTimes[i];
          return heat.save();
        })
      );

      // Everyone watching this event's schedule/live board is now looking at a
      // stale run order, so tell them to re-pull it (§5.2).
      const io = req.app.get("io") as Server | undefined;
      io?.to(eventRoom(String(eventId))).emit(SERVER_EVENTS.SCHEDULE_UPDATED, {
        eventId: String(eventId),
      });

      res.json({ reordered: heatIds });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/schedule/export?eventId= — download the run order as an .xlsx with
// one sheet per pitch plus a combined sheet sorted by time (Admin) §3.2.
router.get(
  "/export",
  authenticate,
  requireRole(UserRole.Admin, UserRole.Organizer),
  requireEventManager,
  async (req, res, next) => {
    try {
      const { eventId } = req.query;
      if (!eventId || !Types.ObjectId.isValid(String(eventId))) {
        return res.status(400).json({ error: "A valid eventId is required" });
      }

      const event = await Event.findById(eventId).select("name").lean();
      if (!event) return res.status(404).json({ error: "Event not found" });

      const heats = await Match.find({ eventId })
        .sort({ scheduledTime: 1 })
        .populate("team.playerId", "name")
        .populate("team.dogId", "name")
        .lean();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const playerName = (h: any): string =>
        h.team?.playerId?.name ?? (h.isFinalsPlaceholder ? "— גמר —" : "");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dogName = (h: any): string => h.team?.dogId?.name ?? "";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const disc = (h: any): string => DISCIPLINE_HE[h.categoryId] ?? h.categoryId;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lvl = (h: any): string => LEVEL_HE[h.experienceLevel] ?? h.experienceLevel;

      const wb = XLSX.utils.book_new();
      wb.Workbook = { Views: [{ RTL: true }] }; // Hebrew right-to-left view

      // One sheet per pitch: run order with #, player, dog, discipline, level, time.
      const pitches = [...new Set(heats.map((h) => h.pitchNumber))].sort(
        (a, b) => a - b
      );
      for (const pitch of pitches) {
        const rows = heats
          .filter((h) => h.pitchNumber === pitch)
          .map((h, i) => ({
            "מס׳": i + 1,
            "שם שחקן": playerName(h),
            "שם כלב": dogName(h),
            "מקצה": disc(h),
            "רמה": lvl(h),
            "שעה": timeHHmm(h.scheduledTime),
          }));
        const ws = XLSX.utils.json_to_sheet(rows);
        ws["!cols"] = [{ wch: 5 }, { wch: 20 }, { wch: 16 }, { wch: 18 }, { wch: 10 }, { wch: 8 }];
        XLSX.utils.book_append_sheet(wb, ws, `מגרש ${pitch}`);
      }

      // Combined sheet across all pitches, sorted by time (heats already sorted).
      const combinedRows = heats.map((h) => ({
        "שעה": timeHHmm(h.scheduledTime),
        "שם כלב": dogName(h),
        "שם שחקן": playerName(h),
        "מגרש": h.pitchNumber,
        "רמה": lvl(h),
        "מקצה": disc(h),
      }));
      const combined = XLSX.utils.json_to_sheet(combinedRows);
      combined["!cols"] = [{ wch: 8 }, { wch: 16 }, { wch: 20 }, { wch: 8 }, { wch: 10 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, combined, "מאוחד");

      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      // ASCII-only fallback filename (the header must be Latin-1); the UTF-8
      // filename* carries the Hebrew name for browsers that support RFC 5987.
      const asciiName =
        String(event.name).replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") ||
        "event";
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="schedule_${asciiName}.xlsx"; filename*=UTF-8''${encodeURIComponent(`סדר_עלייה_${event.name}.xlsx`)}`
      );
      res.end(buffer);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
