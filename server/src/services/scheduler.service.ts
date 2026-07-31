import { Event, Registration, Match, User } from "../models";
import { Discipline, ExperienceLevel, MatchStatus, UserRole } from "../types";
import { JTRAIL_FINALS_TEAMS } from "../scoring/jTrail";
import { TIMETRAIL_FINALS_TEAMS } from "../scoring/timeTrail";

// J'Games scheduling engine (§7). Turns the event's registrations into timed,
// pitched Match/heats subject to the hard constraints in §7.1 and the
// pitch/block rules confirmed with the product owner:
//   • Each discipline runs as a contiguous block; disciplines never interleave,
//     EXCEPT Freestyle ⟂ Distance on the main pitch, paired CROSS-level (owner
//     decision 2026-06-29): group 1 = Freestyle Beginner ⟂ Distance Advanced,
//     group 2 = Freestyle Advanced ⟂ Distance Beginner. This overrides the
//     same-level pairing originally described in §7.
//   • Freestyle (both levels) lives on the main pitch (pitch 1) only.
//   • When Freestyle is present, Distance + Shuffle share the main pitch too;
//     otherwise they are ordinary blocks.
//   • Levels are never mixed within a sequence.
//   • Remaining disciplines are load-balanced as whole blocks across pitches.

const MAIN_PITCH = 1;

// Minutes a handler needs between runs with DIFFERENT dogs (owner decision
// 2026-06-29). The full minRestTimeMinutes still governs the same dog.
const PLAYER_SWITCH_REST_MINUTES = 10;

// Default per-discipline slot length in seconds (run time + team changeover).
// Overridable per /generate request.
const DEFAULT_SLOT_SECONDS: Record<Discipline, number> = {
  [Discipline.Distance]: 180,
  [Discipline.IceDrop]: 180,
  [Discipline.MultipleChallenge]: 150,
  [Discipline.Agility]: 180,
  [Discipline.WheelOfFortune]: 150,
  [Discipline.JTrail]: 150,
  [Discipline.Shuffle]: 120,
  [Discipline.CrissCross]: 150,
  [Discipline.TimeTrail]: 150,
  [Discipline.Freestyle]: 300,
};

const FINALS_TEAMS: Partial<Record<Discipline, number>> = {
  [Discipline.JTrail]: JTRAIL_FINALS_TEAMS,
  [Discipline.TimeTrail]: TIMETRAIL_FINALS_TEAMS,
};

// Order we lay levels down in — Advanced first, then Beginner.
const LEVEL_ORDER: ExperienceLevel[] = [
  ExperienceLevel.Advanced,
  ExperienceLevel.Beginner,
];

type SlotSeconds = Record<Discipline, number>;

interface TeamEntry {
  playerId: string;
  dogId: string;
}

interface Pool {
  key: string;
  discipline: Discipline;
  level: ExperienceLevel;
  teams: TeamEntry[]; // consumed as heats are assigned
}

interface Plan {
  pitchNumber: number;
  slots: Pool[]; // one pool reference per heat, in run order
  load: number; // accumulated seconds, used for load balancing
}

interface HeatDraft {
  eventId: string;
  categoryId: Discipline;
  experienceLevel: ExperienceLevel;
  pitchNumber: number;
  scheduledTime: Date;
  team: { playerId?: string; dogId?: string };
  judgeIds: string[];
  status: MatchStatus;
  isFinalsPlaceholder: boolean;
}

export interface ScheduleReport {
  eventId: string;
  pitches: number;
  heatsCreated: number;
  placeholdersCreated: number;
  makespanMinutes: number;
  calculatedMinDuration: number;
  windowMinutes: number;
  utilisationPct: number;
  fitsWindow: boolean;
  warnings: string[];
}

const poolKey = (d: Discipline, l: ExperienceLevel): string => `${d}|${l}`;
const minutes = (ms: number): number => Math.round(ms / 60000);

// Reorder a pool's teams so a handler who entered several dogs is spread evenly
// across the block instead of running back-to-back (owner decision 2026-06-29).
// Each handler's dogs claim evenly-spaced "ideal" positions ((i+0.5)·N/k);
// busiest handlers claim first, the rest cascade into the nearest free slot.
// This keeps a 3-dog handler near positions ⅙, ½, ⅚ rather than clustered at the
// block tail (which is what a naive round-robin produced).
function spreadByHandler(teams: TeamEntry[]): TeamEntry[] {
  const n = teams.length;
  if (n <= 2) return teams;

  const byPlayer = new Map<string, TeamEntry[]>();
  for (const t of teams) {
    const g = byPlayer.get(t.playerId);
    if (g) g.push(t);
    else byPlayer.set(t.playerId, [t]);
  }
  const groups = [...byPlayer.values()].sort((a, b) => b.length - a.length);

  const slots: (TeamEntry | null)[] = new Array(n).fill(null);
  const placeNearest = (ideal: number, team: TeamEntry) => {
    for (let r = 0; r < n; r++) {
      const hi = ideal + r;
      const lo = ideal - r;
      if (hi < n && slots[hi] === null) return void (slots[hi] = team);
      if (lo >= 0 && slots[lo] === null) return void (slots[lo] = team);
    }
  };
  for (const g of groups) {
    for (let i = 0; i < g.length; i++) {
      const ideal = Math.min(n - 1, Math.floor(((i + 0.5) * n) / g.length));
      placeNearest(ideal, g[i]);
    }
  }
  return slots.filter((s): s is TeamEntry => s !== null);
}

// ── Pools ──────────────────────────────────────────────────────────────────

function buildPools(
  regs: { playerId: unknown; dogId: unknown; discipline: Discipline; experienceLevel: ExperienceLevel }[]
): Map<string, Pool> {
  const pools = new Map<string, Pool>();
  for (const r of regs) {
    const key = poolKey(r.discipline, r.experienceLevel);
    let pool = pools.get(key);
    if (!pool) {
      pool = { key, discipline: r.discipline, level: r.experienceLevel, teams: [] };
      pools.set(key, pool);
    }
    pool.teams.push({ playerId: String(r.playerId), dogId: String(r.dogId) });
  }
  for (const pool of pools.values()) pool.teams = spreadByHandler(pool.teams);
  return pools;
}

// ── Pitch plans ──────────────────────────────────────────────────────────────

function buildPlans(
  pools: Map<string, Pool>,
  pitchCount: number,
  slots: SlotSeconds
): Plan[] {
  const plans: Plan[] = Array.from({ length: pitchCount }, (_, i) => ({
    pitchNumber: i + 1,
    slots: [],
    load: 0,
  }));
  const mainPlan = plans[MAIN_PITCH - 1];
  const claimed = new Set<string>();
  const get = (d: Discipline, l: ExperienceLevel) => pools.get(poolKey(d, l));

  const freestylePresent = LEVEL_ORDER.some(
    (l) => (get(Discipline.Freestyle, l)?.teams.length ?? 0) > 0
  );

  const push = (plan: Plan, pool: Pool) => {
    plan.slots.push(pool);
    plan.load += slots[pool.discipline];
  };

  if (freestylePresent) {
    // Main pitch: Freestyle interleaved with Distance (FS, D, FS, D…), paired
    // CROSS-level per the owner decision (2026-06-29):
    //   group 1 → Freestyle Beginner ⟂ Distance Advanced
    //   group 2 → Freestyle Advanced ⟂ Distance Beginner
    const FS_DISTANCE_GROUPS: [ExperienceLevel, ExperienceLevel][] = [
      [ExperienceLevel.Beginner, ExperienceLevel.Advanced],
      [ExperienceLevel.Advanced, ExperienceLevel.Beginner],
    ];
    for (const [fsLevel, distLevel] of FS_DISTANCE_GROUPS) {
      const fs = get(Discipline.Freestyle, fsLevel);
      const dist = get(Discipline.Distance, distLevel);
      const a = fs?.teams.length ?? 0;
      const b = dist?.teams.length ?? 0;
      for (let i = 0, j = 0; i < a || j < b; ) {
        if (i < a && fs) {
          push(mainPlan, fs);
          i++;
        }
        if (j < b && dist) {
          push(mainPlan, dist);
          j++;
        }
      }
      if (fs) claimed.add(fs.key);
      if (dist) claimed.add(dist.key);
    }
    // Shuffle shares the open-field main pitch, as its own contiguous block.
    for (const level of LEVEL_ORDER) {
      const sh = get(Discipline.Shuffle, level);
      if (!sh) continue;
      for (let i = 0; i < sh.teams.length; i++) push(mainPlan, sh);
      claimed.add(sh.key);
    }
  }

  // Every other (discipline, level) block: load-balance whole blocks across all
  // pitches — longest blocks first onto the least-loaded pitch.
  const remaining = [...pools.values()]
    .filter((p) => !claimed.has(p.key) && p.teams.length > 0)
    .sort((x, y) => y.teams.length * slots[y.discipline] - x.teams.length * slots[x.discipline]);

  for (const pool of remaining) {
    const target = plans.reduce((lo, p) => (p.load < lo.load ? p : lo), plans[0]);
    for (let i = 0; i < pool.teams.length; i++) push(target, pool);
  }

  return plans;
}

// ── Time assignment (greedy, constraint-aware) ───────────────────────────────

function assignTimes(
  plans: Plan[],
  eventId: string,
  start: Date,
  minRestMinutes: number,
  slots: SlotSeconds
): { heats: HeatDraft[]; pitchEndMs: Map<number, number> } {
  const startMs = start.getTime();
  const restMs = Math.max(0, minRestMinutes) * 60000;
  // §7.1 — a handler swapping between DIFFERENT dogs only needs a short turnaround
  // (owner decision 2026-06-29: 10 min), not the full dog-recovery rest. The full
  // rest still applies to the SAME dog via dogReady, which dominates here since the
  // dog must rest restMs (≥ this) before its next run. Capped so it never exceeds
  // the configured rest when an admin sets a very small minRestTimeMinutes.
  const playerSwitchMs = Math.min(PLAYER_SWITCH_REST_MINUTES * 60000, restMs);
  const dogReady = new Map<string, number>();
  const playerReady = new Map<string, number>();
  const heats: HeatDraft[] = [];

  // Per-plan cursor over its slot list.
  const cursors = plans.map((plan) => ({ plan, ptr: 0, clock: startMs }));
  const pitchEndMs = new Map<number, number>(
    plans.map((p) => [p.pitchNumber, startMs])
  );

  for (;;) {
    // Pick the pitch that is free earliest and still has heats to place.
    let next: (typeof cursors)[number] | null = null;
    for (const c of cursors) {
      if (c.ptr >= c.plan.slots.length) continue;
      if (!next || c.clock < next.clock) next = c;
    }
    if (!next) break;

    const pool = next.plan.slots[next.ptr];
    const readyOf = (t: TeamEntry) =>
      Math.max(
        dogReady.get(t.dogId) ?? startMs,
        playerReady.get(t.playerId) ?? startMs
      );
    // Consume teams in the pool's round-robin (spread-by-handler) order so a
    // handler's dogs stay spaced out: take the first team whose rest is already
    // satisfied by now, which fills the pitch without idle. Only when nobody is
    // ready yet do we fall back to the earliest-ready team and let the clock jump.
    let pickIdx = pool.teams.findIndex((t) => readyOf(t) <= next.clock);
    if (pickIdx === -1) {
      let bestReady = Infinity;
      pool.teams.forEach((t, idx) => {
        const ready = readyOf(t);
        if (ready < bestReady) {
          bestReady = ready;
          pickIdx = idx;
        }
      });
    }

    const [team] = pool.teams.splice(pickIdx, 1);
    const startTime = Math.max(next.clock, readyOf(team));
    const durMs = slots[pool.discipline] * 1000;
    const endTime = startTime + durMs;

    heats.push({
      eventId,
      categoryId: pool.discipline,
      experienceLevel: pool.level,
      pitchNumber: next.plan.pitchNumber,
      scheduledTime: new Date(startTime),
      team: { playerId: team.playerId, dogId: team.dogId },
      judgeIds: [],
      status: MatchStatus.Pending,
      isFinalsPlaceholder: false,
    });

    dogReady.set(team.dogId, endTime + restMs);
    // §7.1 — player needs only a short turnaround between runs; if the next run
    // reuses the SAME dog, dogReady's full rest dominates anyway.
    playerReady.set(team.playerId, endTime + playerSwitchMs);
    next.clock = endTime;
    next.ptr++;
    pitchEndMs.set(next.plan.pitchNumber, endTime);
  }

  return { heats, pitchEndMs };
}

// ── Finals placeholders (§7.2) ───────────────────────────────────────────────

function buildFinalsPlaceholders(
  plans: Plan[],
  eventId: string,
  pitchEndMs: Map<number, number>,
  slots: SlotSeconds
): HeatDraft[] {
  const placeholders: HeatDraft[] = [];

  for (const disc of [Discipline.JTrail, Discipline.TimeTrail]) {
    const count = FINALS_TEAMS[disc];
    if (!count) continue;

    // Which pitch hosted this discipline's prelims?
    const host = plans.find((p) => p.slots.some((s) => s.discipline === disc));
    if (!host) continue;
    const level =
      host.slots.find((s) => s.discipline === disc)?.level ??
      ExperienceLevel.Advanced;

    let clock = pitchEndMs.get(host.pitchNumber) ?? Date.now();
    const durMs = slots[disc] * 1000;
    for (let i = 0; i < count; i++) {
      placeholders.push({
        eventId,
        categoryId: disc,
        experienceLevel: level,
        pitchNumber: host.pitchNumber,
        scheduledTime: new Date(clock),
        team: {},
        judgeIds: [],
        status: MatchStatus.Pending,
        isFinalsPlaceholder: true,
      });
      clock += durMs;
    }
    pitchEndMs.set(host.pitchNumber, clock);
  }

  return placeholders;
}

// ── Judge-per-pitch assignment (§7.1 judge conflict) ─────────────────────────

async function assignJudges(heats: HeatDraft[], pitchCount: number): Promise<void> {
  const judges = await User.find({ role: UserRole.Judge }).select("_id").lean();
  const available = judges.map((j) => String(j._id));

  for (let pitch = 1; pitch <= pitchCount; pitch++) {
    const pitchHeats = heats.filter((h) => h.pitchNumber === pitch);
    if (pitchHeats.length === 0) continue;

    const competitors = new Set(
      pitchHeats.map((h) => h.team.playerId).filter(Boolean) as string[]
    );
    // Freestyle's main pitch needs a 4-judge panel; everywhere else, one judge.
    const needed = pitch === MAIN_PITCH ? 4 : 1;

    const picked: string[] = [];
    for (let i = available.length - 1; i >= 0 && picked.length < needed; i--) {
      if (!competitors.has(available[i])) picked.push(available.splice(i, 1)[0]);
    }
    for (const h of pitchHeats) h.judgeIds = picked;
  }
}

// ── Orchestrator ─────────────────────────────────────────────────────────────

export interface GenerateOptions {
  slotOverrides?: Partial<Record<Discipline, number>>;
}

/**
 * Regenerate the full schedule for an event from its registrations. Replaces any
 * existing heats. Returns null if the event does not exist.
 */
export async function generateSchedule(
  eventId: string,
  opts: GenerateOptions = {}
): Promise<ScheduleReport | null> {
  const event = await Event.findById(eventId);
  if (!event) return null;

  const slots: SlotSeconds = { ...DEFAULT_SLOT_SECONDS, ...opts.slotOverrides };
  const pitchCount = Math.max(1, event.activePitches);

  const regs = await Registration.find({ eventId })
    .select("playerId dogId discipline experienceLevel")
    .lean();

  const pools = buildPools(regs);
  const plans = buildPlans(pools, pitchCount, slots);
  const { heats, pitchEndMs } = assignTimes(
    plans,
    eventId,
    event.estimatedStartTime,
    event.minRestTimeMinutes,
    slots
  );
  const placeholders = buildFinalsPlaceholders(plans, eventId, pitchEndMs, slots);

  const allHeats = [...heats, ...placeholders];
  await assignJudges(allHeats, pitchCount);

  // Replace the event's schedule atomically enough for our purposes.
  await Match.deleteMany({ eventId });
  // Plain drafts (string ids/Dates) — Mongoose casts them on insert; `any` keeps
  // the strict compiler from rejecting the string-vs-ObjectId shape mismatch.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (allHeats.length > 0) await Match.insertMany(allHeats as any);

  // ── Sanity metrics (§3.2 sanity check / §7.3 utilisation) ──
  const startMs = event.estimatedStartTime.getTime();
  const makespanMs =
    Math.max(startMs, ...Array.from(pitchEndMs.values())) - startMs;
  const makespanMinutes = minutes(makespanMs);

  const totalSlotSeconds = heats.reduce((s, h) => s + slots[h.categoryId], 0);
  const calculatedMinDuration = Math.ceil(totalSlotSeconds / 60 / pitchCount);

  const windowMinutes = Math.max(
    0,
    minutes(event.estimatedEndTime.getTime() - startMs)
  );
  const utilisationPct =
    windowMinutes > 0 ? Math.round((makespanMinutes / windowMinutes) * 100) : 0;
  const fitsWindow = windowMinutes === 0 || makespanMinutes <= windowMinutes;

  const warnings: string[] = [];
  if (!fitsWindow) {
    warnings.push(
      `Schedule needs ~${makespanMinutes} min but the event window is ${windowMinutes} min — widen the window or add pitches.`
    );
  }
  if (regs.length === 0) warnings.push("No registrations found for this event.");

  event.calculatedMinDuration = calculatedMinDuration;
  await event.save();

  return {
    eventId,
    pitches: pitchCount,
    heatsCreated: heats.length,
    placeholdersCreated: placeholders.length,
    makespanMinutes,
    calculatedMinDuration,
    windowMinutes,
    utilisationPct,
    fitsWindow,
    warnings,
  };
}
