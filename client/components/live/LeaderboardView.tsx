"use client";

import { useEffect, useMemo, useState } from "react";
import { Trophy } from "lucide-react";
import { useLiveSession } from "../../context/LiveSessionContext";
import { useLiveHeats } from "../../lib/useLiveHeats";
import { getLeaderboards } from "../../lib/api";
import { LEVEL_HE } from "../../lib/disciplines";
import type {
  ExperienceLevel,
  LeaderboardCategory,
  LeaderboardsResponse,
  RankedEntry,
} from "../../lib/types";

const MEDAL = ["🥇", "🥈", "🥉"];
const LEVELS: ExperienceLevel[] = ["Advanced", "Beginner"];

// §3.4 Public leaderboard — ranked per discipline & level, refreshed as heats
// complete. Points descending, times ascending (the server decides direction).
export default function LiveLeaderboardPage() {
  const { eventId, loading: eventLoading } = useLiveSession();
  // Reuse the heat channel purely as a "something finished" trigger.
  const { heats } = useLiveHeats(eventId);
  const completed = heats.filter((h) => h.status === "Completed").length;

  const [data, setData] = useState<LeaderboardsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    getLeaderboards(eventId)
      .then((d) => !cancelled && (setData(d), setError(null)))
      .catch((e) => !cancelled && setError((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, [eventId, completed]);

  // Disciplines with at least one ranked team, busiest first.
  const categories = useMemo(() => {
    if (!data) return [];
    return data.categories
      .filter((c) => LEVELS.some((l) => c.levels[l]?.length))
      .sort(
        (a, b) =>
          countEntries(b) - countEntries(a) || a.nameHe.localeCompare(b.nameHe)
      );
  }, [data]);

  if (eventLoading) {
    return <p className="py-16 text-center text-muted">טוען…</p>;
  }
  if (!eventId) {
    return (
      <p className="py-16 text-center text-muted">
        בחר תחרות כדי לראות את טבלת התוצאות.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight">
        <Trophy className="h-6 w-6 text-gold" />
        טבלת תוצאות
      </h1>

      {error && (
        <p className="ds-card border-danger/30 bg-danger/10 p-3 text-sm font-semibold text-danger">
          {error}
        </p>
      )}

      {categories.length === 0 ? (
        <p className="py-12 text-center text-muted">
          עדיין אין תוצאות — התחרות בעיצומה.
        </p>
      ) : (
        categories.map((cat) => <CategoryBlock key={cat.categoryId} cat={cat} />)
      )}
    </div>
  );
}

function countEntries(cat: LeaderboardCategory): number {
  return LEVELS.reduce((n, l) => n + (cat.levels[l]?.length ?? 0), 0);
}

function CategoryBlock({ cat }: { cat: LeaderboardCategory }) {
  return (
    <section className="ds-card p-5">
      <h2 className="mb-3 text-lg font-black">{cat.nameHe}</h2>
      <div className="grid gap-5 sm:grid-cols-2">
        {LEVELS.map((level) =>
          cat.levels[level]?.length ? (
            <LevelTable
              key={level}
              level={level}
              entries={cat.levels[level]}
            />
          ) : null
        )}
      </div>
    </section>
  );
}

function LevelTable({
  level,
  entries,
}: {
  level: ExperienceLevel;
  entries: RankedEntry[];
}) {
  return (
    <div>
      <p className="ds-label mb-2">{LEVEL_HE[level]}</p>
      <ol className="space-y-1.5">
        {entries.map((e) => (
          <li
            key={e.matchId}
            className={`flex items-center gap-2 rounded-xl px-3 py-2 ${
              e.rank === 1
                ? "border border-accent/25 bg-accent/10"
                : "bg-surface-2"
            }`}
          >
            <span className="w-7 shrink-0 text-center text-sm font-black tabular-nums">
              {e.rank <= 3 ? MEDAL[e.rank - 1] : e.rank}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-bold">
              {e.player ?? "—"}
              {e.dog && <span className="font-medium text-muted"> · {e.dog}</span>}
            </span>
            <span className="shrink-0 font-score text-base font-black tabular-nums text-accent">
              {e.display}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
