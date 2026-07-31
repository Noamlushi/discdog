"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getEvents, getLeagueBySlug } from "../../../../../lib/api";
import type { EventDto } from "../../../../../lib/types";
import { LiveSessionProvider } from "../../../../../context/LiveSessionContext";
import LiveNowView from "../../../../../components/live/LiveNowView";

// League live view — shows the "live now" dashboard of the league's currently
// active round (a round Event that is Live, else the most recent one). Locked to
// that round via the session provider; reuses the standalone Live Now dashboard.
export default function LeagueLivePage() {
  const { slug } = useParams<{ slug: string }>();
  const [round, setRound] = useState<EventDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      const lg = await getLeagueBySlug(slug);
      const rounds = await getEvents({ leagueId: lg._id });
      if (!active) return;
      // Prefer a round that's Live now; else the latest generated round.
      const pick =
        rounds.find((e) => e.status === "Live") ??
        rounds[rounds.length - 1] ??
        null;
      setRound(pick);
    }
    load().finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [slug]);

  if (loading) {
    return <p className="py-16 text-center text-cocoa/50">טוען…</p>;
  }
  if (!round) {
    return (
      <p className="py-16 text-center text-cocoa/50">
        אין סבב פעיל כרגע. צור סבב מעמוד הליגה כדי לראות שידור חי.
      </p>
    );
  }

  return (
    <LiveSessionProvider fixedEventId={round._id}>
      <div className="mb-3 rounded-2xl bg-sunset/10 px-4 py-2 text-sm font-bold text-sunset">
        {round.name}
      </div>
      <LiveNowView />
    </LiveSessionProvider>
  );
}
