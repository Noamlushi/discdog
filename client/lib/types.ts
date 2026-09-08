// Shapes returned by the J'GAMES API (server JSON), used across the client.

export type ExperienceLevel = "Beginner" | "Advanced";
export type MatchStatus = "Pending" | "On-Deck" | "Live" | "Completed";
export type UserRole = "Admin" | "Organizer" | "Judge" | "Player";

/** The logged-in account (§9.3). */
export interface AuthUser {
  _id: string;
  name: string;
  email?: string;
  role: UserRole;
}

/** An Organizer option for the assign-organizer UI. */
export interface OrganizerDto {
  _id: string;
  name: string;
  email?: string;
}

export interface EventDto {
  _id: string;
  name: string;
  slug?: string;
  ownerId?: string;
  organizerIds?: string[];
  status: "Planning" | "Live" | "Completed";
  estimatedStartTime: string;
  estimatedEndTime: string;
  activePitches: number;
  minRestTimeMinutes: number;
  calculatedMinDuration?: number;
  // Present when this Event is a league round.
  leagueId?: string;
  leagueDateId?: string;
  roundIndex?: number;
}

/** Summary returned by roster import (event or league). */
export interface ImportSummary {
  playersCreated: number;
  dogsCreated: number;
  registrationsCreated: number;
  registrationsSkippedDuplicate: number;
  rowsProcessed: number;
  unknownDisciplines: { row: number; token: string }[];
  warnings: string[];
}

// ── Distance League ──────────────────────────────────────────────────────────
export interface LeagueDateDto {
  _id: string;
  date: string;
  roundsCount: number;
  label?: string;
}

export interface LeagueDto {
  _id: string;
  name: string;
  slug: string;
  ownerId?: string;
  organizerIds?: string[];
  categoryId: string;
  experienceLevels: ExperienceLevel[];
  dates: LeagueDateDto[];
  scoring: { mode: "bestOf" | "sum"; bestN: number };
  minRestTimeMinutes: number;
  activePitches: number;
  status: "Planning" | "Live" | "Completed";
}

/** One team on the league master roster (manual add / spreadsheet import). */
export interface LeagueRosterEntryDto {
  _id: string;
  playerId: string | null;
  playerName: string | null;
  dogId: string | null;
  dogName: string | null;
  experienceLevel: ExperienceLevel;
}

/** One canonical round column (date→round order), shown whether run yet or not. */
export interface LeagueRoundColumn {
  key: string;
  dateId: string;
  dateLabel: string;
  roundIndex: number;
  seq: number;
  eventId: string | null;
}
/** A team's score in one round column — matchId enables organizer drill-down. */
export interface LeagueRoundCell {
  score: number;
  matchId: string;
}
export interface LeagueTeamStanding {
  rank: number;
  player: string | null;
  dog: string | null;
  aggregate: number;
  display: string;
  attended: number;
  cells: Record<string, LeagueRoundCell>;
}
export interface LeagueStandingsResponse {
  leagueId: string;
  name: string;
  scoring: { mode: "bestOf" | "sum"; bestN: number };
  roundsTotal: number;
  rounds: LeagueRoundColumn[];
  levels: Record<ExperienceLevel, LeagueTeamStanding[]>;
}

/** GET /leagues/:id/summary — league-wide run statistics (league-summary.service.ts). */
export interface LeagueSummaryLeader {
  player: string | null;
  dog: string | null;
  value: number;
  display: string;
  detail?: string;
}

export interface LeagueSummaryRound {
  key: string;
  label: string;
  seq: number;
  teams: number;
  average: number;
  averageDisplay: string;
  best: number | null;
  bestDisplay: string | null;
  bestTeam: string | null;
}

export interface LeagueSummaryResponse {
  leagueId: string;
  name: string;
  generatedAt: string;
  hasData: boolean;
  overview: {
    dates: number;
    roundsConfigured: number;
    roundsRun: number;
    teams: number;
    heats: number;
    throws: number;
    catches: number;
    misses: number;
    catchRate: number;
    averageScore: number;
    averageScoreDisplay: string;
  };
  rounds: LeagueSummaryRound[];
  records: {
    topScores: LeagueSummaryLeader[];
    bestThrow: LeagueSummaryLeader | null;
    mostConsistent: LeagueSummaryLeader | null;
    biggestImprovement: LeagueSummaryLeader | null;
    perLevelTop: { level: string; row: LeagueSummaryLeader | null }[];
  };
  catching: {
    bestRate: LeagueSummaryLeader[];
    perRound: { key: string; label: string; catchRate: number }[];
  };
  zones: {
    counts: { zone: number; label: string; throws: number; share: number }[];
    jumpBonuses: number;
    zoneBonuses: number;
    farThrows: number;
    farShare: number;
  };
}

/** A populated User/Dog reference (or a bare id string before population). */
export type NamedRef = { _id?: string; name?: string } | string | null;

export interface HeatDto {
  _id: string;
  eventId: string;
  categoryId: string; // Discipline key
  experienceLevel: ExperienceLevel;
  pitchNumber: number;
  scheduledTime: string;
  status: MatchStatus;
  /** Wall-clock ISO when the heat went Live — powers the spectator countdown. */
  liveStartedAt?: string | null;
  finalScore?: number | string | null;
  isFinalsPlaceholder: boolean;
  team?: { playerId?: NamedRef; dogId?: NamedRef };
}

/** Payload of the match_status_changed socket event (heats.routes.ts). */
export interface MatchStatusPayload {
  matchId: string;
  eventId: string;
  pitchNumber: number;
  categoryId: string;
  experienceLevel: ExperienceLevel;
  status: MatchStatus;
  liveStartedAt?: string | null;
  finalScore?: number | string | null;
  team?: { playerId?: NamedRef; dogId?: NamedRef };
  nextOnDeck?: {
    matchId: string;
    scheduledTime: string;
    team?: { playerId?: NamedRef; dogId?: NamedRef };
  } | null;
}

/** Response from POST /scoring/action and /scoring/undo. */
export interface ScoreResponse {
  score: number | null;
  display: string;
  breakdown: Record<string, number> | null;
}

/** Payload of the live_score_updated / freestyle_sync socket events. */
export interface LiveScorePayload {
  matchId: string;
  eventId: string;
  categoryId: string;
  score: number | null;
  display: string;
  breakdown: Record<string, number> | null;
}

/** One persisted judging action with its run-clock timestamp (review timeline). */
export interface TimelineEntry {
  timestamp: string; // run-clock at the tap, e.g. "00:45"
  actionData: Record<string, unknown>;
  at?: string; // wall-clock ISO
}

/** Response from GET /scoring/:matchId — heat review (score + timeline). */
export interface HeatStats {
  matchId: string;
  eventId: string;
  categoryId: string;
  score: number | null;
  display: string;
  breakdown: Record<string, number> | null;
  timeline: TimelineEntry[];
}

/** One ranked team within a discipline/level leaderboard (§3.4). */
export interface RankedEntry {
  rank: number;
  matchId: string;
  pitchNumber: number;
  score: number;
  display: string;
  player: string | null;
  dog: string | null;
}

/** A discipline's leaderboards, split by experience level. */
export interface LeaderboardCategory {
  categoryId: string;
  nameHe: string;
  direction: "asc" | "desc";
  levels: Record<ExperienceLevel, RankedEntry[]>;
}

/** Response from GET /api/leaderboards/:eventId. */
export interface LeaderboardsResponse {
  eventId: string;
  categories: LeaderboardCategory[];
}

/** Read the display name from a populated ref. */
export function refName(ref: NamedRef | undefined): string | null {
  if (!ref || typeof ref === "string") return null;
  return ref.name ?? null;
}
