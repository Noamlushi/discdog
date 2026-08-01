"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getLeague } from "./api";
import { roundPathForEvent } from "./leaguePaths";
import type { EventDto } from "./types";

/**
 * League rounds moved from their own `/c/:eventSlug` address into the league
 * tree (`/l/:leagueSlug/:date/:round`). Old links stay alive: any `/c/:slug/*`
 * page that resolves to a league round sends the visitor to the matching spot
 * in the tree, keeping whatever sub-view they asked for (`/live`, `/judge`,
 * `/judge/scoring`, …).
 *
 * Returns true while the redirect is being resolved or performed, so the caller
 * can hold its own render instead of flashing the old page first.
 */
export function useLeagueRoundRedirect(
  event: EventDto | null,
  slug: string
): boolean {
  const router = useRouter();
  const pathname = usePathname();
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    // Standalone competitions keep living at /c/:slug — nothing to do.
    if (!event?.leagueId) {
      setRedirecting(false);
      return;
    }

    let alive = true;
    setRedirecting(true);

    getLeague(event.leagueId)
      .then((league) => {
        if (!alive) return;
        const base = roundPathForEvent(league, event);
        if (!base) {
          setRedirecting(false);
          return;
        }
        // Carry the sub-view across: /c/x/judge/scoring → <base>/judge/scoring.
        const suffix = pathname.startsWith(`/c/${slug}`)
          ? pathname.slice(`/c/${slug}`.length)
          : "";
        router.replace(`${base}${suffix}`);
      })
      .catch(() => alive && setRedirecting(false));

    return () => {
      alive = false;
    };
    // pathname is deliberately not a dependency: the redirect fires once per
    // resolved event, and re-running it mid-navigation would fight the router.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?._id, event?.leagueId, slug]);

  return redirecting;
}
