"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CalendarDays, Gavel, Radio, Undo2 } from "lucide-react";
import { getEvents, getLeagueBySlug } from "../../../../lib/api";
import type { EventDto, LeagueDateDto, LeagueDto } from "../../../../lib/types";
import { useAuth } from "../../../../context/AuthContext";
import {
  dateKey,
  dateLabel,
  leaguePath,
  leagueRoundPath,
} from "../../../../lib/leaguePaths";

// The middle level of the league tree (/l/:slug/:date) — one date (מועד) and
// the rounds under it. Reachable by trimming the round off any round URL, which
// is the point of the tree: every level of the address is a real page.
export default function LeagueDatePage() {
  const { slug, date } = useParams<{ slug: string; date: string }>();
  const { isManager } = useAuth();

  const [league, setLeague] = useState<LeagueDto | null>(null);
  const [leagueDate, setLeagueDate] = useState<LeagueDateDto | null>(null);
  const [rounds, setRounds] = useState<EventDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    async function load() {
      const lg = await getLeagueBySlug(slug);
      const d = lg.dates.find((x) => dateKey(x.date) === date) ?? null;
      const evs = d ? await getEvents({ leagueId: lg._id }) : [];
      if (!alive) return;
      setLeague(lg);
      setLeagueDate(d);
      setRounds(evs.filter((e) => e.leagueDateId === d?._id));
    }
    load()
      .catch(() => alive && setLeague(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [slug, date]);

  if (loading) {
    return (
      <div dir="rtl" className="grid min-h-screen place-items-center text-muted">
        טוען…
      </div>
    );
  }

  if (!league || !leagueDate) {
    return (
      <div
        dir="rtl"
        className="grid min-h-screen place-items-center px-6 text-center"
      >
        <div className="space-y-4">
          <p className="text-muted">
            {league ? "המועד הזה לא קיים בליגה" : "הליגה לא נמצאה"}
          </p>
          {league && (
            <Link href={leaguePath(league.slug)} className="ds-btn ds-btn-primary">
              <Undo2 className="h-5 w-5" />
              חזרה לעמוד הליגה
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="mx-auto max-w-3xl space-y-6 p-4">
      <nav className="flex items-center gap-2 text-sm font-semibold text-muted">
        <Link href={leaguePath(league.slug)} className="hover:text-accent">
          {league.name}
        </Link>
        <span>›</span>
        <span className="text-ink">{dateLabel(leagueDate)}</span>
      </nav>

      <header className="ds-card flex items-center gap-3 p-5">
        <CalendarDays className="h-6 w-6 shrink-0 text-accent" />
        <div>
          <h1 className="text-xl font-black">{dateLabel(leagueDate)}</h1>
          <p className="text-sm text-muted">
            {leagueDate.roundsCount} סבבים במועד הזה
          </p>
        </div>
      </header>

      <div className="space-y-3">
        {Array.from({ length: leagueDate.roundsCount }, (_, k) => k + 1).map(
          (roundIndex) => {
            const ev = rounds.find((e) => e.roundIndex === roundIndex);
            const base = leagueRoundPath(
              league.slug,
              leagueDate.date,
              roundIndex
            );
            return (
              <div
                key={roundIndex}
                className="ds-card flex items-center justify-between gap-3 p-4"
              >
                <span className="font-bold">סבב {roundIndex}</span>
                {ev ? (
                  <div className="flex items-center gap-2">
                    <Link
                      href={`${base}/live`}
                      className="rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-muted hover:border-accent/40 hover:text-ink"
                    >
                      <Radio className="ml-1 inline h-3.5 w-3.5" />
                      לייב
                    </Link>
                    {isManager && (
                      <Link
                        href={`${base}/judge`}
                        className="rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-muted hover:border-accent/40 hover:text-ink"
                      >
                        <Gavel className="ml-1 inline h-3.5 w-3.5" />
                        שיפוט
                      </Link>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-muted">
                    טרם נוצר — צרו אותו מעמוד הליגה
                  </span>
                )}
              </div>
            );
          }
        )}
      </div>
    </div>
  );
}
