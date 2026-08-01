import type {
  AuthUser,
  EventDto,
  ExperienceLevel,
  HeatDto,
  HeatStats,
  ImportSummary,
  LeaderboardsResponse,
  LeagueDto,
  LeagueRosterEntryDto,
  LeagueStandingsResponse,
  MatchStatus,
  OrganizerDto,
  ScoreResponse,
} from "./types";

// REST client for the J'GAMES API. Base mirrors the socket origin (§2.1 — REST
// and WebSocket share one origin).
const API_BASE =
  (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000") + "/api";

// ── Auth token (§9.3) ────────────────────────────────────────────────────────
const TOKEN_KEY = "jgames_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
}

// Merge the bearer token (when present) into request headers.
function authHeaders(extra?: HeadersInit): HeadersInit {
  const token = getToken();
  return {
    ...(extra ?? {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(API_BASE + path, {
    cache: "no-store",
    ...init,
    headers: authHeaders({ "Content-Type": "application/json", ...init?.headers }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

// Multipart upload (roster import) — never set Content-Type; the browser adds the
// multipart boundary. Still carries the bearer token.
async function upload<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(API_BASE + path, {
    method: "POST",
    cache: "no-store",
    headers: authHeaders(),
    body: form,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

// ── Auth endpoints ───────────────────────────────────────────────────────────
export const login = (email: string, password: string) =>
  request<{ token: string; user: AuthUser }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

export const fetchMe = () => request<AuthUser>("/auth/me");

export const registerUser = (input: {
  name: string;
  email: string;
  password: string;
  role: string;
  phone_number?: string;
}) =>
  request<AuthUser>("/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });

export const getOrganizers = () =>
  request<OrganizerDto[]>("/auth/organizers");

export const getEvents = (params?: { leagueId?: string }) =>
  request<EventDto[]>(
    params?.leagueId ? `/events?leagueId=${params.leagueId}` : "/events"
  );

export const getEvent = (id: string) => request<EventDto>(`/events/${id}`);

export function getHeats(params: {
  eventId?: string;
  pitch?: number;
  status?: MatchStatus;
}): Promise<HeatDto[]> {
  const q = new URLSearchParams();
  if (params.eventId) q.set("eventId", params.eventId);
  if (params.pitch !== undefined) q.set("pitch", String(params.pitch));
  if (params.status) q.set("status", params.status);
  return request<HeatDto[]>(`/heats?${q.toString()}`);
}

export const setHeatStatus = (
  id: string,
  status: MatchStatus,
  elapsedSeconds?: number
) =>
  request<HeatDto>(`/heats/${id}/status`, {
    method: "PUT",
    body: JSON.stringify({ status, elapsedSeconds }),
  });

export const postScoringAction = (
  matchId: string,
  timestamp: string,
  actionData: Record<string, unknown>
) =>
  request<ScoreResponse>("/scoring/action", {
    method: "POST",
    body: JSON.stringify({ matchId, timestamp, actionData }),
  });

/**
 * Rewrite the last logged action in place — used by Distance/Ice Drop, where
 * the zone is logged the instant the dog catches and the +0.5 bonuses are added
 * to that same throw a moment later.
 */
export const amendScoringAction = (
  matchId: string,
  actionData: Record<string, unknown>
) =>
  request<ScoreResponse>("/scoring/amend", {
    method: "POST",
    body: JSON.stringify({ matchId, actionData }),
  });

export const undoScoringAction = (matchId: string) =>
  request<ScoreResponse>("/scoring/undo", {
    method: "POST",
    body: JSON.stringify({ matchId }),
  });

/** Heat review — score, catches/misses breakdown, and the throw timeline. */
export const getHeatStats = (matchId: string) =>
  request<HeatStats>(`/scoring/${matchId}`);

/** Ranked leaderboards per discipline/level for the public live view (§3.4). */
export const getLeaderboards = (eventId: string) =>
  request<LeaderboardsResponse>(`/leaderboards/${eventId}`);

// ── Events (competition portal) ──────────────────────────────────────────────
export const getEventBySlug = (slug: string) =>
  request<EventDto>(`/events/slug/${slug}`);

export const createEvent = (input: {
  name: string;
  estimatedStartTime: string;
  estimatedEndTime: string;
  minRestTimeMinutes?: number;
  activePitches?: number;
  organizerIds?: string[];
}) =>
  request<EventDto>("/events", {
    method: "POST",
    body: JSON.stringify(input),
  });

export const deleteEvent = (eventId: string) =>
  request<{
    ok: true;
    deleted: {
      event: number;
      matches: number;
      actionLogs: number;
      registrations: number;
    };
  }>(`/events/${eventId}`, { method: "DELETE" });

export const assignEventOrganizers = (eventId: string, organizerIds: string[]) =>
  request<EventDto>(`/events/${eventId}/organizers`, {
    method: "PATCH",
    body: JSON.stringify({ organizerIds }),
  });

export const addEventRegistration = (
  eventId: string,
  input: {
    playerName: string;
    phone: string;
    dogName: string;
    dogAgeYears?: number;
    entries: { discipline: string; level?: ExperienceLevel }[];
  }
) =>
  request<{
    playerCreated: boolean;
    dogCreated: boolean;
    registrationsCreated: number;
    registrationsSkippedDuplicate: number;
    invalidDisciplines: string[];
  }>(`/events/${eventId}/registrations`, {
    method: "POST",
    body: JSON.stringify(input),
  });

export const importEventRoster = (eventId: string, file: File) => {
  const form = new FormData();
  form.append("file", file);
  form.append("eventId", eventId);
  return upload<ImportSummary>("/events/import", form);
};

// ── Distance League ──────────────────────────────────────────────────────────
export const getLeagues = () => request<LeagueDto[]>("/leagues");

export const getLeague = (id: string) => request<LeagueDto>(`/leagues/${id}`);

export const getLeagueBySlug = (slug: string) =>
  request<LeagueDto>(`/leagues/slug/${slug}`);

export const createLeague = (input: {
  name: string;
  /** Chosen URL for the league — the root of its round tree. */
  slug?: string;
  dates: { date: string; roundsCount: number; label?: string }[];
  scoring: { mode: "bestOf" | "sum"; bestN: number };
  experienceLevels?: string[];
  minRestTimeMinutes?: number;
  activePitches?: number;
  organizerIds?: string[];
}) =>
  request<LeagueDto>("/leagues", {
    method: "POST",
    body: JSON.stringify(input),
  });

export const updateLeague = (id: string, patch: Partial<{
  name: string;
  /** Renaming this moves the whole round tree — old /l/:slug links stop working. */
  slug: string;
  dates: { date: string; roundsCount: number; label?: string }[];
  scoring: { mode: "bestOf" | "sum"; bestN: number };
  experienceLevels: string[];
  minRestTimeMinutes: number;
  activePitches: number;
}>) =>
  request<LeagueDto>(`/leagues/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });

export const importLeagueRoster = (leagueId: string, file: File) => {
  const form = new FormData();
  form.append("file", file);
  return upload<ImportSummary>(`/leagues/${leagueId}/import`, form);
};

// Master-roster manual management — list, add one team, remove one team.
export const getLeagueRoster = (leagueId: string) =>
  request<LeagueRosterEntryDto[]>(`/leagues/${leagueId}/roster`);

export const addLeagueRosterEntry = (
  leagueId: string,
  input: {
    playerName: string;
    dogName: string;
    phone?: string;
    experienceLevel?: "Beginner" | "Advanced";
  }
) =>
  request<LeagueRosterEntryDto>(`/leagues/${leagueId}/roster`, {
    method: "POST",
    body: JSON.stringify(input),
  });

export const deleteLeagueRosterEntry = (leagueId: string, regId: string) =>
  request<{ ok: true }>(`/leagues/${leagueId}/roster/${regId}`, {
    method: "DELETE",
  });

export const generateLeagueRound = (
  leagueId: string,
  dateId: string,
  roundIndex: number
) =>
  request<{ event: { _id: string; name: string; slug: string }; report: unknown }>(
    `/leagues/${leagueId}/rounds/generate`,
    { method: "POST", body: JSON.stringify({ dateId, roundIndex }) }
  );

export const getLeagueStandings = (id: string) =>
  request<LeagueStandingsResponse>(`/leagues/${id}/standings`);

export const deleteLeague = (id: string) =>
  request<{
    ok: true;
    deleted: {
      league: number;
      events: number;
      matches: number;
      actionLogs: number;
      registrations: number;
    };
  }>(`/leagues/${id}`, { method: "DELETE" });
