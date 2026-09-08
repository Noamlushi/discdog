import { ActionLog, Event, League, Match } from "../models";
import { Discipline, ExperienceLevel, MatchStatus } from "../types";
import { formatPoints } from "../scoring/util";

// League summary — the "how did the league actually go" read, across every date
// and round at once. Standings answer *who is winning*; this answers what the
// runs looked like: where the discs landed, how often the dogs caught them, and
// whether teams got better between rounds.
//
// Everything here is derived from completed Distance heats and their ActionLogs
// (§4.5), so it needs no new writes — a round that has not run yet simply
// contributes nothing.

// Distance zone values, mirroring src/scoring/distance.ts. Duplicated as a table
// rather than imported because here we need the per-zone *distribution*, not a
// heat's score, and the scorer deliberately exposes only the latter.
const ZONE_POINTS: Record<number, number> = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4 };
const ZONES = [1, 2, 3, 4, 5];

interface ThrowAction {
  zone?: unknown;
  jumpBonus?: unknown;
  zoneBonus?: unknown;
  miss?: unknown;
}

interface NamedRef {
  name?: string;
}

/** A team's identity for grouping — same key shape the standings service uses. */
function teamKey(playerId: string, dogId: string): string {
  return `${playerId}|${dogId}`;
}

function refId(v: unknown): string | null {
  if (!v) return null;
  const asObj = v as { _id?: unknown };
  return String(asObj._id ?? v);
}

export interface RoundBar {
  key: string;
  label: string; // "25.7 · סבב 1"
  seq: number;
  teams: number;
  average: number;
  averageDisplay: string;
  best: number | null;
  bestDisplay: string | null;
  bestTeam: string | null;
}

export interface LeaderRow {
  player: string | null;
  dog: string | null;
  value: number;
  display: string;
  detail?: string;
}

export interface LeagueSummary {
  leagueId: string;
  name: string;
  generatedAt: string;
  /** Null when no round has been completed yet — the client renders an empty state. */
  hasData: boolean;
  overview: {
    dates: number;
    roundsConfigured: number;
    roundsRun: number;
    teams: number;
    heats: number;
    throws: number;
    catches: number;
    misses: number;
    catchRate: number; // 0..100
    averageScore: number;
    averageScoreDisplay: string;
  };
  rounds: RoundBar[];
  records: {
    topScores: LeaderRow[];
    bestThrow: LeaderRow | null;
    mostConsistent: LeaderRow | null;
    biggestImprovement: LeaderRow | null;
    perLevelTop: { level: string; row: LeaderRow | null }[];
  };
  catching: {
    bestRate: LeaderRow[];
    perRound: { key: string; label: string; catchRate: number }[];
  };
  zones: {
    counts: { zone: number; label: string; throws: number; share: number }[];
    jumpBonuses: number;
    zoneBonuses: number;
    /** Throws that reached the two far zones — the league's "big throw" rate. */
    farThrows: number;
    farShare: number;
  };
}

export async function computeLeagueSummary(
  leagueId: string
): Promise<LeagueSummary | null> {
  const league = await League.findById(leagueId).lean();
  if (!league) return null;

  const roundEvents = await Event.find({ leagueId })
    .select("_id leagueDateId roundIndex")
    .lean();

  // Canonical round columns in date→round order, so a league with an ungenerated
  // round still reports the right totals for what *is* configured.
  const columns: { key: string; label: string; seq: number; eventId: string | null }[] =
    [];
  let seq = 0;
  for (const d of league.dates) {
    const dLabel = d.label?.trim() || new Date(d.date).toLocaleDateString("he-IL");
    for (let r = 1; r <= d.roundsCount; r++) {
      seq++;
      const ev = roundEvents.find(
        (x) => String(x.leagueDateId) === String(d._id) && (x.roundIndex ?? 0) === r
      );
      columns.push({
        key: `${String(d._id)}:${r}`,
        label: `${dLabel} · סבב ${r}`,
        seq,
        eventId: ev ? String(ev._id) : null,
      });
    }
  }
  const eventToColumn = new Map<string, string>();
  for (const c of columns) if (c.eventId) eventToColumn.set(c.eventId, c.key);

  const matches = await Match.find({
    eventId: { $in: roundEvents.map((r) => r._id) },
    status: MatchStatus.Completed,
    categoryId: Discipline.Distance,
  })
    .populate("team.playerId", "name")
    .populate("team.dogId", "name")
    .lean();

  const scored = matches.filter((m) => typeof m.finalScore === "number");

  const empty = (): LeagueSummary => ({
    leagueId: String(league._id),
    name: league.name,
    generatedAt: new Date().toISOString(),
    hasData: false,
    overview: {
      dates: league.dates.length,
      roundsConfigured: columns.length,
      roundsRun: 0,
      teams: 0,
      heats: 0,
      throws: 0,
      catches: 0,
      misses: 0,
      catchRate: 0,
      averageScore: 0,
      averageScoreDisplay: formatPoints(0),
    },
    rounds: [],
    records: {
      topScores: [],
      bestThrow: null,
      mostConsistent: null,
      biggestImprovement: null,
      perLevelTop: [],
    },
    catching: { bestRate: [], perRound: [] },
    zones: {
      counts: ZONES.map((z) => ({
        zone: z,
        label: `אזור ${z}`,
        throws: 0,
        share: 0,
      })),
      jumpBonuses: 0,
      zoneBonuses: 0,
      farThrows: 0,
      farShare: 0,
    },
  });

  if (scored.length === 0) return empty();

  // ---- per-match throw stats from the action log ---------------------------
  const logs = await ActionLog.find({
    matchId: { $in: scored.map((m) => m._id) },
  })
    .select("matchId actionData")
    .lean();

  const perMatch = new Map<
    string,
    { throws: number; catches: number; misses: number; bestThrow: number }
  >();
  const zoneCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let jumpBonuses = 0;
  let zoneBonuses = 0;

  for (const log of logs) {
    const id = String(log.matchId);
    let agg = perMatch.get(id);
    if (!agg) {
      agg = { throws: 0, catches: 0, misses: 0, bestThrow: 0 };
      perMatch.set(id, agg);
    }
    const a = (log.actionData ?? {}) as ThrowAction;
    agg.throws += 1;
    // Misses are logged uniformly as { miss: true } by the shared MissButton, so
    // anything without that flag is a catch.
    if (a.miss) {
      agg.misses += 1;
      continue;
    }
    agg.catches += 1;
    const zone = Number(a.zone);
    if (ZONES.includes(zone)) {
      zoneCounts[zone] += 1;
      let value = ZONE_POINTS[zone];
      if (a.jumpBonus) {
        value += 0.5;
        jumpBonuses += 1;
      }
      if (a.zoneBonus) {
        value += 0.5;
        zoneBonuses += 1;
      }
      if (value > agg.bestThrow) agg.bestThrow = value;
    }
  }

  // ---- group by team -------------------------------------------------------
  interface TeamAgg {
    player: string | null;
    dog: string | null;
    level: string;
    scores: { columnKey: string; seq: number; score: number }[];
    throws: number;
    catches: number;
    misses: number;
    bestThrow: number;
  }
  const teams = new Map<string, TeamAgg>();

  let totalThrows = 0;
  let totalCatches = 0;
  let totalMisses = 0;
  let scoreSum = 0;

  const roundAgg = new Map<
    string,
    { scores: number[]; best: number; bestTeam: string | null; catches: number; throws: number }
  >();

  for (const m of scored) {
    const playerId = refId(m.team?.playerId);
    const dogId = refId(m.team?.dogId);
    if (!playerId || !dogId) continue;
    const columnKey = eventToColumn.get(String(m.eventId));
    if (!columnKey) continue;

    const score = m.finalScore as number;
    const stats = perMatch.get(String(m._id)) ?? {
      throws: 0,
      catches: 0,
      misses: 0,
      bestThrow: 0,
    };
    const player = (m.team?.playerId as NamedRef | null)?.name ?? null;
    const dog = (m.team?.dogId as NamedRef | null)?.name ?? null;

    totalThrows += stats.throws;
    totalCatches += stats.catches;
    totalMisses += stats.misses;
    scoreSum += score;

    const key = teamKey(playerId, dogId);
    let team = teams.get(key);
    if (!team) {
      team = {
        player,
        dog,
        level: m.experienceLevel,
        scores: [],
        throws: 0,
        catches: 0,
        misses: 0,
        bestThrow: 0,
      };
      teams.set(key, team);
    }
    const column = columns.find((c) => c.key === columnKey);
    team.scores.push({ columnKey, seq: column?.seq ?? 0, score });
    team.throws += stats.throws;
    team.catches += stats.catches;
    team.misses += stats.misses;
    if (stats.bestThrow > team.bestThrow) team.bestThrow = stats.bestThrow;

    let ra = roundAgg.get(columnKey);
    if (!ra) {
      ra = { scores: [], best: -Infinity, bestTeam: null, catches: 0, throws: 0 };
      roundAgg.set(columnKey, ra);
    }
    ra.scores.push(score);
    ra.catches += stats.catches;
    ra.throws += stats.throws;
    if (score > ra.best) {
      ra.best = score;
      ra.bestTeam = player;
    }
  }

  const teamList = [...teams.values()];
  const label = (t: TeamAgg) => `${t.player ?? "—"}${t.dog ? ` · ${t.dog}` : ""}`;

  // ---- rounds --------------------------------------------------------------
  const rounds: RoundBar[] = columns
    .filter((c) => roundAgg.has(c.key))
    .map((c) => {
      const ra = roundAgg.get(c.key)!;
      const average = ra.scores.reduce((s, v) => s + v, 0) / ra.scores.length;
      return {
        key: c.key,
        label: c.label,
        seq: c.seq,
        teams: ra.scores.length,
        average,
        averageDisplay: formatPoints(average),
        best: ra.best === -Infinity ? null : ra.best,
        bestDisplay: ra.best === -Infinity ? null : formatPoints(ra.best),
        bestTeam: ra.bestTeam,
      };
    });

  // ---- records -------------------------------------------------------------
  const allRuns: LeaderRow[] = [];
  for (const t of teamList) {
    for (const s of t.scores) {
      const column = columns.find((c) => c.key === s.columnKey);
      allRuns.push({
        player: t.player,
        dog: t.dog,
        value: s.score,
        display: formatPoints(s.score),
        detail: column?.label,
      });
    }
  }
  allRuns.sort((a, b) => b.value - a.value);
  const topScores = allRuns.slice(0, 5);

  const bestThrowTeam = teamList
    .filter((t) => t.bestThrow > 0)
    .sort((a, b) => b.bestThrow - a.bestThrow)[0];
  const bestThrow: LeaderRow | null = bestThrowTeam
    ? {
        player: bestThrowTeam.player,
        dog: bestThrowTeam.dog,
        value: bestThrowTeam.bestThrow,
        display: formatPoints(bestThrowTeam.bestThrow),
        detail: "זריקה בודדת",
      }
    : null;

  // Consistency only means something once a team has run more than once: it is
  // the spread between their best and worst round, smallest wins.
  const repeaters = teamList.filter((t) => t.scores.length > 1);
  const consistent = repeaters
    .map((t) => {
      const vals = t.scores.map((s) => s.score);
      return { t, spread: Math.max(...vals) - Math.min(...vals) };
    })
    .sort((a, b) => a.spread - b.spread)[0];
  const mostConsistent: LeaderRow | null = consistent
    ? {
        player: consistent.t.player,
        dog: consistent.t.dog,
        value: consistent.spread,
        display: `±${formatPoints(consistent.spread)}`,
        detail: `${consistent.t.scores.length} סבבים`,
      }
    : null;

  // Improvement compares each team's first and last round *in league order*, so
  // it reads as progress over the season rather than a lucky pair of runs.
  const improved = repeaters
    .map((t) => {
      const ordered = [...t.scores].sort((a, b) => a.seq - b.seq);
      return {
        t,
        delta: ordered[ordered.length - 1].score - ordered[0].score,
      };
    })
    .sort((a, b) => b.delta - a.delta)[0];
  const biggestImprovement: LeaderRow | null =
    improved && improved.delta > 0
      ? {
          player: improved.t.player,
          dog: improved.t.dog,
          value: improved.delta,
          display: `+${formatPoints(improved.delta)}`,
          detail: "מהסבב הראשון לאחרון",
        }
      : null;

  const perLevelTop = Object.values(ExperienceLevel).map((lvl) => {
    const best = teamList
      .filter((t) => t.level === lvl)
      .flatMap((t) =>
        t.scores.map((s) => ({ t, score: s.score, columnKey: s.columnKey }))
      )
      .sort((a, b) => b.score - a.score)[0];
    return {
      level: lvl as string,
      row: best
        ? {
            player: best.t.player,
            dog: best.t.dog,
            value: best.score,
            display: formatPoints(best.score),
            detail: columns.find((c) => c.key === best.columnKey)?.label,
          }
        : null,
    };
  });

  // ---- catching ------------------------------------------------------------
  // A handful of throws makes a 100% rate meaningless, so the leaderboard only
  // considers teams with enough attempts to have earned the number.
  const MIN_THROWS_FOR_RATE = 5;
  const bestRate: LeaderRow[] = teamList
    .filter((t) => t.throws >= MIN_THROWS_FOR_RATE)
    .map((t) => ({
      player: t.player,
      dog: t.dog,
      value: (t.catches / t.throws) * 100,
      display: `${Math.round((t.catches / t.throws) * 100)}%`,
      detail: `${t.catches}/${t.throws} זריקות`,
      throws: t.throws,
    }))
    // Equal rates break on volume: 23/23 is a harder 100% than 5/5.
    .sort((a, b) => b.value - a.value || b.throws - a.throws)
    .slice(0, 5)
    .map(({ throws: _throws, ...row }) => row);

  const catchPerRound = rounds.map((r) => {
    const ra = roundAgg.get(r.key)!;
    return {
      key: r.key,
      label: r.label,
      catchRate: ra.throws > 0 ? (ra.catches / ra.throws) * 100 : 0,
    };
  });

  // ---- zones ---------------------------------------------------------------
  const zoneTotal = ZONES.reduce((s, z) => s + zoneCounts[z], 0);
  const counts = ZONES.map((z) => ({
    zone: z,
    label: `אזור ${z}`,
    throws: zoneCounts[z],
    share: zoneTotal > 0 ? (zoneCounts[z] / zoneTotal) * 100 : 0,
  }));
  const farThrows = zoneCounts[4] + zoneCounts[5];

  return {
    leagueId: String(league._id),
    name: league.name,
    generatedAt: new Date().toISOString(),
    hasData: true,
    overview: {
      dates: league.dates.length,
      roundsConfigured: columns.length,
      roundsRun: rounds.length,
      teams: teamList.length,
      heats: scored.length,
      throws: totalThrows,
      catches: totalCatches,
      misses: totalMisses,
      catchRate: totalThrows > 0 ? (totalCatches / totalThrows) * 100 : 0,
      averageScore: scoreSum / scored.length,
      averageScoreDisplay: formatPoints(scoreSum / scored.length),
    },
    rounds,
    records: {
      topScores,
      bestThrow,
      mostConsistent,
      biggestImprovement,
      perLevelTop,
    },
    catching: { bestRate, perRound: catchPerRound },
    zones: {
      counts,
      jumpBonuses,
      zoneBonuses,
      farThrows,
      farShare: zoneTotal > 0 ? (farThrows / zoneTotal) * 100 : 0,
    },
  };
}
