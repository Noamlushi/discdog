import { Event, League, Match } from "../models";
import { Discipline, ExperienceLevel, MatchStatus } from "../types";
import { formatPoints } from "../scoring/util";

// League standings — aggregate each team's Distance round scores across all of a
// league's round Events. Distance is points-based (higher is better), so we take
// the best-of-N rounds (default) or the sum, per the league's scoring config.
// A team that skipped a date is still ranked on the rounds it did run.

// One canonical round column, in date→round order, whether or not it has been
// generated/run yet (so the matrix always shows every configured round).
interface RoundColumn {
  key: string; // `${dateId}:${roundIndex}`
  dateId: string;
  dateLabel: string;
  roundIndex: number;
  seq: number; // global 1..roundsTotal order (the "ס1..סN" column labels)
  eventId: string | null; // the round Event, if generated
}
// A team's score in one round column — carries matchId for organizer drill-down.
interface RoundCell {
  score: number;
  matchId: string;
}
interface TeamStanding {
  rank: number;
  player: string | null;
  dog: string | null;
  aggregate: number;
  display: string;
  attended: number; // number of rounds run
  cells: Record<string, RoundCell>; // keyed by RoundColumn.key
}

// Standard competition ranking (1, 2, 2, 4) over an already-sorted list.
function assignRanks(entries: TeamStanding[]): void {
  let rank = 0;
  let prev: number | null = null;
  entries.forEach((entry, i) => {
    if (prev === null || entry.aggregate !== prev) {
      rank = i + 1;
      prev = entry.aggregate;
    }
    entry.rank = rank;
  });
}

export interface LeagueStandings {
  leagueId: string;
  name: string;
  scoring: { mode: "bestOf" | "sum"; bestN: number };
  roundsTotal: number;
  rounds: RoundColumn[];
  levels: Record<string, TeamStanding[]>;
}

interface NamedRef {
  name?: string;
}

export async function computeLeagueStandings(
  leagueId: string
): Promise<LeagueStandings | null> {
  const league = await League.findById(leagueId).lean();
  if (!league) return null;

  const rounds = await Event.find({ leagueId })
    .select("_id leagueDateId roundIndex estimatedStartTime")
    .lean();

  // Build the canonical column list from the league's configured dates → rounds,
  // in order, so the matrix always shows every round (generated or not). Also map
  // each generated round Event → its column key so completed matches land in the
  // right cell.
  const columns: RoundColumn[] = [];
  const eventToColumn = new Map<string, string>();
  let seq = 0;
  for (const d of league.dates) {
    const dateLabel =
      d.label?.trim() || new Date(d.date).toLocaleDateString("he-IL");
    for (let r = 1; r <= d.roundsCount; r++) {
      seq++;
      const key = `${String(d._id)}:${r}`;
      const ev = rounds.find(
        (x) => String(x.leagueDateId) === String(d._id) && (x.roundIndex ?? 0) === r
      );
      if (ev) eventToColumn.set(String(ev._id), key);
      columns.push({
        key,
        dateId: String(d._id),
        dateLabel,
        roundIndex: r,
        seq,
        eventId: ev ? String(ev._id) : null,
      });
    }
  }
  const roundsTotal = columns.length;

  const eventIds = rounds.map((r) => r._id);
  const matches = await Match.find({
    eventId: { $in: eventIds },
    status: MatchStatus.Completed,
    categoryId: Discipline.Distance,
  })
    .populate("team.playerId", "name")
    .populate("team.dogId", "name")
    .lean();

  // Group each team's round scores, split by experience level.
  const levels: Record<string, Map<string, TeamStanding>> = {
    [ExperienceLevel.Beginner]: new Map(),
    [ExperienceLevel.Advanced]: new Map(),
  };

  for (const m of matches) {
    if (typeof m.finalScore !== "number") continue;
    const playerId = m.team?.playerId ? String((m.team.playerId as { _id?: unknown })._id ?? m.team.playerId) : null;
    const dogId = m.team?.dogId ? String((m.team.dogId as { _id?: unknown })._id ?? m.team.dogId) : null;
    if (!playerId || !dogId) continue;

    const bucket = levels[m.experienceLevel];
    if (!bucket) continue;
    const key = `${playerId}|${dogId}`;
    let team = bucket.get(key);
    if (!team) {
      team = {
        rank: 0,
        player: (m.team?.playerId as NamedRef | null)?.name ?? null,
        dog: (m.team?.dogId as NamedRef | null)?.name ?? null,
        aggregate: 0,
        display: "",
        attended: 0,
        cells: {},
      };
      bucket.set(key, team);
    }
    const columnKey = eventToColumn.get(String(m.eventId));
    if (!columnKey) continue;
    // Keep the best score if a round was somehow scored twice for a team.
    const existing = team.cells[columnKey];
    if (!existing || m.finalScore > existing.score) {
      team.cells[columnKey] = { score: m.finalScore, matchId: String(m._id) };
    }
  }

  const mode = league.scoring?.mode ?? "bestOf";
  const bestN = league.scoring?.bestN ?? 3;

  const out: Record<string, TeamStanding[]> = {};
  for (const [level, bucket] of Object.entries(levels)) {
    const entries = [...bucket.values()];
    for (const team of entries) {
      const scores = Object.values(team.cells).map((c) => c.score);
      team.attended = scores.length;
      const sortedDesc = [...scores].sort((a, b) => b - a);
      const counted =
        mode === "bestOf" ? sortedDesc.slice(0, bestN) : sortedDesc;
      team.aggregate = counted.reduce((s, v) => s + v, 0);
      team.display = formatPoints(team.aggregate);
    }
    // Distance is points-based → rank by aggregate descending.
    entries.sort((a, b) => b.aggregate - a.aggregate);
    assignRanks(entries);
    out[level] = entries;
  }

  return {
    leagueId: String(league._id),
    name: league.name,
    scoring: { mode, bestN },
    roundsTotal,
    rounds: columns,
    levels: out,
  };
}
