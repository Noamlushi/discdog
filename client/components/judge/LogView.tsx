"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Hourglass, ListChecks, RefreshCw } from "lucide-react";
import { useJudgeSession } from "../../context/JudgeSessionContext";
import { useJudgeScope } from "../../context/JudgeScopeContext";
import { useSocket } from "../../context/SocketContext";
import { getHeatStats } from "../../lib/api";
import { describeAction, type ActionKind } from "../../lib/actionLabels";
import { disciplineOf } from "../../lib/disciplines";
import {
  FREESTYLE_PANELS,
  FREESTYLE_ROLES,
  FREESTYLE_ROLE_LABELS,
  FREESTYLE_ROLE_STORAGE_KEY,
  FREESTYLE_PANEL_COUNT,
  type FreestylePanelDef,
  type FreestyleRole,
} from "../../lib/freestyle";
import { refName, type HeatStats, type LiveScorePayload } from "../../lib/types";
import { CLIENT_EVENTS, SERVER_EVENTS } from "../../lib/socketEvents";

// §6.2 ActionLogPanel — the post-run review for the active heat: catch/miss
// stats plus a throw-by-throw timeline, so the team can see exactly what they
// were judged on and where to improve. Data comes from GET /scoring/:matchId
// (recomputed from the action log) and refreshes live on each scoring update.
// Scoped to one competition/league round via JudgeScope's `basePath`.
export function LogView() {
  const router = useRouter();
  const { basePath } = useJudgeScope();
  const { activeHeat: heat, endRun } = useJudgeSession();
  const { socket } = useSocket();

  const nextCompetitor = () => {
    endRun();
    router.push(basePath);
  };

  const [stats, setStats] = useState<HeatStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Which panel judge this tablet is — drives the Freestyle "my summary" view.
  const [myRole, setMyRole] = useState<FreestyleRole>("dog");
  useEffect(() => {
    const saved = localStorage.getItem(
      FREESTYLE_ROLE_STORAGE_KEY
    ) as FreestyleRole | null;
    if (saved && FREESTYLE_ROLES.includes(saved)) setMyRole(saved);
  }, []);

  const load = useCallback(() => {
    if (!heat) return;
    getHeatStats(heat._id)
      .then((s) => {
        setStats(s);
        setError(null);
      })
      .catch((e) => setError((e as Error).message));
  }, [heat]);

  useEffect(() => {
    load();
  }, [load]);

  // Refresh whenever a score update lands for this heat (live taps / undo).
  useEffect(() => {
    if (!socket || !heat) return;
    socket.emit(CLIENT_EVENTS.JOIN_EVENT_ROOM, heat.eventId);
    const onLive = (p: LiveScorePayload) => {
      if (p.matchId === heat._id) load();
    };
    socket.on(SERVER_EVENTS.LIVE_SCORE_UPDATED, onLive);
    return () => {
      socket.off(SERVER_EVENTS.LIVE_SCORE_UPDATED, onLive);
    };
  }, [socket, heat, load]);

  if (!heat) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-muted">אין מקצה פעיל.</p>
        <Link href={basePath} className="ds-btn ds-btn-primary">
          חזרה ל-On-Deck
        </Link>
      </div>
    );
  }

  const b = stats?.breakdown ?? {};
  const catches = b.catches ?? 0;
  const misses = b.misses ?? 0;
  const attempts = catches + misses;
  const catchRate = attempts > 0 ? Math.round((catches / attempts) * 100) : null;

  // Freestyle review is staged: each judge sees only their own panel + how many
  // judges are left, then the overall /40 summary appears once all four finish.
  const isFreestyle = heat.categoryId === "Freestyle";
  const panelsDone = b.panelsDone ?? 0;
  const panelsTotal = b.panelsTotal ?? FREESTYLE_PANEL_COUNT;
  const allPanelsDone = panelsDone >= panelsTotal;
  const freestyleWaiting = isFreestyle && !allPanelsDone;

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <span className="flex items-center gap-2">
          <ListChecks className="h-6 w-6 text-accent" />
          <h1 className="text-2xl font-black">סיכום מקצה</h1>
        </span>
        <button
          type="button"
          onClick={load}
          aria-label="רענן"
          className="rounded-xl border border-line p-2 text-muted transition active:scale-95"
        >
          <RefreshCw className="h-5 w-5" />
        </button>
      </header>

      {/* Competitor */}
      <div className="ds-card p-5">
        <p className="text-lg font-bold">{refName(heat.team?.playerId) ?? "—"}</p>
        <p className="text-sm text-muted">
          {refName(heat.team?.dogId) ?? "—"} ·{" "}
          {disciplineOf(heat.categoryId)?.nameHe ?? heat.categoryId}
        </p>
      </div>

      {error && (
        <p className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm font-semibold text-danger">
          {error}
        </p>
      )}

      {/* Stat cards — Freestyle is staged (own panel → waiting → overall /40) */}
      {isFreestyle ? (
        freestyleWaiting ? (
          <>
            <FreestyleOwnSummary role={myRole} breakdown={b} />
            <FreestyleWaiting breakdown={b} />
          </>
        ) : (
          <FreestyleStats breakdown={b} display={stats?.display ?? "—"} />
        )
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="ניקוד" value={stats?.display ?? "—"} tone="nav" />
          <StatCard label="תפיסות" value={String(catches)} tone="live" />
          <StatCard label="החטאות" value={String(misses)} tone="miss" />
          <StatCard
            label="אחוז הצלחה"
            value={catchRate == null ? "—" : `${catchRate}%`}
          />
        </div>
      )}

      {/* Throw-by-throw timeline — hidden until the full panel summary is shown */}
      {!freestyleWaiting && (
        <section>
          <h2 className="ds-label mb-2">ציר זמן הזריקות</h2>
          {!stats || stats.timeline.length === 0 ? (
            <p className="ds-card p-6 text-center text-sm text-muted">
              עדיין לא נרשמו פעולות במקצה הזה.
            </p>
          ) : (
            <ol className="space-y-2">
              {stats.timeline.map((entry, i) => {
                const { text, kind } = describeAction(
                  stats.categoryId,
                  entry.actionData
                );
                return (
                  <li
                    key={i}
                    className="ds-card flex items-center justify-between px-4 py-3"
                  >
                    <span className="flex items-center gap-3">
                      <span className="w-6 font-score text-sm text-muted tabular-nums">
                        {i + 1}
                      </span>
                      <KindDot kind={kind} />
                      <span className="font-medium">{text}</span>
                    </span>
                    <span className="font-score text-sm text-muted tabular-nums">
                      {entry.timestamp}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      )}

      <button
        type="button"
        onClick={nextCompetitor}
        className="flex h-tap w-full items-center justify-center gap-2 rounded-2xl bg-lime text-lg font-black text-lime-ink shadow-glow transition active:scale-[0.99]"
      >
        <ArrowLeft className="h-6 w-6" />
        המשך למתחרה הבא
      </button>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "nav" | "live" | "miss";
}) {
  const valueCls =
    tone === "live"
      ? "text-accent"
      : tone === "nav"
        ? "text-accent"
        : tone === "miss"
          ? "text-danger"
          : "text-ink";
  return (
    <div className="ds-card p-4 text-center">
      <p className="ds-label">{label}</p>
      <p className={`mt-1 font-score text-3xl font-black tabular-nums ${valueCls}`}>
        {value}
      </p>
    </div>
  );
}

const PANEL_TOTAL_KEY: Record<string, string> = {
  dog: "dogTotal",
  player: "playerTotal",
  team: "teamTotal",
};

// One dog/player/team panel — its elements (team flags the top-4 that count)
// and the panel subtotal /10. Shared by the own-summary and the overall view.
function FreestylePanelCard({
  panel,
  breakdown,
}: {
  panel: FreestylePanelDef;
  breakdown: Record<string, number>;
}) {
  const counted = new Set<string>();
  if (panel.counted) {
    [...panel.elements]
      .sort((a, b) => (breakdown[b.key] ?? 0) - (breakdown[a.key] ?? 0))
      .slice(0, panel.counted)
      .forEach((e) => {
        if ((breakdown[e.key] ?? 0) > 0) counted.add(e.key);
      });
  }
  return (
    <div className="ds-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-bold">{panel.he}</span>
        <span className="font-score text-sm font-bold tabular-nums text-accent">
          {(breakdown[PANEL_TOTAL_KEY[panel.key]] ?? 0).toFixed(1)}/10
        </span>
      </div>
      <div className="space-y-1">
        {panel.elements.map((el) => {
          const v = breakdown[el.key];
          return (
            <div key={el.key} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted">
                {panel.counted && (
                  <span
                    className={`h-2 w-2 rounded-full ${
                      counted.has(el.key) ? "bg-lime" : "bg-surface-2"
                    }`}
                  />
                )}
                {el.he}
              </span>
              <span className="font-score tabular-nums text-muted">
                {v == null ? "—" : `${v.toFixed(1)}/2.5`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// The execution judge's card — derived catches / throws ratio out of 10.
function FreestyleExecutionCard({
  breakdown,
}: {
  breakdown: Record<string, number>;
}) {
  const catches = breakdown.catches ?? 0;
  const throws = breakdown.throws ?? 0;
  return (
    <div className="ds-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-bold">שופט ביצוע</span>
        <span className="font-score text-sm font-bold tabular-nums text-accent">
          {(breakdown.executionTotal ?? 0).toFixed(1)}/10
        </span>
      </div>
      <p className="text-sm text-muted">
        {catches} תפיסות מתוך {throws} זריקות
        {throws > 0 && ` · ${Math.round((catches / throws) * 100)}% הצלחה`}
      </p>
    </div>
  );
}

// While the panel is still scoring: each judge sees only THEIR own card.
function FreestyleOwnSummary({
  role,
  breakdown,
}: {
  role: FreestyleRole;
  breakdown: Record<string, number>;
}) {
  const panel = FREESTYLE_PANELS.find((p) => p.key === role);
  return (
    <div className="space-y-2">
      <h2 className="ds-label">
        {FREESTYLE_ROLE_LABELS[role]} — הסיכום שלי
      </h2>
      {panel ? (
        <FreestylePanelCard panel={panel} breakdown={breakdown} />
      ) : (
        <FreestyleExecutionCard breakdown={breakdown} />
      )}
    </div>
  );
}

// "You're done — waiting on N judges: …" with the still-scoring roles by name.
function FreestyleWaiting({ breakdown }: { breakdown: Record<string, number> }) {
  const pending = FREESTYLE_ROLES.filter((r) => (breakdown[`${r}Done`] ?? 0) < 1);
  return (
    <div className="ds-card space-y-3 p-4">
      <p className="flex items-center justify-center gap-2 rounded-xl bg-lime/15 px-3 py-2 text-sm font-bold text-accent">
        <Check className="h-5 w-5" /> סיימת את השיפוט שלך
      </p>
      <div className="flex items-center gap-2 text-sm font-medium text-muted">
        <Hourglass className="h-4 w-4 text-muted" />
        ממתין ל-{pending.length} {pending.length === 1 ? "שופט" : "שופטים"}:
      </div>
      <ul className="space-y-1 pr-6">
        {pending.map((r) => (
          <li key={r} className="flex items-center gap-2 text-sm text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-muted" />
            {FREESTYLE_ROLE_LABELS[r]}
          </li>
        ))}
      </ul>
      <p className="text-center text-xs text-muted">
        הסיכום הכללי יופיע אוטומטית כשכל הפאנל יסיים.
      </p>
    </div>
  );
}

// Full Freestyle rubric breakdown — shown to everyone once all four judges are
// done: the overall /40, each panel's elements, and the execution ratio.
function FreestyleStats({
  breakdown,
  display,
}: {
  breakdown: Record<string, number>;
  display: string;
}) {
  return (
    <div className="space-y-3">
      <div className="ds-card flex items-center justify-between p-4">
        <span className="ds-label">ציון כולל</span>
        <span className="font-score text-3xl font-black tabular-nums text-accent">
          {display}/40
        </span>
      </div>

      {FREESTYLE_PANELS.map((panel) => (
        <FreestylePanelCard key={panel.key} panel={panel} breakdown={breakdown} />
      ))}

      <FreestyleExecutionCard breakdown={breakdown} />
    </div>
  );
}

function KindDot({ kind }: { kind: ActionKind }) {
  const cls =
    kind === "catch"
      ? "bg-lime"
      : kind === "miss"
        ? "bg-danger"
        : "bg-muted";
  return <span className={`h-2.5 w-2.5 rounded-full ${cls}`} />;
}
