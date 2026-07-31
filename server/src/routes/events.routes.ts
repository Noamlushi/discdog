import { Router } from "express";
import multer from "multer";
import { Types } from "mongoose";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";
import { requireEventManager } from "../middleware/requireManager";
import { UserRole } from "../types";
import { Event, Match, ActionLog, Registration } from "../models";
import { uniqueSlug } from "../services/slug";
import { importRoster } from "../services/roster-import.service";
import { addManualEntry } from "../services/manual-roster.service";

// Keep only valid ObjectId strings from an untrusted organizerIds array.
function sanitizeIds(raw: unknown): Types.ObjectId[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((v) => typeof v === "string" && Types.ObjectId.isValid(v))
    .map((v) => new Types.ObjectId(v as string));
}

// In-memory upload — buffer is handed to the xlsx (SheetJS) parser.
const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

// GET /api/events — list events (public read, §9.3). Newest planned first.
// `?leagueId=` returns that league's round Events; otherwise only standalone
// competitions (league rounds are hidden from the top-level list).
router.get("/", async (req, res, next) => {
  try {
    const { leagueId } = req.query;
    const filter =
      typeof leagueId === "string" && Types.ObjectId.isValid(leagueId)
        ? { leagueId }
        : { leagueId: { $exists: false } };
    const events = await Event.find(filter).sort({ estimatedStartTime: 1 }).lean();
    res.json(events);
  } catch (err) {
    next(err);
  }
});

// GET /api/events/slug/:slug — single event by its shareable slug (public read).
router.get("/slug/:slug", async (req, res, next) => {
  try {
    const event = await Event.findOne({ slug: req.params.slug }).lean();
    if (!event) return res.status(404).json({ error: "Event not found" });
    res.json(event);
  } catch (err) {
    next(err);
  }
});

// GET /api/events/:id — single event detail (public read).
router.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid event id" });
    }
    const event = await Event.findById(id).lean();
    if (!event) return res.status(404).json({ error: "Event not found" });
    res.json(event);
  } catch (err) {
    next(err);
  }
});

// POST /api/events — create a new event (Admin) §4.3
router.post(
  "/",
  authenticate,
  requireRole(UserRole.Admin),
  async (req, res, next) => {
    try {
      const { name, estimatedStartTime, estimatedEndTime, minRestTimeMinutes, activePitches, organizerIds } =
        req.body;
      if (!name || !estimatedStartTime || !estimatedEndTime) {
        return res.status(400).json({ error: "name, estimatedStartTime, and estimatedEndTime are required" });
      }
      const event = await Event.create({
        name,
        slug: await uniqueSlug(Event, name),
        ownerId: req.user!.sub,
        organizerIds: sanitizeIds(organizerIds),
        estimatedStartTime: new Date(estimatedStartTime),
        estimatedEndTime: new Date(estimatedEndTime),
        minRestTimeMinutes: minRestTimeMinutes ?? 0,
        activePitches: activePitches ?? 1,
      });
      res.status(201).json(event);
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/events/:id/organizers — assign/replace the managing organizers (Admin) §3.1
router.patch(
  "/:id/organizers",
  authenticate,
  requireRole(UserRole.Admin),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: "Invalid event id" });
      }
      const event = await Event.findByIdAndUpdate(
        id,
        { organizerIds: sanitizeIds(req.body?.organizerIds) },
        { new: true }
      ).lean();
      if (!event) return res.status(404).json({ error: "Event not found" });
      res.json(event);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/events/import — ingest CSV/Excel → create players + dogs (Admin) §5.1
// Registrations are attached to an existing event; pass eventId in the form body
// (or ?eventId=). Returns an import summary including any skipped disciplines.
router.post(
  "/import",
  authenticate,
  requireRole(UserRole.Admin, UserRole.Organizer),
  upload.single("file"),
  requireEventManager,
  async (req, res, next) => {
    try {
      const eventId = String(req.body?.eventId ?? req.query?.eventId ?? "");
      if (!Types.ObjectId.isValid(eventId)) {
        return res.status(400).json({ error: "A valid eventId is required" });
      }
      if (!req.file?.buffer) {
        return res.status(400).json({ error: "A spreadsheet file is required" });
      }

      const event = await Event.findById(eventId).select("_id");
      if (!event) return res.status(404).json({ error: "Event not found" });

      const summary = await importRoster({ eventId }, req.file.buffer);
      res.json(summary);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/events/:id/registrations — manually add one competitor (player + dog)
// with a chosen set of discipline/level entries. Complements the spreadsheet
// import (§5.1). Gated to the Admin or an assigned Organizer.
router.post(
  "/:id/registrations",
  authenticate,
  requireRole(UserRole.Admin, UserRole.Organizer),
  requireEventManager,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: "Invalid event id" });
      }
      const event = await Event.findById(id).select("_id").lean();
      if (!event) return res.status(404).json({ error: "Event not found" });

      const result = await addManualEntry(id, req.body ?? {});
      res.status(201).json(result);
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 400) {
        return res.status(400).json({ error: (err as Error).message });
      }
      next(err);
    }
  }
);

// DELETE /api/events/:id — permanently remove a competition and everything that
// hangs off it: its heats (Matches), their throw-by-throw ActionLogs, and the
// roster Registrations. Gated to the Admin or an assigned Organizer. League-round
// Events are refused here — they must be managed through their league so standings
// stay consistent. §3.1
router.delete(
  "/:id",
  authenticate,
  requireRole(UserRole.Admin, UserRole.Organizer),
  requireEventManager,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: "Invalid event id" });
      }
      const event = await Event.findById(id).select("_id leagueId").lean();
      if (!event) return res.status(404).json({ error: "Event not found" });
      if (event.leagueId) {
        return res.status(409).json({
          error: "This event is a league round; delete it from its league instead.",
        });
      }

      // Cascade: ActionLogs → Matches → Registrations → Event.
      const matchIds = (
        await Match.find({ eventId: id }).select("_id").lean()
      ).map((m) => m._id);
      const actionLogs = matchIds.length
        ? (await ActionLog.deleteMany({ matchId: { $in: matchIds } })).deletedCount ?? 0
        : 0;
      const matches = (await Match.deleteMany({ eventId: id })).deletedCount ?? 0;
      const registrations =
        (await Registration.deleteMany({ eventId: id })).deletedCount ?? 0;
      await Event.deleteOne({ _id: id });

      res.json({
        ok: true,
        deleted: { event: 1, matches, actionLogs, registrations },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
