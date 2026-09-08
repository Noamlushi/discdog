"use client";

import { useParams } from "next/navigation";
import { RequireAuth } from "../../../../../../components/auth/RequireAuth";
import { JudgeSessionProvider } from "../../../../../../context/JudgeSessionContext";
import { JudgeScopeProvider } from "../../../../../../context/JudgeScopeContext";
import { JudgeShell } from "../../../../../../components/judge/JudgeShell";
import { RoundMissing } from "../../../../../../components/league/RoundMissing";
import { useLeagueRound } from "../../../../../../lib/useLeagueRound";
import { leaguePath, leagueRoundPath } from "../../../../../../lib/leaguePaths";

// Judging one league round from its place in the tree:
// /l/:slug/:date/:round/judge/{,scoring,log}. Unlike /l/:slug/judge — which
// picks whichever round is active — this addresses one specific round, so an
// organizer can go back and finish an earlier one. Auth-gated to
// Admin/Organizer/Judge.
export default function LeagueRoundJudgeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { slug, date, round } = useParams<{
    slug: string;
    date: string;
    round: string;
  }>();
  const roundIndex = Number(round);
  const {
    league,
    date: leagueDate,
    event,
    loading,
    missing,
  } = useLeagueRound(slug, date, roundIndex);

  return (
    <RequireAuth roles={["Admin", "Organizer", "Judge"]}>
      {loading ? (
        <div dir="rtl" className="grid min-h-screen place-items-center text-muted">
          טוען…
        </div>
      ) : !league || !leagueDate || !event ? (
        <RoundMissing slug={slug} missing={missing} />
      ) : (
        <JudgeSessionProvider>
          <JudgeScopeProvider
            basePath={`${leagueRoundPath(
              league.slug,
              leagueDate.date,
              roundIndex
            )}/judge`}
            event={event}
            up={{ href: leaguePath(league.slug), label: "הליגה" }}
          >
            <JudgeShell>{children}</JudgeShell>
          </JudgeScopeProvider>
        </JudgeSessionProvider>
      )}
    </RequireAuth>
  );
}
