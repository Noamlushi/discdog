"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  BarChart3,
  ChevronRight,
  Crosshair,
  Flame,
  Hand,
  Medal,
  Target,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";

import { getLeagueBySlug, getLeagueSummary } from "../../../../lib/api";
import type {
  LeagueSummaryLeader,
  LeagueSummaryResponse,
} from "../../../../lib/types";
import { LEVEL_HE } from "../../../../lib/disciplines";

// /l/:slug/summary — the league's run statistics across every date and round.
// The standings tab answers "who is winning"; this answers "how did the league
// actually go" — where the discs landed, how often the dogs caught them, and
// who got better between rounds. Public: it is the page an organizer sends
// round to the group after a date.
export default function LeagueSummaryPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [data, setData] = useState<LeagueSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLeagueBySlug(slug)
      .then((lg) => getLeagueSummary(lg._id))
      .then(setData)
      .catch(() => router.replace("/"))
      .finally(() => setLoading(false));
  }, [slug, router]);

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-arena text-muted">
        טוען…
      </main>
    );
  }
  if (!data) return null;

  const { overview, rounds, records, catching, zones } = data;

  return (
    <main dir="rtl" className="min-h-screen bg-arena text-ink">
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-14">
        <nav className="mb-6 flex flex-wrap items-center gap-1 text-sm text-muted">
          <Link href="/" className="hover:text-accent">
            תחרויות
          </Link>
          <ChevronRight className="h-4 w-4 rotate-180" />
          <Link href={`/l/${slug}`} className="hover:text-accent">
            {data.name}
          </Link>
          <ChevronRight className="h-4 w-4 rotate-180" />
          <span className="text-ink">סיכום וסטטיסטיקות</span>
        </nav>

        <div className="mb-8 flex items-center gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-lime to-lime-bright text-lime-ink shadow-glow">
            <BarChart3 className="h-7 w-7" />
          </span>
          <div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
              סיכום הליגה
            </h1>
            <p className="text-sm font-semibold text-muted">
              {data.name} · {overview.roundsRun} מתוך {overview.roundsConfigured}{" "}
              סבבים הושלמו
            </p>
          </div>
        </div>

        {!data.hasData ? (
          <p className="ds-card p-8 text-center text-muted">
            עדיין אין סבבים שהושלמו בליגה הזו. הסטטיסטיקות יופיעו כאן ברגע שהמקצה
            הראשון יסתיים.
          </p>
        ) : (
          <div className="space-y-8">
            {/* ---- headline numbers ---- */}
            <section>
              <h2 className="ds-label mb-3">במבט אחד</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat
                  icon={Users}
                  label="צוותים"
                  value={String(overview.teams)}
                  hint={`${overview.heats} ריצות`}
                />
                <Stat
                  icon={Target}
                  label="זריקות"
                  value={String(overview.throws)}
                  hint={`${overview.catches} נתפסו`}
                />
                <Stat
                  icon={Hand}
                  label="אחוז תפיסה"
                  value={`${Math.round(overview.catchRate)}%`}
                  hint={`${overview.misses} החטאות`}
                  accent
                />
                <Stat
                  icon={Trophy}
                  label="ציון ממוצע"
                  value={overview.averageScoreDisplay}
                  hint="לריצה"
                />
              </div>
            </section>

            {/* ---- round comparison ---- */}
            <section>
              <h2 className="ds-label mb-3">השוואה בין סבבים</h2>
              <div className="ds-card space-y-3 p-5">
                {rounds.map((r) => {
                  const max = Math.max(...rounds.map((x) => x.average), 1);
                  const rate = catching.perRound.find(
                    (p) => p.key === r.key
                  )?.catchRate;
                  return (
                    <div key={r.key} className="space-y-1.5">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                        <span className="text-sm font-bold">{r.label}</span>
                        <span className="text-xs text-muted">
                          {r.teams} צוותים
                          {rate != null && ` · ${Math.round(rate)}% תפיסה`}
                          {r.bestTeam && ` · שיא: ${r.bestDisplay} (${r.bestTeam})`}
                        </span>
                      </div>
                      {/* Bars are scaled to the strongest round, so the shape of
                          the league reads at a glance rather than the absolute
                          points — 25 is the Distance ceiling and rarely reached. */}
                      <div className="flex items-center gap-2">
                        <div className="h-3 flex-1 overflow-hidden rounded-full bg-surface-2">
                          <div
                            className="h-full rounded-full bg-gradient-to-l from-lime to-lime-bright"
                            style={{ width: `${(r.average / max) * 100}%` }}
                          />
                        </div>
                        <span className="w-12 shrink-0 text-left font-score text-sm font-black">
                          {r.averageDisplay}
                        </span>
                      </div>
                    </div>
                  );
                })}
                <p className="pt-1 text-xs text-muted">
                  האורך מייצג את הציון הממוצע בסבב, ביחס לסבב החזק ביותר.
                </p>
              </div>
            </section>

            {/* ---- records ---- */}
            <section>
              <h2 className="ds-label mb-3">שיאים</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                <Highlight
                  icon={Flame}
                  title="הזריקה הטובה ביותר"
                  row={records.bestThrow}
                  empty="אין נתוני זריקות"
                />
                <Highlight
                  icon={TrendingUp}
                  title="השיפור הגדול ביותר"
                  row={records.biggestImprovement}
                  empty="צריך שני סבבים לאותו צוות"
                />
                <Highlight
                  icon={Crosshair}
                  title="הצוות הכי עקבי"
                  row={records.mostConsistent}
                  empty="צריך שני סבבים לאותו צוות"
                />
              </div>
            </section>

            {/* ---- top runs ---- */}
            <section>
              <h2 className="ds-label mb-3">הריצות הגבוהות ביותר</h2>
              <ol className="ds-card divide-y divide-line p-0">
                {records.topScores.map((row, i) => (
                  <LeaderLine key={`${row.player}-${i}`} row={row} index={i} />
                ))}
              </ol>
              {records.perLevelTop.some((p) => p.row) && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {records.perLevelTop
                    .filter((p) => p.row)
                    .map((p) => (
                      <div key={p.level} className="ds-inset p-4">
                        <p className="ds-label mb-1">
                          מוביל · {LEVEL_HE[p.level as keyof typeof LEVEL_HE] ?? p.level}
                        </p>
                        <p className="font-bold">
                          {p.row!.player}
                          {p.row!.dog && (
                            <span className="text-muted"> · {p.row!.dog}</span>
                          )}
                        </p>
                        <p className="font-score text-2xl font-black text-accent">
                          {p.row!.display}
                        </p>
                      </div>
                    ))}
                </div>
              )}
            </section>

            {/* ---- catching ---- */}
            {catching.bestRate.length > 0 && (
              <section>
                <h2 className="ds-label mb-3">אחוזי תפיסה מובילים</h2>
                <ol className="ds-card divide-y divide-line p-0">
                  {catching.bestRate.map((row, i) => (
                    <LeaderLine key={`${row.player}-${i}`} row={row} index={i} />
                  ))}
                </ol>
                <p className="mt-2 text-xs text-muted">
                  נכללים רק צוותים עם 5 זריקות ומעלה, כדי שאחוז לא ייווצר ממדגם
                  זעיר.
                </p>
              </section>
            )}

            {/* ---- zones ---- */}
            <section>
              <h2 className="ds-label mb-3">לאן זרקו</h2>
              <div className="ds-card space-y-3 p-5">
                {zones.counts.map((z) => (
                  <div key={z.zone} className="flex items-center gap-3">
                    <span className="w-14 shrink-0 text-xs font-bold text-muted">
                      {z.label}
                    </span>
                    <div className="h-3 flex-1 overflow-hidden rounded-full bg-surface-2">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${z.share}%` }}
                      />
                    </div>
                    <span className="w-16 shrink-0 text-left text-xs font-bold">
                      {z.throws}
                      <span className="text-muted">
                        {" "}
                        ({Math.round(z.share)}%)
                      </span>
                    </span>
                  </div>
                ))}
                <div className="grid grid-cols-3 gap-3 border-t border-line pt-3">
                  <MiniStat
                    label="לאזורים הרחוקים"
                    value={`${Math.round(zones.farShare)}%`}
                    hint={`${zones.farThrows} זריקות`}
                  />
                  <MiniStat
                    label="בונוסי קפיצה"
                    value={String(zones.jumpBonuses)}
                    hint="4 רגליים באוויר"
                  />
                  <MiniStat
                    label="בונוסי אזור מרכזי"
                    value={String(zones.zoneBonuses)}
                    hint="תפיסה במרכז"
                  />
                </div>
              </div>
            </section>

            <p className="text-center text-xs text-muted">
              מבוסס על {overview.heats} ריצות דיסטנס שהושלמו · עודכן{" "}
              {new Date(data.generatedAt).toLocaleString("he-IL")}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
  accent = false,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="ds-card p-4">
      <Icon className={`mb-2 h-5 w-5 ${accent ? "text-accent" : "text-muted"}`} />
      <p className="ds-label">{label}</p>
      <p className="font-score text-2xl font-black leading-tight">{value}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

function MiniStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div>
      <p className="ds-label">{label}</p>
      <p className="font-score text-xl font-black leading-tight">{value}</p>
      <p className="text-xs text-muted">{hint}</p>
    </div>
  );
}

// A record with no data yet says *why* it is empty — "needs two rounds" is a
// different situation from "nobody has run", and an organizer mid-league will
// otherwise read a blank card as a bug.
function Highlight({
  icon: Icon,
  title,
  row,
  empty,
}: {
  icon: typeof Flame;
  title: string;
  row: LeagueSummaryLeader | null;
  empty: string;
}) {
  return (
    <div className="ds-card p-4">
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4 text-accent" />
        <p className="ds-label">{title}</p>
      </div>
      {row ? (
        <>
          <p className="font-score text-3xl font-black leading-none text-accent">
            {row.display}
          </p>
          <p className="mt-1 truncate font-bold">{row.player ?? "—"}</p>
          <p className="truncate text-xs text-muted">
            {row.dog ? `${row.dog} · ` : ""}
            {row.detail}
          </p>
        </>
      ) : (
        <p className="py-2 text-sm text-muted">{empty}</p>
      )}
    </div>
  );
}

function LeaderLine({
  row,
  index,
}: {
  row: LeagueSummaryLeader;
  index: number;
}) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span
        className={`ds-rank shrink-0 ${
          index === 0 ? "ds-rank-1" : "bg-surface-2 text-muted"
        }`}
        aria-hidden
      >
        {index === 0 ? <Medal className="h-4 w-4" /> : index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold leading-tight">{row.player ?? "—"}</p>
        <p className="truncate text-xs text-muted">
          {row.dog ? `${row.dog}${row.detail ? " · " : ""}` : ""}
          {row.detail}
        </p>
      </div>
      <span className="shrink-0 font-score text-xl font-black">
        {row.display}
      </span>
    </li>
  );
}
