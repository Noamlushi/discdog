"use client";

import { useEffect, useState } from "react";
import { getEvents, getLeagueBySlug } from "./api";
import { dateKey } from "./leaguePaths";
import type { EventDto, LeagueDateDto, LeagueDto } from "./types";

export interface LeagueRoundResolution {
  league: LeagueDto | null;
  date: LeagueDateDto | null;
  /** The round Event, or null when this round hasn't been generated yet. */
  event: EventDto | null;
  loading: boolean;
  /** Which part of the tree could not be resolved, if any. */
  missing: "league" | "date" | "round" | null;
}

/**
 * Resolve a `/l/:slug/:date/:round` path back to its league, date and round
 * Event. Every level is reported separately so a page can say precisely what is
 * wrong — an unknown league, a date that was removed, or a round that simply
 * hasn't been generated yet (the common, non-error case).
 */
export function useLeagueRound(
  slug: string,
  dateSegment: string,
  roundIndex: number
): LeagueRoundResolution {
  const [state, setState] = useState<LeagueRoundResolution>({
    league: null,
    date: null,
    event: null,
    loading: true,
    missing: null,
  });

  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true }));

    async function load(): Promise<LeagueRoundResolution> {
      const league = await getLeagueBySlug(slug);
      const date =
        league.dates.find((d) => dateKey(d.date) === dateSegment) ?? null;
      if (!date) {
        return { league, date: null, event: null, loading: false, missing: "date" };
      }

      const rounds = await getEvents({ leagueId: league._id });
      const event =
        rounds.find(
          (e) => e.leagueDateId === date._id && e.roundIndex === roundIndex
        ) ?? null;

      return {
        league,
        date,
        event,
        loading: false,
        missing: event ? null : "round",
      };
    }

    load()
      .then((r) => alive && setState(r))
      .catch(
        () =>
          alive &&
          setState({
            league: null,
            date: null,
            event: null,
            loading: false,
            missing: "league",
          })
      );

    return () => {
      alive = false;
    };
  }, [slug, dateSegment, roundIndex]);

  return state;
}
