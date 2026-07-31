"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Dog, PawPrint, Radio, Trophy, User } from "lucide-react";
import { useLiveSession } from "../../context/LiveSessionContext";
import { useLiveHeats, type LiveScoreState } from "../../lib/useLiveHeats";
import { getLeaderboards } from "../../lib/api";
import {
  disciplineOf,
  durationSeconds,
  formatClock,
  LEVEL_HE,
} from "../../lib/disciplines";
import { LiveCountdown } from "./LiveCountdown";
import {
  refName,
  type HeatDto,
  type LeaderboardsResponse,
} from "../../lib/types";

// §3.4 Public Live Now — a "control-room" dashboard built around one hero card
// (the headline live run, with its huge running score + depleting run clock)
// surrounded by tiles: the other pitch(es), an event-progress gauge, and a
// leaders rail. Warm-sunset themed, responsive from phone up to a venue TV.
export default function LivePage() {
  const { eventId, event, loading: eventLoading } = useLiveSession();
  const { heats, scores, loading } = useLiveHeats(eventId);

  const realHeats = useMemo(
    () => heats.filter((h) => !h.isFinalsPlaceholder),
    [heats]
  );
  const completed = realHeats.filter((h) => h.status === "Completed").length;
  const total = realHeats.length;
  const pct = total ? Math.round((completed / total) * 100) : 0;

  // Pitch count comes from the event; fall back to whatever the heats reveal.
  const pitchCount =
    event?.activePitches ??
    realHeats.reduce((max, h) => Math.max(max, h.pitchNumber), 0);

  // Resolve each pitch into { live, onDeck } once, then promote the most
  // exciting one (a running heat, else pitch 1) to the hero slot.
  const pitchStates = useMemo(
    () =>
      Array.from({ length: pitchCount }, (_, i) => {
        const pitch = i + 1;
        const onPitch = realHeats.filter((h) => h.pitchNumber === pitch);
        const live = onPitch.find((h) => h.status === "Live");
        const onDeck = onPitch.find(
          (h) => h.status !== "Completed" && h._id !== live?._id
        );
        return { pitch, live, onDeck };
      }),
    [realHeats, pitchCount]
  );

  const hero = pitchStates.find((p) => p.live) ?? pitchStates[0];
  const others = pitchStates.filter((p) => p.pitch !== hero?.pitch);

  if (eventLoading || (loading && heats.length === 0)) {
    return <p className="py-16 text-center text-muted">טוען…</p>;
  }
  if (!eventId) {
    return (
      <p className="py-16 text-center text-muted">
        בחר תחרות כדי לצפות בשידור החי.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Hero — the headline live run, spanning two columns on wide screens. */}
        {hero && (
          <HeroPitch
            className="lg:col-span-2"
            pitch={hero.pitch}
            live={hero.live}
            onDeck={hero.onDeck}
            score={hero.live ? scores[hero.live._id] : undefined}
          />
        )}

        {/* Right rail of control-panel tiles (stacks below the hero on mobile). */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <ProgressTile completed={completed} total={total} pct={pct} />
          {others.map((p) => (
            <MiniPitch
              key={p.pitch}
              pitch={p.pitch}
              live={p.live}
              onDeck={p.onDeck}
              score={p.live ? scores[p.live._id] : undefined}
            />
          ))}
        </div>
      </div>

      <LeadersRail eventId={eventId} completed={completed} />
    </div>
  );
}

// ── Hero ────────────────────────────────────────────────────────────────────

function HeroPitch({
  pitch,
  live,
  onDeck,
  score,
  className = "",
}: {
  pitch: number;
  live: HeatDto | undefined;
  onDeck: HeatDto | undefined;
  score: LiveScoreState | undefined;
  className?: string;
}) {
  const discipline = live ? disciplineOf(live.categoryId) : undefined;

  return (
    <section
      className={`relative overflow-hidden rounded-3xl p-6 text-white shadow-glow ring-1 ring-white/10 sm:p-8 ${className}`}
      style={{
        // Fixed "arena" media card — a floodlit-turf gradient with a lime glow.
        // Stays premium in both light and dark; white text always legible.
        background:
          "radial-gradient(120% 80% at 72% 12%, rgba(163,230,53,0.14), transparent 55%), radial-gradient(90% 70% at 25% 95%, rgba(20,70,35,0.55), transparent 60%), linear-gradient(160deg, #121c14 0%, #0b120d 62%, #0a0e0c 100%)",
      }}
    >
      {/* Decorative paws drifting behind the content. */}
      <PawPrint className="pointer-events-none absolute -left-6 -top-6 h-40 w-40 rotate-12 text-white/10 animate-paw-drift" />
      <PawPrint className="pointer-events-none absolute -bottom-10 right-6 h-28 w-28 -rotate-12 text-white/10" />

      <div className="relative">
        {/* Pitch + status row */}
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1.5 text-sm font-bold backdrop-blur">
            <Dog className="h-4 w-4" />
            מגרש {pitch}
          </span>
          {live ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/25 px-3 py-1.5 text-xs font-extrabold uppercase tracking-wide backdrop-blur">
              <Radio className="h-3.5 w-3.5 animate-pulse" />
              משחק עכשיו
            </span>
          ) : (
            <span className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold backdrop-blur">
              פנוי
            </span>
          )}
        </div>

        {live ? (
          <>
            {discipline && (
              <p className="mt-5 text-sm font-bold text-white/85">
                {discipline.nameHe} · {LEVEL_HE[live.experienceLevel]}
              </p>
            )}

            {/* Competitor + the headline running score */}
            <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
              <div className="min-w-0">
                <p className="flex items-center gap-2 truncate text-3xl font-black sm:text-4xl">
                  {refName(live.team?.playerId) ?? "—"}
                </p>
                <p className="mt-1 flex items-center gap-2 truncate text-lg font-semibold text-white/85">
                  <Dog className="h-5 w-5 shrink-0" />
                  {refName(live.team?.dogId) ?? "—"}
                </p>
              </div>
              <div className="text-left">
                <p className="text-xs font-bold uppercase tracking-widest text-white/70">
                  ניקוד
                </p>
                <AnimatedScore display={score?.display ?? "0"} />
              </div>
            </div>

            <HeroClock
              liveStartedAt={live.liveStartedAt}
              total={durationSeconds(live.categoryId, live.experienceLevel)}
            />
          </>
        ) : (
          <div className="py-10 text-center">
            <p className="text-5xl">🐕</p>
            <p className="mt-3 text-lg font-bold text-white/90">
              אין מקצה רץ עכשיו במגרש זה
            </p>
          </div>
        )}

        {onDeck && (
          <div className="mt-6 flex items-center justify-between gap-3 rounded-2xl bg-white/15 px-4 py-3 backdrop-blur">
            <span className="text-xs font-bold uppercase tracking-wide text-white/70">
              הבא בתור
            </span>
            <span className="truncate text-sm font-bold">
              {refName(onDeck.team?.playerId) ?? "—"}
              <span className="font-medium text-white/75">
                {" · "}
                {disciplineOf(onDeck.categoryId)?.nameHe ?? onDeck.categoryId}
              </span>
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

// The running score, scaled up briefly each time the value changes so a catch
// reads as a beat of motion on the big screen.
function AnimatedScore({ display }: { display: string }) {
  const [pop, setPop] = useState(0);
  const prev = useRef(display);

  useEffect(() => {
    if (prev.current !== display) {
      prev.current = display;
      setPop((p) => p + 1);
    }
  }, [display]);

  return (
    <span
      key={pop}
      className="block animate-score-pop font-score text-6xl font-black tabular-nums leading-none text-lime drop-shadow-[0_0_28px_rgba(163,230,53,0.45)] sm:text-7xl"
    >
      {display}
    </span>
  );
}

// Big run clock + a depleting bar. Epoch-derived from the server `liveStartedAt`
// so it stays accurate across reloads, mirroring LiveCountdown (§3.4).
function HeroClock({
  liveStartedAt,
  total,
}: {
  liveStartedAt: string | null | undefined;
  total: number;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  const elapsed = liveStartedAt
    ? (now - new Date(liveStartedAt).getTime()) / 1000
    : 0;
  const left = Math.max(0, total - elapsed);
  const widthPct = total > 0 ? Math.min(100, (left / total) * 100) : 0;
  const done = !!liveStartedAt && left <= 0;
  const urgent = left > 0 && left <= 15;

  return (
    <div className="mt-6">
      <div className="mb-1.5 flex items-center justify-between text-sm font-bold">
        <span className="text-white/70">זמן שנותר</span>
        <span
          className={`font-score text-2xl tabular-nums ${
            urgent ? "animate-pulse" : ""
          }`}
        >
          {done ? "נגמר" : formatClock(left)}
        </span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-black/20">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ease-linear ${
            urgent ? "bg-white animate-pulse" : "bg-white/90"
          }`}
          style={{ width: `${widthPct}%` }}
        />
      </div>
    </div>
  );
}

// ── Tiles ─────────────────────────────────────────────────────────────────────

// A radial completion gauge — the "how far through the day are we" panel.
function ProgressTile({
  completed,
  total,
  pct,
}: {
  completed: number;
  total: number;
  pct: number;
}) {
  const deg = pct * 3.6;
  return (
    <div className="ds-card flex items-center gap-4 p-5">
      <div
        className="grid h-20 w-20 shrink-0 place-items-center rounded-full"
        style={{
          background: `conic-gradient(var(--color-lime), var(--color-accent) ${deg}deg, color-mix(in srgb, var(--color-lime) 12%, transparent) ${deg}deg)`,
        }}
      >
        <div className="grid h-14 w-14 place-items-center rounded-full bg-surface font-score text-base font-black tabular-nums text-accent">
          {pct}%
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold text-muted">התקדמות התחרות</p>
        <p className="font-score text-2xl font-black tabular-nums text-ink">
          {completed}
          <span className="text-lg font-bold text-muted"> / {total}</span>
        </p>
        <p className="text-xs font-semibold text-muted">מקצים הושלמו</p>
      </div>
    </div>
  );
}

// A compact live tile for the non-hero pitch(es).
function MiniPitch({
  pitch,
  live,
  onDeck,
  score,
}: {
  pitch: number;
  live: HeatDto | undefined;
  onDeck: HeatDto | undefined;
  score: LiveScoreState | undefined;
}) {
  const discipline = live ? disciplineOf(live.categoryId) : undefined;

  return (
    <div className="ds-card overflow-hidden">
      <div className="h-1.5 w-full bg-lime" />
      <div className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 font-extrabold text-ink">
            <Dog className="h-4 w-4 text-accent" />
            מגרש {pitch}
          </h2>
          {live ? (
            <span className="ds-pill ds-pill-live text-[11px] uppercase tracking-wide">
              <span className="ds-dot animate-live-pulse" />
              חי
            </span>
          ) : (
            <span className="ds-pill ds-pill-done text-[11px]">פנוי</span>
          )}
        </div>

        {live ? (
          <div className="mt-3 space-y-2">
            {discipline && (
              <p className="text-xs font-bold text-muted">
                {discipline.nameHe} · {LEVEL_HE[live.experienceLevel]}
              </p>
            )}
            <div className="flex items-end justify-between gap-2">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 truncate font-bold text-ink">
                  <User className="h-4 w-4 shrink-0 text-muted" />
                  {refName(live.team?.playerId) ?? "—"}
                </p>
                <p className="flex items-center gap-1.5 truncate text-sm text-muted">
                  <Dog className="h-4 w-4 shrink-0 text-muted" />
                  {refName(live.team?.dogId) ?? "—"}
                </p>
              </div>
              <p className="font-score text-3xl font-black tabular-nums text-accent">
                {score?.display ?? "0"}
              </p>
            </div>
            <div className="flex items-center justify-between border-t border-line pt-2">
              <span className="text-xs font-semibold text-muted">זמן שנותר</span>
              <LiveCountdown
                liveStartedAt={live.liveStartedAt}
                durationSeconds={durationSeconds(
                  live.categoryId,
                  live.experienceLevel
                )}
              />
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm font-medium text-muted">
            אין מקצה פעיל כרגע
          </p>
        )}

        {onDeck && (
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-2.5 text-sm">
            <span className="text-xs font-bold text-muted">הבא בתור</span>
            <span className="truncate font-semibold text-ink/80">
              {refName(onDeck.team?.playerId) ?? "—"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Leaders rail ──────────────────────────────────────────────────────────────

// Top team per discipline + level — refreshes whenever a heat completes.
function LeadersRail({
  eventId,
  completed,
}: {
  eventId: string;
  completed: number;
}) {
  const [data, setData] = useState<LeaderboardsResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    getLeaderboards(eventId)
      .then((d) => !cancelled && setData(d))
      .catch(() => !cancelled && setData(null));
    return () => {
      cancelled = true;
    };
    // `completed` changes as heats finish, pulling fresh standings.
  }, [eventId, completed]);

  const leaders = useMemo(() => {
    if (!data) return [];
    const out: {
      key: string;
      nameHe: string;
      level: string;
      player: string | null;
      display: string;
    }[] = [];
    for (const cat of data.categories) {
      for (const [level, entries] of Object.entries(cat.levels)) {
        const top = entries.find((e) => e.rank === 1);
        if (top) {
          out.push({
            key: `${cat.categoryId}-${level}`,
            nameHe: cat.nameHe,
            level: LEVEL_HE[level as keyof typeof LEVEL_HE] ?? level,
            player: top.player,
            display: top.display,
          });
        }
      }
    }
    return out;
  }, [data]);

  if (leaders.length === 0) return null;

  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 text-lg font-extrabold text-ink">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-lime to-lime-bright text-lime-ink shadow-glow">
          <Trophy className="h-4 w-4" />
        </span>
        מובילים לפי מקצוע
      </h2>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
        {leaders.map((l) => (
          <div
            key={l.key}
            className="ds-card relative w-48 shrink-0 overflow-hidden p-4"
          >
            <span className="absolute -right-3 -top-3 text-4xl opacity-20">
              🥇
            </span>
            <p className="truncate text-xs font-bold text-muted">
              {l.nameHe} · {l.level}
            </p>
            <p className="mt-1 truncate font-extrabold text-ink">
              {l.player ?? "—"}
            </p>
            <p className="mt-1 font-score text-3xl font-black tabular-nums text-accent">
              {l.display}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
