import { Types } from "mongoose";
import { User, Dog, Registration } from "../models";
import { Discipline, ExperienceLevel, UserRole } from "../types";

// Manual roster entry (§5.1, complement to the spreadsheet import) — add a single
// competitor (player + dog) to an event with a chosen set of discipline/level
// entries. Mirrors roster-import.service dedup rules: players dedup by phone,
// dogs by (owner, name), registrations are idempotent per event.

const MS_PER_YEAR = 365.25 * 86400000;

// Disciplines that are actually split by experience level (§rulebook). Everything
// else collapses to Beginner regardless of what the client sends.
const LEVELLED = new Set<Discipline>([Discipline.Freestyle, Discipline.Distance]);

export interface ManualEntryInput {
  playerName: string;
  phone: string;
  dogName: string;
  dogAgeYears?: number;
  entries: { discipline: string; level?: string }[];
}

export interface ManualEntryResult {
  playerCreated: boolean;
  dogCreated: boolean;
  registrationsCreated: number;
  registrationsSkippedDuplicate: number;
  invalidDisciplines: string[];
}

export async function addManualEntry(
  eventId: string,
  input: ManualEntryInput
): Promise<ManualEntryResult> {
  const name = String(input.playerName ?? "").trim();
  const phone = String(input.phone ?? "").trim();
  const dogName = String(input.dogName ?? "").trim();
  if (!name || !phone || !dogName) {
    throw Object.assign(
      new Error("playerName, phone, and dogName are required"),
      { status: 400 }
    );
  }

  // Validate + normalise the requested discipline/level entries.
  const valid: { discipline: Discipline; level: ExperienceLevel }[] = [];
  const invalidDisciplines: string[] = [];
  const seen = new Set<string>();
  for (const raw of input.entries ?? []) {
    const disc = raw?.discipline as Discipline;
    if (!Object.values(Discipline).includes(disc)) {
      if (raw?.discipline) invalidDisciplines.push(String(raw.discipline));
      continue;
    }
    const level =
      LEVELLED.has(disc) && raw?.level === ExperienceLevel.Advanced
        ? ExperienceLevel.Advanced
        : ExperienceLevel.Beginner;
    const key = `${disc}:${level}`;
    if (seen.has(key)) continue; // de-dupe within the same submission
    seen.add(key);
    valid.push({ discipline: disc, level });
  }

  if (valid.length === 0) {
    throw Object.assign(
      new Error("At least one valid discipline is required"),
      { status: 400 }
    );
  }

  const now = new Date();
  const result: ManualEntryResult = {
    playerCreated: false,
    dogCreated: false,
    registrationsCreated: 0,
    registrationsSkippedDuplicate: 0,
    invalidDisciplines,
  };

  // Player — dedup by phone number.
  let player = await User.findOne({ phone_number: phone });
  if (!player) {
    player = await User.create({
      name,
      phone_number: phone,
      role: UserRole.Player,
    });
    result.playerCreated = true;
  }

  // Dog — dedup by (owner, name). Age is optional; default to 1yr like the import.
  const age = Number(input.dogAgeYears);
  const dob = new Date(
    now.getTime() - (Number.isFinite(age) && age > 0 ? age : 1) * MS_PER_YEAR
  );
  let dog = await Dog.findOne({ ownerId: player._id, name: dogName });
  if (!dog) {
    dog = await Dog.create({ ownerId: player._id, name: dogName, dob });
    result.dogCreated = true;
  }

  const target = { eventId: new Types.ObjectId(eventId) };
  for (const entry of valid) {
    const exists = await Registration.findOne({
      ...target,
      dogId: dog._id,
      discipline: entry.discipline,
      experienceLevel: entry.level,
    });
    if (exists) {
      result.registrationsSkippedDuplicate++;
      continue;
    }
    await Registration.create({
      ...target,
      playerId: player._id,
      dogId: dog._id,
      discipline: entry.discipline,
      experienceLevel: entry.level,
    });
    result.registrationsCreated++;
  }

  return result;
}
