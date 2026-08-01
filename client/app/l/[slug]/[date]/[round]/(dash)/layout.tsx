"use client";

import { useParams } from "next/navigation";
import { CalendarRange, Gavel, Radio, Trophy, Undo2 } from "lucide-react";
import { useAuth } from "../../../../../../context/AuthContext";
import { LiveSessionProvider } from "../../../../../../context/LiveSessionContext";
import {
  ScopedLiveShell,
  type ScopedNavItem,
} from "../../../../../../components/live/ScopedLiveShell";
import { RoundMissing } from "../../../../../../components/league/RoundMissing";
import { useLeagueRound } from "../../../../../../lib/useLeagueRound";
import {
  dateLabel,
  leaguePath,
  leagueRoundPath,
} from "../../../../../../lib/leaguePaths";

// Dashboards for one league round, addressed by its place in the league tree:
// /l/:slug/:date/:round/{live,leaderboard,schedule}. Locked to that round's
// Event — no picker — and the nav's first item climbs back up to the league.
export default function LeagueRoundDashLayout({
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
  const { isManager } = useAuth();
  const {
    league,
    date: leagueDate,
    event,
    loading,
    missing,
  } = useLeagueRound(slug, date, roundIndex);

  if (loading) {
    return (
      <div dir="rtl" className="grid min-h-screen place-items-center text-muted">
        טוען…
      </div>
    );
  }
  if (!league || !leagueDate || !event) {
    return <RoundMissing slug={slug} missing={missing} />;
  }

  const base = leagueRoundPath(league.slug, leagueDate.date, roundIndex);
  const nav: ScopedNavItem[] = [
    { href: leaguePath(league.slug), label: "הליגה", icon: Undo2 },
    { href: `${base}/live`, label: "לייב", icon: Radio },
    { href: `${base}/leaderboard`, label: "טבלת תוצאות", icon: Trophy },
    { href: `${base}/schedule`, label: "לוח זמנים", icon: CalendarRange },
    ...(isManager
      ? [{ href: `${base}/judge`, label: "שיפוט", icon: Gavel }]
      : []),
  ];

  return (
    <LiveSessionProvider fixedEventId={event._id}>
      <ScopedLiveShell
        title={league.name}
        subtitle={`${dateLabel(leagueDate)} · סבב ${roundIndex}`}
        nav={nav}
      >
        {children}
      </ScopedLiveShell>
    </LiveSessionProvider>
  );
}
