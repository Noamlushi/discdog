import { Types } from "mongoose";
import { Event, League, Registration } from "../models";
import { Discipline } from "../types";
import { uniqueSlug } from "./slug";
import { generateSchedule, type ScheduleReport } from "./scheduler.service";

// A league round is realized as an ordinary Event so the whole scheduler / judge
// / scoring pipeline is reused unchanged. This service materializes one round:
// it creates (or reuses) the round Event, clones the league's master roster onto
// it, and runs the existing scheduler.

// Default competition window for a generated round Event (start = league date).
const ROUND_WINDOW_HOURS = 6;

export interface GenerateRoundResult {
  event: { _id: string; name: string; slug: string };
  report: ScheduleReport | null;
}

/** Generate (or regenerate) a single league round. Idempotent per (date, round). */
export async function generateLeagueRound(
  leagueId: string,
  dateId: string,
  roundIndex: number
): Promise<GenerateRoundResult | null> {
  const league = await League.findById(leagueId);
  if (!league) return null;

  const leagueDate = league.dates.id(dateId);
  if (!leagueDate) return null;
  if (roundIndex < 1 || roundIndex > leagueDate.roundsCount) return null;

  // Reuse the existing round Event if this (date, round) was generated before.
  let event = await Event.findOne({
    leagueId: league._id,
    leagueDateId: leagueDate._id,
    roundIndex,
  });

  const start = new Date(leagueDate.date);
  const end = new Date(start.getTime() + ROUND_WINDOW_HOURS * 3600 * 1000);
  const dateLabel = leagueDate.label?.trim() || start.toLocaleDateString("he-IL");
  const name = `${league.name} — ${dateLabel} · סבב ${roundIndex}`;

  if (!event) {
    event = await Event.create({
      name,
      slug: await uniqueSlug(Event, name),
      ownerId: league.ownerId,
      organizerIds: league.organizerIds,
      estimatedStartTime: start,
      estimatedEndTime: end,
      minRestTimeMinutes: league.minRestTimeMinutes,
      activePitches: league.activePitches,
      leagueId: league._id,
      leagueDateId: leagueDate._id,
      roundIndex,
    });
  } else {
    event.name = name;
    event.estimatedStartTime = start;
    event.estimatedEndTime = end;
    event.minRestTimeMinutes = league.minRestTimeMinutes;
    event.activePitches = league.activePitches;
    await event.save();
  }

  // Clone the league master roster onto this round Event (Distance only).
  const master = await Registration.find({ leagueId: league._id })
    .select("playerId dogId experienceLevel")
    .lean();

  await Registration.deleteMany({ eventId: event._id });
  if (master.length > 0) {
    await Registration.insertMany(
      master.map((r) => ({
        eventId: event!._id as Types.ObjectId,
        playerId: r.playerId,
        dogId: r.dogId,
        discipline: Discipline.Distance,
        experienceLevel: r.experienceLevel,
      }))
    );
  }

  const report = await generateSchedule(String(event._id));

  return {
    event: { _id: String(event._id), name: event.name, slug: event.slug },
    report,
  };
}
