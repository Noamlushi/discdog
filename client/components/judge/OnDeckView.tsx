"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Dog,
  ListOrdered,
  MapPin,
  Play,
  RefreshCw,
  User,
} from "lucide-react";
import { useJudgeSession } from "../../context/JudgeSessionContext";
import { useJudgeScope } from "../../context/JudgeScopeContext";
import { useSocket } from "../../context/SocketContext";
import { RunOrderEditor } from "../schedule/RunOrderEditor";
import { getHeats, setHeatStatus } from "../../lib/api";
import { disciplineOf } from "../../lib/disciplines";
import { CLIENT_EVENTS, SERVER_EVENTS } from "../../lib/socketEvents";
import { refName, type HeatDto } from "../../lib/types";

// §3.3 On-Deck (scoped) — the competition is fixed by the route (JudgeScope), so
// there is no competition picker. Pick a pitch (skipped for single-pitch events),
// see the next competitor, and tap Start Run to begin scoring.
export function OnDeckView() {
  const router = useRouter();
  const { basePath, event } = useJudgeScope();
  const { eventId, pitch, setPitch, startRun } = useJudgeSession();
  const { socket } = useSocket();

  const [pitchHeats, setPitchHeats] = useState<HeatDto[]>([]);
  const [ordering, setOrdering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!eventId || pitch == null) {
      setPitchHeats([]);
      return;
    }
    setLoading(true);
    getHeats({ eventId, pitch })
      .then((heats) => {
        setPitchHeats(heats);
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [eventId, pitch]);

  // The next competitor is simply the first non-completed heat in the pitch's
  // run order (heats come back sorted by scheduled time).
  const queue = useMemo(
    () =>
      pitchHeats.filter(
        (h) => !h.isFinalsPlaceholder && h.status !== "Completed"
      ),
    [pitchHeats]
  );
  const onDeck = queue[0] ?? null;
  const upcoming = queue.slice(1, 4);

  useEffect(() => {
    load();
  }, [load]);

  // The run order can change under the judge's feet — an organizer reorders the
  // schedule, or another pitch's judge finishes a heat — so re-pull the queue on
  // those broadcasts instead of showing whoever was next when the screen opened.
  useEffect(() => {
    if (!socket || !eventId) return;
    socket.emit(CLIENT_EVENTS.JOIN_EVENT_ROOM, eventId);
    socket.on(SERVER_EVENTS.SCHEDULE_UPDATED, load);
    socket.on(SERVER_EVENTS.MATCH_STATUS_CHANGED, load);
    return () => {
      socket.off(SERVER_EVENTS.SCHEDULE_UPDATED, load);
      socket.off(SERVER_EVENTS.MATCH_STATUS_CHANGED, load);
    };
  }, [socket, eventId, load]);

  const handleStart = async () => {
    if (!onDeck) return;
    try {
      if (onDeck.status !== "Live") await setHeatStatus(onDeck._id, "Live");
      startRun(onDeck);
      router.push(`${basePath}/scoring`);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">הבא בתור</h1>
          <p className="mt-1 text-muted">
            {event.activePitches > 1
              ? "בחר מגרש כדי לראות מי הבא בתור, ואז לחץ ״התחל שיפוט״."
              : "מי הבא בתור — לחץ ״התחל שיפוט״ כדי להתחיל."}
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          aria-label="רענן"
          className="shrink-0 rounded-xl border border-line p-2 text-muted transition active:scale-95"
        >
          <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </header>

      {error && (
        <p className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm font-semibold text-danger">
          {error}
        </p>
      )}

      {/* Pitch picker — only when the competition runs more than one pitch. */}
      {event.activePitches > 1 && (
        <div>
          <span className="mb-2 block text-sm font-bold text-ink">מגרש</span>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: event.activePitches }, (_, i) => i + 1).map(
              (n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPitch(n)}
                  className={`flex h-16 w-16 items-center justify-center rounded-2xl text-xl font-black transition ${
                    pitch === n
                      ? "bg-lime text-lime-ink shadow-glow"
                      : "border border-line bg-surface-2 text-ink hover:bg-elevated"
                  }`}
                >
                  {n}
                </button>
              )
            )}
          </div>
        </div>
      )}

      {/* On-deck card */}
      {pitch != null && (
        <section className="ds-card p-6">
          {loading ? (
            <p className="text-center text-muted">טוען…</p>
          ) : onDeck ? (
            <OnDeckCard heat={onDeck} onStart={handleStart} />
          ) : (
            <p className="text-center text-muted">
              אין מקצים ממתינים במגרש {pitch}.
            </p>
          )}
        </section>
      )}

      {/* The run order, right here in the judging flow — the judge sees who is
          coming and can fix the order on the spot (someone late, two teams
          swapping). It writes the same times the public schedule reads, so the
          dashboard and this queue never disagree. §3.2 */}
      {pitch != null && pitchHeats.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="ds-label">{ordering ? "סדר עלייה" : "אחריו"}</h2>
            <button
              type="button"
              onClick={() => {
                setOrdering((v) => !v);
                setError(null);
              }}
              className={`ds-btn px-3 py-1.5 text-xs ${
                ordering ? "ds-btn-primary" : "ds-btn-ghost"
              }`}
            >
              {ordering ? (
                <>
                  <Check className="h-4 w-4" />
                  סיום סידור
                </>
              ) : (
                <>
                  <ListOrdered className="h-4 w-4" />
                  סדר עלייה
                </>
              )}
            </button>
          </div>

          {ordering ? (
            <>
              <p className="rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm text-muted">
                גרור או השתמש בחיצים כדי לשנות את סדר העלייה. השעות של המגרש
                נשארות — רק המתמודדים מתחלפים ביניהן, וגם לוח הזמנים בדשבורד
                מתעדכן.
              </p>
              <RunOrderEditor
                eventId={eventId!}
                heats={pitchHeats}
                onChanged={load}
                onError={setError}
              />
            </>
          ) : (
            upcoming.length > 0 && (
              <ol className="space-y-2">
                {upcoming.map((heat, i) => (
                  <li
                    key={heat._id}
                    className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-2.5"
                  >
                    <span className="w-5 shrink-0 text-center font-score text-sm text-muted">
                      {i + 2}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">
                      <span className="font-bold">
                        {refName(heat.team?.playerId) ?? "—"}
                      </span>
                      <span className="text-muted">
                        {" · "}
                        {refName(heat.team?.dogId) ?? "—"}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            )
          )}
        </section>
      )}
    </div>
  );
}

function OnDeckCard({ heat, onStart }: { heat: HeatDto; onStart: () => void }) {
  const discipline = disciplineOf(heat.categoryId);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-sm font-bold text-accent">
          <MapPin className="h-4 w-4" />
          {discipline?.nameHe ?? heat.categoryId} · {heat.experienceLevel}
        </span>
        <span className="text-sm text-muted">
          {heat.status === "Live" ? "רץ עכשיו" : "הבא בתור"}
        </span>
      </div>

      <div className="space-y-2">
        <p className="flex items-center gap-2 text-xl font-bold">
          <User className="h-5 w-5 text-muted" />
          {refName(heat.team?.playerId) ?? "—"}
        </p>
        <p className="flex items-center gap-2 text-lg">
          <Dog className="h-5 w-5 text-muted" />
          {refName(heat.team?.dogId) ?? "—"}
        </p>
      </div>

      <button
        type="button"
        onClick={onStart}
        className="flex h-tap w-full items-center justify-center gap-2 rounded-2xl bg-lime text-lg font-black text-lime-ink shadow-glow transition active:scale-[0.99]"
      >
        <Play className="h-6 w-6" />
        {heat.status === "Live" ? "המשך שיפוט" : "התחל שיפוט"}
      </button>
    </div>
  );
}
