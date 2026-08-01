"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getEvents, getLeagueBySlug } from "../../../../lib/api";
import type { EventDto } from "../../../../lib/types";
import { RequireAuth } from "../../../../components/auth/RequireAuth";
import { JudgeSessionProvider } from "../../../../context/JudgeSessionContext";
import { JudgeScopeProvider } from "../../../../context/JudgeScopeContext";
import { JudgeShell } from "../../../../components/judge/JudgeShell";

// Scoped league judging (/l/:slug/judge/{,scoring,log}). Locks the judge session
// to the league's currently-active round (a round Event that is Live, else the
// latest generated one) — same resolution as the league live dashboard. No
// competition picker; auth-gated to Admin/Organizer/Judge.
export default function LeagueJudgeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
      setRound(
        rounds.find((e) => e.status === "Live") ??
          rounds[rounds.length - 1] ??
          null
      );
    }
    load()
      .catch(() => active && setRound(null))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [slug]);

  return (
    <RequireAuth roles={["Admin", "Organizer", "Judge"]}>
      {loading ? (
        <div dir="rtl" className="grid min-h-screen place-items-center text-muted">
          טוען…
        </div>
      ) : !round ? (
        <div
          dir="rtl"
          className="grid min-h-screen place-items-center px-6 text-center text-muted"
        >
          אין סבב פעיל כרגע. צור סבב מעמוד הליגה כדי להתחיל בשיפוט.
        </div>
      ) : (
        <JudgeSessionProvider>
          <JudgeScopeProvider
            basePath={`/l/${slug}/judge`}
            event={round}
            up={{ href: `/l/${slug}`, label: "הליגה" }}
          >
            <JudgeShell>{children}</JudgeShell>
          </JudgeScopeProvider>
        </JudgeSessionProvider>
      )}
    </RequireAuth>
  );
}
