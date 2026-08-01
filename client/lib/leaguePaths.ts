import type { EventDto, LeagueDateDto, LeagueDto } from "./types";

// League URLs are a tree that mirrors the data model — league → date → round:
//
//   /l/:slug                        the league
//   /l/:slug/standings              league standings
//   /l/:slug/2026-07-25             one date (מועד)
//   /l/:slug/2026-07-25/1           round 1 of that date
//   /l/:slug/2026-07-25/1/judge     judging that round
//
// A round is an ordinary Event, but it is never addressed by its own random
// slug — the path carries which league and which date it belongs to, so the
// relationship is visible in the URL and every level is reachable by trimming
// a segment off the end.

/**
 * The date segment: the calendar day of a league date, `YYYY-MM-DD`. Sliced
 * straight off the stored ISO string rather than going through `new Date()`,
 * so the segment can never drift a day across timezones.
 */
export function dateKey(date: string): string {
  return String(date).slice(0, 10);
}

/** The league root — `/l/:slug`. */
export function leaguePath(leagueSlug: string): string {
  return `/l/${leagueSlug}`;
}

/** One date within a league — `/l/:slug/:date`. */
export function leagueDatePath(leagueSlug: string, date: string): string {
  return `${leaguePath(leagueSlug)}/${dateKey(date)}`;
}

/** One round of one date — `/l/:slug/:date/:round`. */
export function leagueRoundPath(
  leagueSlug: string,
  date: string,
  roundIndex: number
): string {
  return `${leagueDatePath(leagueSlug, date)}/${roundIndex}`;
}

/** Find the league date a round Event belongs to. */
export function findRoundDate(
  league: LeagueDto,
  event: Pick<EventDto, "leagueDateId">
): LeagueDateDto | undefined {
  return league.dates.find((d) => d._id === event.leagueDateId);
}

/**
 * The tree path for a round Event, or null when the event isn't a league round
 * (a standalone competition) or its date has since been removed.
 */
export function roundPathForEvent(
  league: LeagueDto,
  event: Pick<EventDto, "leagueDateId" | "roundIndex">
): string | null {
  const date = findRoundDate(league, event);
  if (!date || !event.roundIndex) return null;
  return leagueRoundPath(league.slug, date.date, event.roundIndex);
}

/** Human label for a date segment, e.g. "25 ביולי 2026". */
export function dateLabel(d: LeagueDateDto): string {
  return (
    d.label?.trim() ||
    new Date(d.date).toLocaleDateString("he-IL", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  );
}
