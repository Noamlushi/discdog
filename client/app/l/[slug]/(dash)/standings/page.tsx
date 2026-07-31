"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Download, Medal, X } from "lucide-react";
import {
  getHeatStats,
  getLeagueBySlug,
  getLeagueStandings,
} from "../../../../../lib/api";
import { describeAction, type ActionKind } from "../../../../../lib/actionLabels";
import { disciplineOf } from "../../../../../lib/disciplines";
import { useAuth } from "../../../../../context/AuthContext";
import type {
  ExperienceLevel,
  HeatStats,
  LeagueDto,
  LeagueRoundColumn,
  LeagueStandingsResponse,
  LeagueTeamStanding,
} from "../../../../../lib/types";

// League standings — a per-round matrix (one column per configured round across
// all dates) plus the official aggregate (best-of-N or sum). Public read for
// spectators/competitors; organizers additionally get per-heat drill-down and a
// CSV export of every score. Rendered inside the scoped league shell.
const LEVEL_LABEL: Record<ExperienceLevel, string> = {
  Beginner: "מתחילים",
  Advanced: "מתקדמים",
};

export default function LeagueStandingsPage() {
  const { slug } = useParams<{ slug: string }>();
  const { isManager } = useAuth();
  const [league, setLeague] = useState<LeagueDto | null>(null);
  const [standings, setStandings] = useState<LeagueStandingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<{ matchId: string; team: string } | null>(
    null
  );
  const leagueIdRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      const lg = await getLeagueBySlug(slug);
      if (!active) return;
      setLeague(lg);
      leagueIdRef.current = lg._id;
      const st = await getLeagueStandings(lg._id);
      if (active) setStandings(st);
    }
    load().finally(() => active && setLoading(false));
    const t = setInterval(() => {
      if (leagueIdRef.current)
        getLeagueStandings(leagueIdRef.current).then(
          (s) => active && setStandings(s)
        );
    }, 15000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [slug]);

  if (loading) {
    return <p className="py-16 text-center text-cocoa/50">טוען…</p>;
  }
  if (!league || !standings) return null;

  const levels = league.experienceLevels ?? ["Advanced", "Beginner"];
  const cols = standings.rounds;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-cocoa/55 dark:text-slate-400">
          {standings.roundsTotal} סבבים סה״כ ·{" "}
          {standings.scoring.mode === "bestOf"
            ? `הטוב מ-${standings.scoring.bestN}`
            : "סכום כל הסבבים"}
        </p>
        {isManager && (
          <button
            type="button"
            onClick={() => exportCsv(league.name, standings, levels)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-tangerine/25 bg-white/70 px-3 py-1.5 text-xs font-bold text-cocoa/70 shadow-soft transition hover:border-tangerine/50 dark:bg-slate-900 dark:text-slate-300"
          >
            <Download className="h-3.5 w-3.5" />
            יצוא CSV
          </button>
        )}
      </div>

      {levels.map((level) => {
        const rows = standings.levels[level] ?? [];
        return (
          <section key={level} className="mb-10">
            <h2 className="mb-3 text-lg font-extrabold">
              {LEVEL_LABEL[level] ?? level}
            </h2>
            {rows.length === 0 ? (
              <p className="rounded-2xl bg-white/70 p-5 text-sm text-cocoa/50 shadow-soft dark:bg-slate-900 dark:text-slate-400">
                אין עדיין תוצאות סבבים.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-3xl bg-white/80 shadow-soft ring-1 ring-tangerine/15 dark:bg-slate-900 dark:ring-slate-800">
                <table className="w-full min-w-max text-sm">
                  <thead className="bg-cream/60 text-xs font-bold text-cocoa/50 dark:bg-slate-950/40 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3 text-right">#</th>
                      <th className="px-4 py-3 text-right">שחקן / כלב</th>
                      {cols.map((c) => (
                        <th
                          key={c.key}
                          className="px-3 py-3 text-center"
                          title={`${c.dateLabel} · סבב ${c.roundIndex}`}
                        >
                          ס{c.seq}
                        </th>
                      ))}
                      <th className="px-4 py-3 text-center">סה״כ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <StandingRow
                        key={`${row.player}-${row.dog}-${row.rank}`}
                        row={row}
                        cols={cols}
                        isManager={isManager}
                        onCell={(matchId) =>
                          setDetail({
                            matchId,
                            team: `${row.player ?? "—"} · ${row.dog ?? ""}`,
                          })
                        }
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}

      {detail && (
        <ScoreDetailModal
          matchId={detail.matchId}
          team={detail.team}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}

function StandingRow({
  row,
  cols,
  isManager,
  onCell,
}: {
  row: LeagueTeamStanding;
  cols: LeagueRoundColumn[];
  isManager: boolean;
  onCell: (matchId: string) => void;
}) {
  const medal =
    row.rank === 1
      ? "text-yellow-500"
      : row.rank === 2
        ? "text-slate-400"
        : row.rank === 3
          ? "text-amber-700"
          : "";
  return (
    <tr className="border-t border-tangerine/10 dark:border-slate-800">
      <td className="px-4 py-3 font-black">
        {row.rank <= 3 ? <Medal className={`inline h-4 w-4 ${medal}`} /> : null}{" "}
        {row.rank}
      </td>
      <td className="px-4 py-3">
        <div className="font-bold">{row.player ?? "—"}</div>
        <div className="text-xs text-cocoa/50 dark:text-slate-400">
          {row.dog ?? ""}
        </div>
      </td>
      {cols.map((c) => {
        const cell = row.cells[c.key];
        if (!cell) {
          return (
            <td key={c.key} className="px-3 py-3 text-center text-cocoa/30 dark:text-slate-600">
              —
            </td>
          );
        }
        return (
          <td key={c.key} className="px-3 py-3 text-center font-semibold tabular-nums">
            {isManager ? (
              <button
                type="button"
                onClick={() => onCell(cell.matchId)}
                className="rounded-lg px-2 py-0.5 text-cocoa/80 underline decoration-dotted underline-offset-4 transition hover:bg-tangerine/10 hover:text-sunset dark:text-slate-200"
                title="הצג פירוט מקצה"
              >
                {cell.score}
              </button>
            ) : (
              <span className="text-cocoa/80 dark:text-slate-200">{cell.score}</span>
            )}
          </td>
        );
      })}
      <td className="px-4 py-3 text-center text-lg font-black text-sunset">
        {row.display}
      </td>
    </tr>
  );
}

// Organizer drill-down — the full per-heat breakdown for one round score.
function ScoreDetailModal({
  matchId,
  team,
  onClose,
}: {
  matchId: string;
  team: string;
  onClose: () => void;
}) {
  const [stats, setStats] = useState<HeatStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    getHeatStats(matchId)
      .then(setStats)
      .catch((e) => setError((e as Error).message));
  }, [matchId]);
  useEffect(() => {
    load();
  }, [load]);

  const b = stats?.breakdown ?? {};
  const catches = b.catches ?? 0;
  const misses = b.misses ?? 0;
  const attempts = catches + misses;
  const rate = attempts > 0 ? Math.round((catches / attempts) * 100) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-soft dark:bg-slate-900 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-black">{team}</p>
            <p className="text-sm text-cocoa/50 dark:text-slate-400">
              {stats ? disciplineOf(stats.categoryId)?.nameHe ?? stats.categoryId : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="סגור"
            className="rounded-xl p-1.5 text-cocoa/50 transition hover:bg-cream dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <p className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm font-semibold text-danger">
            {error}
          </p>
        )}

        <div className="mb-4 grid grid-cols-4 gap-2">
          <Stat label="ניקוד" value={stats?.display ?? "—"} tone="score" />
          <Stat label="תפיסות" value={String(catches)} tone="score" />
          <Stat label="החטאות" value={String(misses)} tone="miss" />
          <Stat label="הצלחה" value={rate == null ? "—" : `${rate}%`} />
        </div>

        <h3 className="mb-2 text-xs font-bold text-cocoa/50 dark:text-slate-400">
          ציר זמן הזריקות
        </h3>
        {!stats || stats.timeline.length === 0 ? (
          <p className="rounded-2xl bg-cream/60 p-5 text-center text-sm text-cocoa/50 dark:bg-slate-950/40 dark:text-slate-400">
            אין פעולות רשומות במקצה הזה.
          </p>
        ) : (
          <ol className="space-y-1.5">
            {stats.timeline.map((entry, i) => {
              const { text, kind } = describeAction(
                stats.categoryId,
                entry.actionData
              );
              return (
                <li
                  key={i}
                  className="flex items-center justify-between rounded-xl bg-cream/50 px-3 py-2 dark:bg-slate-950/40"
                >
                  <span className="flex items-center gap-2.5">
                    <span className="w-5 text-xs tabular-nums text-cocoa/40 dark:text-slate-500">
                      {i + 1}
                    </span>
                    <KindDot kind={kind} />
                    <span className="text-sm font-medium">{text}</span>
                  </span>
                  <span className="text-xs tabular-nums text-cocoa/40 dark:text-slate-500">
                    {entry.timestamp}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "score" | "miss";
}) {
  const cls =
    tone === "score" ? "text-sunset" : tone === "miss" ? "text-danger" : "text-cocoa dark:text-slate-100";
  return (
    <div className="rounded-2xl bg-cream/60 p-3 text-center dark:bg-slate-950/40">
      <p className="text-[11px] font-bold text-cocoa/50 dark:text-slate-400">{label}</p>
      <p className={`mt-0.5 text-xl font-black tabular-nums ${cls}`}>{value}</p>
    </div>
  );
}

function KindDot({ kind }: { kind: ActionKind }) {
  const cls =
    kind === "catch" ? "bg-lime" : kind === "miss" ? "bg-danger" : "bg-cocoa/30";
  return <span className={`h-2.5 w-2.5 rounded-full ${cls}`} />;
}

// Flatten every score into a CSV (level, rank, player, dog, per-round, total).
function exportCsv(
  leagueName: string,
  standings: LeagueStandingsResponse,
  levels: ExperienceLevel[]
) {
  const cols = standings.rounds;
  const header = [
    "רמה",
    "דירוג",
    "שחקן",
    "כלב",
    ...cols.map((c) => `${c.dateLabel} סבב ${c.roundIndex}`),
    "סה״כ",
  ];
  const lines = [header];
  for (const level of levels) {
    for (const row of standings.levels[level] ?? []) {
      lines.push([
        LEVEL_LABEL[level] ?? level,
        String(row.rank),
        row.player ?? "",
        row.dog ?? "",
        ...cols.map((c) => {
          const cell = row.cells[c.key];
          return cell ? String(cell.score) : "";
        }),
        row.display,
      ]);
    }
  }
  const csv = lines
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  // Prepend BOM so Excel reads the Hebrew as UTF-8.
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${leagueName} — תוצאות ליגה.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
