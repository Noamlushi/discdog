import * as XLSX from "xlsx";
import { User, Dog, Registration } from "../models";
import { Discipline, ExperienceLevel, UserRole } from "../types";
import { SCORERS } from "../scoring";

// Roster import (§5.1) — ingest the competition registration sheet (a Google
// Form export) and create Players, Dogs, and Registrations for an event.
//
// The form has one row per (player, dog) submission; the "מקצים" column holds a
// comma-separated list of disciplines, with a level word (מתחילים/מתקדמים) only
// on Freestyle and Distance. Columns are matched by header text, not position,
// so column re-ordering between forms is tolerated.

export interface ImportSummary {
  playersCreated: number;
  dogsCreated: number;
  registrationsCreated: number;
  registrationsSkippedDuplicate: number;
  rowsProcessed: number;
  unknownDisciplines: { row: number; token: string }[];
  warnings: string[];
}

// Disciplines that are actually split by experience level (§rulebook).
const LEVELLED = new Set<Discipline>([Discipline.Freestyle, Discipline.Distance]);

// ── Hebrew/Latin normalisation + discipline aliases ─────────────────────────

// Strip quotes/geresh/whitespace and lowercase so "פריזג'יליטי" == "פריזגיליטי".
function normalize(s: string): string {
  return String(s)
    .replace(/["'`׳״]/g, "")
    .replace(/\s+/g, "")
    .trim()
    .toLowerCase();
}

// Built from each scorer's nameHe, plus extra spellings for robustness.
const DISCIPLINE_ALIASES: Record<string, Discipline> = {};
for (const [key, scorer] of Object.entries(SCORERS)) {
  DISCIPLINE_ALIASES[normalize(scorer.nameHe)] = key as Discipline;
}
Object.assign(DISCIPLINE_ALIASES, {
  [normalize("distance")]: Discipline.Distance,
  [normalize("ice drop")]: Discipline.IceDrop,
  [normalize("איס דרופ")]: Discipline.IceDrop,
  [normalize("אייס דרופ")]: Discipline.IceDrop,
  [normalize("multiple challenge")]: Discipline.MultipleChallenge,
  [normalize("מולטיפול")]: Discipline.MultipleChallenge,
  [normalize("agility")]: Discipline.Agility,
  [normalize("אג'יליטי")]: Discipline.Agility,
  [normalize("wheel of fortune")]: Discipline.WheelOfFortune,
  [normalize("גלגל מזל")]: Discipline.WheelOfFortune,
  [normalize("jtrail")]: Discipline.JTrail,
  [normalize("ג'יטרייל")]: Discipline.JTrail,
  [normalize("shuffle")]: Discipline.Shuffle,
  [normalize("שאפל ב30")]: Discipline.Shuffle,
  [normalize("criss cross")]: Discipline.CrissCross,
  [normalize("קריס קרוס")]: Discipline.CrissCross,
  [normalize("time trail")]: Discipline.TimeTrail,
  [normalize("טיים טרייל")]: Discipline.TimeTrail,
});

function resolveDiscipline(token: string): Discipline | null {
  const exact = DISCIPLINE_ALIASES[token];
  if (exact) return exact;
  // Fall back to substring match (handles trailing words, typos in spacing).
  for (const [alias, disc] of Object.entries(DISCIPLINE_ALIASES)) {
    if (alias.length >= 3 && token.includes(alias)) return disc;
  }
  // Reverse match: the token may be a shorter form of an alias — e.g. the form
  // wrote "שאפל" (alias is "שאפל ב-30") or a truncated "פריזג'יליט" (alias
  // "פריזג'יליטי"). Only for reasonably long tokens, and only when exactly one
  // discipline's alias starts with the token (avoids ambiguous short prefixes).
  if (token.length >= 4) {
    const matches = new Set<Discipline>();
    for (const [alias, disc] of Object.entries(DISCIPLINE_ALIASES)) {
      if (alias.startsWith(token)) matches.add(disc);
    }
    if (matches.size === 1) return [...matches][0];
  }
  return null;
}

interface ParsedEntry {
  discipline: Discipline;
  level: ExperienceLevel;
}

// Parse the "מקצים" cell → discipline/level entries + any unrecognised tokens.
// Exported for unit testing of the discipline/level mapping.
export function parseDisciplines(cell: string): {
  entries: ParsedEntry[];
  unknown: string[];
} {
  const entries: ParsedEntry[] = [];
  const unknown: string[] = [];

  for (const rawToken of String(cell).split(",")) {
    const raw = rawToken.replace(/\s+/g, " ").trim();
    if (!raw) continue;

    const norm = normalize(raw);
    const isAdvanced = norm.includes("מתקדמ") || norm.includes("advanced");
    const isBeginner = norm.includes("מתחיל") || norm.includes("beginner");
    const discNorm = norm
      .replace(/מתקדמים|מתקדם|advanced/g, "")
      .replace(/מתחילים|מתחיל|beginner/g, "");

    const discipline = resolveDiscipline(discNorm);
    if (!discipline) {
      unknown.push(raw);
      continue;
    }

    // Levels only matter for Freestyle/Distance; everything else → Beginner.
    const level =
      LEVELLED.has(discipline) && isAdvanced
        ? ExperienceLevel.Advanced
        : ExperienceLevel.Beginner;
    void isBeginner; // explicit beginner is already the default

    entries.push({ discipline, level });
  }

  return { entries, unknown };
}

// ── Date helpers ─────────────────────────────────────────────────────────────

const MS_PER_DAY = 86400000;
const MS_PER_YEAR = 365.25 * MS_PER_DAY;

// Excel serial (days since 1899-12-30) → JS Date.
function excelSerialToDate(serial: number): Date {
  return new Date(Math.round((serial - 25569) * MS_PER_DAY));
}

// dob ≈ reference date minus the dog's age in years (form has age, not dob).
function dobFromAge(ageRaw: unknown, ref: Date): Date {
  const age = parseFloat(String(ageRaw).replace(",", "."));
  const years = Number.isFinite(age) && age > 0 ? age : 1; // fallback 1yr
  return new Date(ref.getTime() - years * MS_PER_YEAR);
}

// Tolerant day-first date parse for the rabies column (serial or d.m.y string).
function parseLooseDate(value: unknown): Date | undefined {
  if (typeof value === "number" && value > 0) return excelSerialToDate(value);
  const m = String(value).match(/(\d{1,4})[./-](\d{1,2})[./-](\d{1,4})/);
  if (!m) return undefined;
  let [, d, mo, y] = m.map(Number) as unknown as number[];
  if (y < 100) y += 2000;
  const date = new Date(y, mo - 1, d);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

// ── Sheet column mapping ─────────────────────────────────────────────────────

interface ColumnMap {
  name: number;
  dogName: number;
  phone: number;
  disciplines: number;
  age: number;
  rabies: number;
}

function findColumn(header: unknown[], ...needles: string[]): number {
  return header.findIndex((h) => needles.some((n) => String(h).includes(n)));
}

function mapColumns(header: unknown[]): ColumnMap {
  return {
    name: findColumn(header, "שם מלא"),
    dogName: findColumn(header, "שם הכלב"),
    phone: findColumn(header, "טלפון"),
    disciplines: findColumn(header, "מקצים"),
    age: findColumn(header, "גיל הכלב", "גיל הכלב"),
    rabies: findColumn(header, "כלבת"),
  };
}

// ── Import ───────────────────────────────────────────────────────────────────

// The registrations created by an import belong either to a standalone event
// or to a league's master roster (imported once, then cloned onto each round).
export type ImportTarget = { eventId: string } | { leagueId: string };

export async function importRoster(
  target: ImportTarget,
  buffer: Buffer,
  opts: { disciplineFilter?: Discipline } = {}
): Promise<ImportSummary> {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("Uploaded workbook has no sheets");

  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: "",
  });
  if (rows.length < 2) throw new Error("Sheet has no data rows");

  const cols = mapColumns(rows[0]);
  if (
    cols.name < 0 ||
    cols.dogName < 0 ||
    cols.phone < 0 ||
    cols.disciplines < 0
  ) {
    throw new Error(
      "Could not locate required columns (full name / dog name / phone / disciplines)"
    );
  }

  const now = new Date();
  const summary: ImportSummary = {
    playersCreated: 0,
    dogsCreated: 0,
    registrationsCreated: 0,
    registrationsSkippedDuplicate: 0,
    rowsProcessed: 0,
    unknownDisciplines: [],
    warnings: [],
  };

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const name = String(row[cols.name] ?? "").trim();
    const dogName = String(row[cols.dogName] ?? "").trim();
    const phone = String(row[cols.phone] ?? "").trim();
    const disciplinesCell = String(row[cols.disciplines] ?? "");

    if (!name || !phone || !dogName) continue; // skip blank/partial rows
    summary.rowsProcessed++;

    // Player — dedup by phone number.
    let player = await User.findOne({ phone_number: phone });
    if (!player) {
      player = await User.create({
        name,
        phone_number: phone,
        role: UserRole.Player,
      });
      summary.playersCreated++;
    }

    // Dog — dedup by (owner, name).
    const dob = cols.age >= 0 ? dobFromAge(row[cols.age], now) : new Date(now.getTime() - MS_PER_YEAR);
    const rabies = cols.rabies >= 0 ? parseLooseDate(row[cols.rabies]) : undefined;
    let dog = await Dog.findOne({ ownerId: player._id, name: dogName });
    if (!dog) {
      dog = await Dog.create({
        ownerId: player._id,
        name: dogName,
        dob,
        medical_status: rabies ? { rabies } : {},
      });
      summary.dogsCreated++;
    }

    // Registrations — one per parsed discipline, idempotent per event.
    const { entries, unknown } = parseDisciplines(disciplinesCell);
    for (const u of unknown) {
      summary.unknownDisciplines.push({ row: i + 1, token: u });
    }

    for (const entry of entries) {
      // League master roster only tracks the league's discipline (Distance).
      if (opts.disciplineFilter && entry.discipline !== opts.disciplineFilter) {
        continue;
      }
      const exists = await Registration.findOne({
        ...target,
        dogId: dog._id,
        discipline: entry.discipline,
        experienceLevel: entry.level,
      });
      if (exists) {
        summary.registrationsSkippedDuplicate++;
        continue;
      }
      await Registration.create({
        ...target,
        playerId: player._id,
        dogId: dog._id,
        discipline: entry.discipline,
        experienceLevel: entry.level,
      });
      summary.registrationsCreated++;
    }
  }

  if (summary.unknownDisciplines.length > 0) {
    const distinct = [
      ...new Set(summary.unknownDisciplines.map((u) => u.token)),
    ];
    summary.warnings.push(
      `Skipped ${summary.unknownDisciplines.length} unrecognised discipline entries: ${distinct.join(", ")}`
    );
  }

  return summary;
}
