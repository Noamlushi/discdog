import type { ExperienceLevel } from "./types";

// Client-side discipline metadata — drives the per-discipline judge UI (labels,
// run-timer durations, and which scorer component to render). Mirrors the
// rulebook values encoded on the server (src/scoring/*). One entry per category.

export type ScorerFamily =
  | "zones" // Distance, Ice Drop — 5-zone map + bonuses
  | "count" // Shuffle — catch counter
  | "area" // Wheel of Fortune — outer/inner
  | "agility" // Agility — obstacles + zone catches
  | "crisscross" // Criss Cross — numbered zones + jackpot
  | "timed" // Multiple Challenge, J'Trail, Time Trail — stopwatch
  | "panel"; // Freestyle — 4-judge panel /40

export interface DisciplineUi {
  key: string;
  nameHe: string;
  family: ScorerFamily;
  /** Run length in seconds. A single number, or per level for Freestyle. */
  duration: number | Record<ExperienceLevel, number>;
  /** Whether scoring is time-based (lower is better). */
  timed: boolean;
}

export const DISCIPLINES: Record<string, DisciplineUi> = {
  Distance: { key: "Distance", nameHe: "דיסטנס", family: "zones", duration: 90, timed: false },
  IceDrop: { key: "IceDrop", nameHe: "Ice Drop", family: "zones", duration: 90, timed: false },
  Shuffle: { key: "Shuffle", nameHe: "שאפל ב-30", family: "count", duration: 30, timed: false },
  WheelOfFortune: { key: "WheelOfFortune", nameHe: "גלגל המזל", family: "area", duration: 60, timed: false },
  Agility: { key: "Agility", nameHe: "פריזג'יליטי", family: "agility", duration: 60, timed: false },
  CrissCross: { key: "CrissCross", nameHe: "קריס קרוס", family: "crisscross", duration: 60, timed: false },
  MultipleChallenge: { key: "MultipleChallenge", nameHe: "מולטיפול צ'אלנג'", family: "timed", duration: 60, timed: true },
  JTrail: { key: "JTrail", nameHe: "J'Trail", family: "timed", duration: 60, timed: true },
  TimeTrail: { key: "TimeTrail", nameHe: "Time Trail", family: "timed", duration: 60, timed: true },
  Freestyle: {
    key: "Freestyle",
    nameHe: "פריסטייל",
    family: "panel",
    duration: { Beginner: 90, Advanced: 120 },
    timed: false,
  },
};

export function disciplineOf(categoryId: string): DisciplineUi | undefined {
  return DISCIPLINES[categoryId];
}

/** Resolve a discipline's run duration for a given level. */
export function durationSeconds(
  categoryId: string,
  level: ExperienceLevel
): number {
  const d = DISCIPLINES[categoryId];
  if (!d) return 60;
  return typeof d.duration === "number" ? d.duration : d.duration[level];
}

/** Hebrew labels for the two experience levels (§4). */
export const LEVEL_HE: Record<ExperienceLevel, string> = {
  Beginner: "מתחילים",
  Advanced: "מתקדמים",
};

/** Format seconds as mm:ss. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}
