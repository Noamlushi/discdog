"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Flag, Trophy } from "lucide-react";
import { useJudgeSession } from "../../context/JudgeSessionContext";
import { useJudgeScope } from "../../context/JudgeScopeContext";
import { useSocket } from "../../context/SocketContext";
import { SmartTimer, elapsedSince } from "./SmartTimer";
import { UndoFab } from "./UndoFab";
import { DisciplineScorer } from "./scorers";
import {
  postScoringAction,
  setHeatStatus,
  undoScoringAction,
} from "../../lib/api";
import {
  disciplineOf,
  durationSeconds,
  formatClock,
} from "../../lib/disciplines";
import { refName, type ScoreResponse, type LiveScorePayload } from "../../lib/types";
import { CLIENT_EVENTS, SERVER_EVENTS } from "../../lib/socketEvents";

// §3.3 Live Scoring — discipline-specific tap scoring with a resilient timer, a
// live running total, and a floating Undo. Scoped to one competition/league round
// via JudgeScope's `basePath`.
export function ScoringView() {
  const router = useRouter();
  const { basePath } = useJudgeScope();
  const { activeHeat: heat, runStartedAt } = useJudgeSession();
  const { socket } = useSocket();

  const [score, setScore] = useState<ScoreResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const discipline = heat ? disciplineOf(heat.categoryId) : undefined;
  // Freestyle is a 4-judge panel: each judge finishes their own role from inside
  // the scorer, so the page hides its single global "finish heat" button. §5.2
  const isPanel = discipline?.family === "panel";

  // Join the event room and mirror score broadcasts (keeps the panel in sync,
  // and drives Freestyle's 4-tablet sync, §5.2).
  useEffect(() => {
    if (!socket || !heat) return;
    socket.emit(CLIENT_EVENTS.JOIN_EVENT_ROOM, heat.eventId);

    const onLive = (p: LiveScorePayload) => {
      if (p.matchId === heat._id) {
        setScore({ score: p.score, display: p.display, breakdown: p.breakdown });
      }
    };
    socket.on(SERVER_EVENTS.LIVE_SCORE_UPDATED, onLive);
    socket.on(SERVER_EVENTS.FREESTYLE_SYNC, onLive);
    return () => {
      socket.off(SERVER_EVENTS.LIVE_SCORE_UPDATED, onLive);
      socket.off(SERVER_EVENTS.FREESTYLE_SYNC, onLive);
    };
  }, [socket, heat]);

  const handleAction = useCallback(
    async (actionData: Record<string, unknown>) => {
      if (!heat) return;
      try {
        const ts = formatClock(elapsedSince(runStartedAt));
        const r = await postScoringAction(heat._id, ts, actionData);
        setScore(r);
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [heat, runStartedAt]
  );

  const handleUndo = useCallback(async () => {
    if (!heat) return;
    try {
      const r = await undoScoringAction(heat._id);
      setScore(r);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [heat]);

  const handleFinish = async () => {
    if (!heat) return;
    setBusy(true);
    try {
      const secs = Math.round(elapsedSince(runStartedAt));
      if (discipline?.timed) {
        // Timed disciplines stop the clock with a completion action + finalScore.
        await postScoringAction(heat._id, formatClock(secs), {
          completed: true,
          elapsedSeconds: secs,
        });
        await setHeatStatus(heat._id, "Completed", secs);
      } else {
        await setHeatStatus(heat._id, "Completed");
      }
      // Keep the run in session and land on the review summary so the judge can
      // show the team what they were scored on before moving on (§6.2).
      router.push(`${basePath}/log`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  if (!heat || runStartedAt == null) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-muted">אין מקצה פעיל.</p>
        <Link href={basePath} className="ds-btn ds-btn-primary">
          <Flag className="h-5 w-5" /> חזרה ל-On-Deck
        </Link>
      </div>
    );
  }

  const countdown = durationSeconds(heat.categoryId, heat.experienceLevel);

  return (
    <div className="space-y-5">
      {/* Competitor + discipline */}
      <header className="flex items-center justify-between">
        <div>
          <p className="text-lg font-bold">{refName(heat.team?.playerId) ?? "—"}</p>
          <p className="text-sm text-muted">
            {refName(heat.team?.dogId) ?? "—"} · {discipline?.nameHe} ·{" "}
            {heat.experienceLevel}
          </p>
        </div>
        <span className="ds-pill ds-pill-ondeck text-sm">
          מגרש {heat.pitchNumber}
        </span>
      </header>

      {/* Timer + live score */}
      <div className="ds-card flex items-center justify-between p-5">
        <SmartTimer startedAt={runStartedAt} countdownSeconds={countdown} />
        <div className="text-left">
          <p className="ds-label">ניקוד</p>
          <p className="font-score text-5xl font-black tabular-nums text-accent">
            {score?.display ?? "0"}
          </p>
        </div>
      </div>

      {error && (
        <p className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm font-semibold text-danger">
          {error}
        </p>
      )}

      {/* Discipline-specific scoring controls */}
      <DisciplineScorer
        heat={heat}
        onAction={handleAction}
        disabled={busy}
        score={score}
        onFinish={() => router.push(`${basePath}/log`)}
      />

      {/* Finish — Freestyle finishes per-judge inside the scorer, so the global
          "finish heat" button is shown only for single-judge disciplines. */}
      {!isPanel && (
        <button
          type="button"
          onClick={handleFinish}
          disabled={busy}
          className="flex h-tap w-full items-center justify-center gap-2 rounded-2xl bg-lime text-lg font-black text-lime-ink shadow-glow transition active:scale-[0.99] disabled:opacity-50"
        >
          <Trophy className="h-6 w-6" />
          סיים מקצה
        </button>
      )}

      <UndoFab onUndo={handleUndo} disabled={busy} />
    </div>
  );
}
