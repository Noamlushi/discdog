import { Router } from "express";
import multer from "multer";
import { Types } from "mongoose";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";
import { requireLeagueManager } from "../middleware/requireManager";
import { Discipline, ExperienceLevel, UserRole } from "../types";
import { League, Registration, User, Dog, Event, Match, ActionLog } from "../models";
import { uniqueSlug, normalizeSlug } from "../services/slug";
import { importRoster } from "../services/roster-import.service";
import { generateLeagueRound } from "../services/league-round.service";
import { computeLeagueStandings } from "../services/league-standings.service";
import { computeLeagueSummary } from "../services/league-summary.service";

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

function sanitizeIds(raw: unknown): Types.ObjectId[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((v) => typeof v === "string" && Types.ObjectId.isValid(v))
    .map((v) => new Types.ObjectId(v as string));
}

// Normalise the dates array from the create/patch body.
function sanitizeDates(
  raw: unknown
): { date: Date; roundsCount: number; label?: string }[] {
  if (!Array.isArray(raw)) return [];
  const out: { date: Date; roundsCount: number; label?: string }[] = [];
  for (const d of raw) {
    const date = new Date((d as { date?: string })?.date ?? "");
    if (Number.isNaN(date.getTime())) continue;
    const roundsCount = Math.max(
      1,
      Number((d as { roundsCount?: number })?.roundsCount) || 2
    );
    const label = (d as { label?: string })?.label;
    out.push({ date, roundsCount, ...(label ? { label } : {}) });
  }
  return out;
}

function sanitizeLevels(raw: unknown): ExperienceLevel[] {
  if (!Array.isArray(raw)) return [ExperienceLevel.Beginner, ExperienceLevel.Advanced];
  const valid = raw.filter((l): l is ExperienceLevel =>
    Object.values(ExperienceLevel).includes(l as ExperienceLevel)
  );
  return valid.length ? valid : [ExperienceLevel.Beginner, ExperienceLevel.Advanced];
}

// GET /api/leagues — list leagues (public read). Newest first.
router.get("/", async (_req, res, next) => {
  try {
    const leagues = await League.find().sort({ createdAt: -1 }).lean();
    res.json(leagues);
  } catch (err) {
    next(err);
  }
});

// GET /api/leagues/slug/:slug — league by shareable slug (public read).
router.get("/slug/:slug", async (req, res, next) => {
  try {
    const league = await League.findOne({ slug: req.params.slug }).lean();
    if (!league) return res.status(404).json({ error: "League not found" });
    res.json(league);
  } catch (err) {
    next(err);
  }
});

// GET /api/leagues/:id/standings — aggregated best-of-N standings (public read).
router.get("/:id/standings", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid league id" });
    }
    const standings = await computeLeagueStandings(id);
    if (!standings) return res.status(404).json({ error: "League not found" });
    res.json(standings);
  } catch (err) {
    next(err);
  }
});

// GET /api/leagues/:id/summary — league-wide run statistics across every round
// (public read). Standings say who is winning; this says how the league ran.
router.get("/:id/summary", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid league id" });
    }
    const summary = await computeLeagueSummary(id);
    if (!summary) return res.status(404).json({ error: "League not found" });
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

// GET /api/leagues/:id — single league detail (public read).
router.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid league id" });
    }
    const league = await League.findById(id).lean();
    if (!league) return res.status(404).json({ error: "League not found" });
    res.json(league);
  } catch (err) {
    next(err);
  }
});

// POST /api/leagues — create a Distance league (Admin).
router.post(
  "/",
  authenticate,
  requireRole(UserRole.Admin),
  async (req, res, next) => {
    try {
      const { name, slug, dates, scoring, experienceLevels, minRestTimeMinutes, activePitches, organizerIds } =
        req.body ?? {};
      if (!name) return res.status(400).json({ error: "name is required" });

      const mode = scoring?.mode === "sum" ? "sum" : "bestOf";
      const bestN = Math.max(1, Number(scoring?.bestN) || 3);

      // The league slug is the root of its round tree (/l/:slug/:date/:round),
      // so the organizer may choose it; we fall back to the random one.
      let chosenSlug: string | null = null;
      if (slug !== undefined && String(slug).trim() !== "") {
        chosenSlug = normalizeSlug(slug);
        if (!chosenSlug) {
          return res.status(400).json({
            error: "slug must be 2-60 characters of letters, digits or dashes",
          });
        }
        if (await League.exists({ slug: chosenSlug })) {
          return res.status(409).json({ error: "slug is already taken" });
        }
      }

      const league = await League.create({
        name,
        slug: chosenSlug ?? (await uniqueSlug(League, name)),
        ownerId: req.user!.sub,
        organizerIds: sanitizeIds(organizerIds),
        categoryId: Discipline.Distance,
        experienceLevels: sanitizeLevels(experienceLevels),
        dates: sanitizeDates(dates),
        scoring: { mode, bestN },
        minRestTimeMinutes: minRestTimeMinutes ?? 0,
        activePitches: activePitches ?? 1,
      });
      res.status(201).json(league);
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/leagues/:id — edit dates/scoring/levels (manager).
router.patch(
  "/:id",
  authenticate,
  requireRole(UserRole.Admin, UserRole.Organizer),
  requireLeagueManager,
  async (req, res, next) => {
    try {
      const league = await League.findById(req.params.id);
      if (!league) return res.status(404).json({ error: "League not found" });

      const { name, slug, dates, scoring, experienceLevels, minRestTimeMinutes, activePitches } =
        req.body ?? {};
      if (typeof name === "string" && name.trim()) league.name = name.trim();

      // Renaming the slug moves the whole round tree; old /l/:slug links break,
      // which is why it is an explicit action rather than a side effect of a
      // name change.
      if (slug !== undefined) {
        const next = normalizeSlug(slug);
        if (!next) {
          return res.status(400).json({
            error: "slug must be 2-60 characters of letters, digits or dashes",
          });
        }
        if (next !== league.slug) {
          if (await League.exists({ slug: next })) {
            return res.status(409).json({ error: "slug is already taken" });
          }
          league.slug = next;
        }
      }
      if (dates !== undefined) league.dates.splice(0, league.dates.length, ...sanitizeDates(dates));
      if (experienceLevels !== undefined) league.experienceLevels = sanitizeLevels(experienceLevels);
      if (scoring !== undefined) {
        league.scoring.mode = scoring?.mode === "sum" ? "sum" : "bestOf";
        league.scoring.bestN = Math.max(1, Number(scoring?.bestN) || league.scoring.bestN);
      }
      if (minRestTimeMinutes !== undefined) league.minRestTimeMinutes = Number(minRestTimeMinutes) || 0;
      if (activePitches !== undefined) league.activePitches = Math.max(1, Number(activePitches) || 1);

      await league.save();
      res.json(league.toObject());
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/leagues/:id/import — import the master roster once (manager).
// Only Distance registrations are kept; they are cloned onto each round Event.
router.post(
  "/:id/import",
  authenticate,
  requireRole(UserRole.Admin, UserRole.Organizer),
  requireLeagueManager,
  upload.single("file"),
  async (req, res, next) => {
    try {
      const leagueId = req.params.id;
      if (!req.file?.buffer) {
        return res.status(400).json({ error: "A spreadsheet file is required" });
      }
      const league = await League.findById(leagueId).select("_id");
      if (!league) return res.status(404).json({ error: "League not found" });

      const summary = await importRoster({ leagueId }, req.file.buffer, {
        disciplineFilter: Discipline.Distance,
      });
      res.json(summary);
    } catch (err) {
      next(err);
    }
  }
);

// ── Master-roster manual management (§5.1) ───────────────────────────────────
// The league roster is imported once from a spreadsheet, but managers can also
// build/adjust it by hand (add a competitor+dog, remove one). Entries live as
// Distance registrations tagged with `leagueId`; each round clones them (see
// services/league-round.service). The run order itself stays auto-generated by
// the §7 scheduler — this only manages WHO is registered.

// One populated master-roster line for the client.
function serializeEntry(reg: {
  _id: unknown;
  playerId: { _id: unknown; name?: string } | null;
  dogId: { _id: unknown; name?: string } | null;
  experienceLevel: ExperienceLevel;
}) {
  return {
    _id: String(reg._id),
    playerId: reg.playerId ? String(reg.playerId._id) : null,
    playerName: reg.playerId?.name ?? null,
    dogId: reg.dogId ? String(reg.dogId._id) : null,
    dogName: reg.dogId?.name ?? null,
    experienceLevel: reg.experienceLevel,
  };
}

// GET /api/leagues/:id/roster — the master roster with player/dog names (public
// read; consistent with the other league read endpoints).
router.get("/:id/roster", async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid league id" });
    }
    const regs = await Registration.find({ leagueId: id })
      .sort({ createdAt: 1 })
      .populate("playerId", "name")
      .populate("dogId", "name")
      .lean();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    res.json(regs.map((r) => serializeEntry(r as any)));
  } catch (err) {
    next(err);
  }
});

// POST /api/leagues/:id/roster — add one competitor+dog to the master roster
// (manager). Body: { playerName, dogName, phone?, experienceLevel? }. Dedups the
// player by phone (when given) and the dog by (owner, name), mirroring the import.
router.post(
  "/:id/roster",
  authenticate,
  requireRole(UserRole.Admin, UserRole.Organizer),
  requireLeagueManager,
  async (req, res, next) => {
    try {
      const leagueId = req.params.id;
      const league = await League.findById(leagueId).select("_id");
      if (!league) return res.status(404).json({ error: "League not found" });

      const playerName = String(req.body?.playerName ?? "").trim();
      const dogName = String(req.body?.dogName ?? "").trim();
      const phone = String(req.body?.phone ?? "").trim();
      if (!playerName || !dogName) {
        return res
          .status(400)
          .json({ error: "playerName and dogName are required" });
      }
      const experienceLevel = Object.values(ExperienceLevel).includes(
        req.body?.experienceLevel as ExperienceLevel
      )
        ? (req.body.experienceLevel as ExperienceLevel)
        : ExperienceLevel.Beginner;

      // Player — dedup by phone when provided, otherwise a fresh Player account.
      let player = phone ? await User.findOne({ phone_number: phone }) : null;
      if (!player) {
        player = await User.create({
          name: playerName,
          phone_number: phone,
          role: UserRole.Player,
        });
      }

      // Dog — dedup by (owner, name).
      let dog = await Dog.findOne({ ownerId: player._id, name: dogName });
      if (!dog) {
        // dob is required; the manual form has no age, so default to ~1yr ago.
        dog = await Dog.create({
          ownerId: player._id,
          name: dogName,
          dob: new Date(Date.now() - 365 * 86400000),
        });
      }

      // Registration — idempotent per (league, dog, level).
      const filter = {
        leagueId,
        dogId: dog._id,
        discipline: Discipline.Distance,
        experienceLevel,
      };
      let reg = await Registration.findOne(filter);
      let created = false;
      if (!reg) {
        reg = await Registration.create({ ...filter, playerId: player._id });
        created = true;
      }
      const populated = await reg.populate([
        { path: "playerId", select: "name" },
        { path: "dogId", select: "name" },
      ]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      res.status(created ? 201 : 200).json(serializeEntry(populated as any));
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/leagues/:id/roster/:regId — remove one team from the master roster
// (manager). Only touches the master entry; already-generated rounds keep their
// cloned heats until regenerated.
router.delete(
  "/:id/roster/:regId",
  authenticate,
  requireRole(UserRole.Admin, UserRole.Organizer),
  requireLeagueManager,
  async (req, res, next) => {
    try {
      const { id, regId } = req.params;
      if (!Types.ObjectId.isValid(regId)) {
        return res.status(400).json({ error: "Invalid registration id" });
      }
      const deleted = await Registration.findOneAndDelete({
        _id: regId,
        leagueId: id,
      });
      if (!deleted) {
        return res.status(404).json({ error: "Roster entry not found" });
      }
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/leagues/:id/rounds/generate — materialize a round as an Event and
// schedule it from the master roster (manager). Body: { dateId, roundIndex }.
router.post(
  "/:id/rounds/generate",
  authenticate,
  requireRole(UserRole.Admin, UserRole.Organizer),
  requireLeagueManager,
  async (req, res, next) => {
    try {
      const { dateId, roundIndex } = req.body ?? {};
      if (!Types.ObjectId.isValid(dateId) || !Number.isInteger(roundIndex)) {
        return res
          .status(400)
          .json({ error: "A valid dateId and integer roundIndex are required" });
      }
      const result = await generateLeagueRound(req.params.id, dateId, roundIndex);
      if (!result) {
        return res
          .status(404)
          .json({ error: "League, date, or round not found" });
      }
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/leagues/:id — permanently remove a league and everything under it:
// every round Event (and each round's heats/ActionLogs/cloned Registrations) plus
// the league's master roster. Gated to the Admin or an assigned Organizer. §3.1
router.delete(
  "/:id",
  authenticate,
  requireRole(UserRole.Admin, UserRole.Organizer),
  requireLeagueManager,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: "Invalid league id" });
      }
      const league = await League.findById(id).select("_id").lean();
      if (!league) return res.status(404).json({ error: "League not found" });

      // Round Events tagged with this league → cascade their scoring data.
      const eventIds = (
        await Event.find({ leagueId: id }).select("_id").lean()
      ).map((e) => e._id);
      const matchIds = eventIds.length
        ? (await Match.find({ eventId: { $in: eventIds } }).select("_id").lean()).map(
            (m) => m._id
          )
        : [];
      const actionLogs = matchIds.length
        ? (await ActionLog.deleteMany({ matchId: { $in: matchIds } })).deletedCount ?? 0
        : 0;
      const matches = matchIds.length
        ? (await Match.deleteMany({ eventId: { $in: eventIds } })).deletedCount ?? 0
        : 0;
      // Registrations: both the league master roster (leagueId) and any round-cloned
      // event-scoped copies.
      const registrations =
        (
          await Registration.deleteMany({
            $or: [{ leagueId: id }, { eventId: { $in: eventIds } }],
          })
        ).deletedCount ?? 0;
      const events = eventIds.length
        ? (await Event.deleteMany({ leagueId: id })).deletedCount ?? 0
        : 0;
      await League.deleteOne({ _id: id });

      res.json({
        ok: true,
        deleted: { league: 1, events, matches, actionLogs, registrations },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
