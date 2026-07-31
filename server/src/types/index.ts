// Shared domain enums — mirror the enum fields defined in SPEC §4.

/** §4.1 User.role */
export enum UserRole {
  Admin = "Admin",
  // Organizer — runs a specific competition/league they've been assigned to
  // (import roster, generate schedule, judge). Scoped by ownership, see
  // middleware/requireManager. (§3.1)
  Organizer = "Organizer",
  Judge = "Judge",
  Player = "Player",
}

/**
 * Decoded JWT payload attached to `req.user` by the `authenticate` middleware
 * (§9.3). `sub` is the User `_id`.
 */
export interface AuthPayload {
  sub: string;
  role: UserRole;
  name: string;
}

/** §4.3 Event.status */
export enum EventStatus {
  Planning = "Planning",
  Live = "Live",
  Completed = "Completed",
}

/** §4.4 Match.experienceLevel */
export enum ExperienceLevel {
  Beginner = "Beginner",
  Advanced = "Advanced",
}

/** §4.4 Match.status */
export enum MatchStatus {
  Pending = "Pending",
  OnDeck = "On-Deck",
  Live = "Live",
  Completed = "Completed",
}

/**
 * The ten J'Games disciplines (מקצים) defined in the 2026 rulebook
 * (`J Games ספר חוקים מעודכן 2026 .pdf`). Used as `Match.categoryId` and as the
 * dispatch key into the per-discipline scoring modules in `src/scoring/`.
 */
export enum Discipline {
  Distance = "Distance", // דיסטנס — zones 1–5, 5 throws, max 25
  IceDrop = "IceDrop", // Ice Drop — zones 1–5, 5 throws, max 25
  MultipleChallenge = "MultipleChallenge", // מולטיפול צ'אלנג' — timed 4-catch sequence
  Agility = "Agility", // פריזג'יליטי — obstacles + zone catches
  WheelOfFortune = "WheelOfFortune", // גלגל המזל — outer/inner area catches
  JTrail = "JTrail", // J'Trail — timed catches past 20m + 8-team finals
  Shuffle = "Shuffle", // שאפל ב-30 — catch count in 30s
  CrissCross = "CrissCross", // קריס קרוס — numbered-zone cross pattern
  TimeTrail = "TimeTrail", // Time Trail — timed catches past 18m + 16-team finals
  Freestyle = "Freestyle", // פריסטייל — 4-judge panel out of 40
}

/**
 * Ranking direction for a discipline's `finalScore`:
 * - `desc` — higher is better (point-based disciplines).
 * - `asc`  — lower is better (timed disciplines; value is elapsed seconds).
 */
export type ScoreDirection = "desc" | "asc";
