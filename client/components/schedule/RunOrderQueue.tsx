"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronsUp,
  GripVertical,
  Hash,
  MoveDown,
  MoveUp,
  SkipForward,
} from "lucide-react";
import { useSocket } from "../../context/SocketContext";
import { getHeats, reorderHeats } from "../../lib/api";
import { CLIENT_EVENTS, SERVER_EVENTS } from "../../lib/socketEvents";
import { disciplineOf, LEVEL_HE } from "../../lib/disciplines";
import { refName, type HeatDto } from "../../lib/types";

// §3.2 Run order, editable mid-competition. Between league dates the order is
// only settled at the tent — a team is late, a dog is not ready — so the queue
// has to be reorderable from the phone that is already in the judge's hand,
// not only from the desktop admin schedule.
//
// Three ways to move a row, on purpose. Typing the target number is the primary
// one — at the tent the order is discussed out loud in numbers ("תעלה אותה
// לשנייה"), so typing 2 is the shortest path from what was said to what the
// screen shows. Drag the grip is the fast gesture; the arrow / "לראש" / "דלג"
// buttons stay because they are the ones that work with gloves, in the sun,
// one-handed. Every change goes through PATCH /schedule/reorder, which permutes
// the pitch's existing time slots and broadcasts `schedule_reordered`, so the
// other judges' and the spectators' screens follow within the same second.
//
// Numbers are positions among the heats that have *not run yet*: 1 is whoever
// goes on next, and they renumber after every completed run. That is the number
// a team is actually told at the tent, so it is the number they can be moved by.

/** Position numbers are the live position in the queue, so they renumber on every move. */
function arrayMove<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function RunOrderQueue({
  eventId,
  pitch,
  className = "",
}: {
  eventId: string | null;
  pitch: number | null;
  className?: string;
}) {
  const { socket } = useSocket();

  const [queue, setQueue] = useState<HeatDto[]>([]);
  const [live, setLive] = useState<HeatDto[]>([]);
  const [doneCount, setDoneCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // While our own reorder is in flight the server echo would fight the
  // optimistic list, so socket refreshes are held until it settles.
  const inFlight = useRef(0);

  const load = useCallback(() => {
    if (!eventId || pitch == null) {
      setQueue([]);
      setLive([]);
      setDoneCount(0);
      return;
    }
    setLoading(true);
    getHeats({ eventId, pitch })
      .then((heats) => {
        const real = heats.filter((h) => !h.isFinalsPlaceholder);
        setLive(real.filter((h) => h.status === "Live"));
        setQueue(
          real.filter((h) => h.status === "Pending" || h.status === "On-Deck")
        );
        setDoneCount(real.filter((h) => h.status === "Completed").length);
        setError(null);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [eventId, pitch]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!socket || !eventId) return;
    socket.emit(CLIENT_EVENTS.JOIN_EVENT_ROOM, eventId);
    const onChange = () => {
      if (inFlight.current === 0) load();
    };
    socket.on(SERVER_EVENTS.SCHEDULE_REORDERED, onChange);
    socket.on(SERVER_EVENTS.MATCH_STATUS_CHANGED, onChange);
    return () => {
      socket.off(SERVER_EVENTS.SCHEDULE_REORDERED, onChange);
      socket.off(SERVER_EVENTS.MATCH_STATUS_CHANGED, onChange);
    };
  }, [socket, eventId, load]);

  // Optimistic: the new order paints immediately, and only rolls back if the
  // server rejects it — a judge should never wait on the network mid-run.
  const commit = useCallback(
    async (next: HeatDto[]) => {
      const prev = queue;
      setQueue(next);
      setSaving(true);
      inFlight.current += 1;
      try {
        await reorderHeats(next.map((h) => h._id));
        setError(null);
      } catch (e) {
        setQueue(prev);
        setError((e as Error).message);
      } finally {
        inFlight.current -= 1;
        setSaving(false);
        if (inFlight.current === 0) load();
      }
    },
    [queue, load]
  );

  const move = (from: number, to: number) => {
    if (to < 0 || to >= queue.length || to === from) return;
    void commit(arrayMove(queue, from, to));
  };

  // ---- guarding position 1 -------------------------------------------------
  // Whoever is at 1 is the team standing at the line waiting to be called, so
  // moving them is the one reorder that disrupts something already in motion —
  // and it is a single mistap away from the buttons that are always open on
  // row 0. Every path that moves row 0 (typed number, drag, buttons) goes
  // through here and asks first; everything below row 0 stays instant.
  //
  // The pending move is held by heat *id*, not index: a socket refresh can
  // renumber the queue while the dialog is open, and re-resolving on confirm
  // means we always move the team the judge actually looked at.
  const [pendingMove, setPendingMove] = useState<{
    id: string;
    to: number;
    name: string;
  } | null>(null);

  const requestMove = (from: number, to: number) => {
    if (to < 0 || to >= queue.length || to === from) return;
    if (from === 0) {
      setPendingMove({
        id: queue[0]._id,
        to,
        name: refName(queue[0].team?.playerId) ?? "—",
      });
      return;
    }
    move(from, to);
  };

  const confirmPendingMove = () => {
    if (!pendingMove) return;
    const from = queue.findIndex((h) => h._id === pendingMove.id);
    setPendingMove(null);
    // Gone from the queue (started running, or another screen moved it) — the
    // question the judge answered no longer applies, so drop it rather than
    // guess at a replacement.
    if (from < 0) return;
    move(from, pendingMove.to);
  };

  useEffect(() => {
    if (!pendingMove) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPendingMove(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pendingMove]);

  // ---- position entry ------------------------------------------------------
  // Tap the position badge, type the place you want the team to run in. The move
  // *pushes* — everyone from that position down shifts one place back and keeps
  // their relative order — because "תעלה אותה לשנייה" never means "and send
  // whoever was second to the back".
  const [editingPos, setEditingPos] = useState<{
    id: string;
    value: string;
  } | null>(null);
  // Escape has to cancel without the blur that follows it committing anyway.
  const cancelPos = useRef(false);

  const commitPos = (from: number, raw: string) => {
    setEditingPos(null);
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n)) return;
    // Out-of-range numbers clamp instead of erroring — "12" on a 6-long queue
    // plainly means "put them last", and an error toast helps nobody at a tent.
    const to = Math.max(0, Math.min(queue.length - 1, n - 1));
    requestMove(from, to);
  };

  // ---- drag ----------------------------------------------------------------
  const listRef = useRef<HTMLOListElement>(null);
  const [drag, setDrag] = useState<{
    id: string;
    from: number;
    to: number;
    dy: number;
  } | null>(null);
  // Row heights are not uniform — row 0 is always expanded, and long names wrap —
  // so a single stride guessed from the first two rows drifts further off with
  // every row you drag past. Measure every row's centre once at drag start and
  // pick the target by proximity instead; the mapping then stays honest whatever
  // the rows look like.
  const dragMeta = useRef<{ startY: number; centers: number[] } | null>(null);

  const startDrag = (e: React.PointerEvent, index: number, id: string) => {
    const rows = listRef.current?.children;
    if (!rows || rows.length < 1) return;
    const centers = Array.from(rows, (row) => {
      const r = (row as HTMLElement).getBoundingClientRect();
      return r.top + r.height / 2;
    });
    dragMeta.current = { startY: e.clientY, centers };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setExpandedId(null);
    setEditingPos(null);
    setDrag({ id, from: index, to: index, dy: 0 });
  };

  const onDragMove = (e: React.PointerEvent) => {
    if (!drag || !dragMeta.current) return;
    const { startY, centers } = dragMeta.current;
    const dy = e.clientY - startY;
    const held = centers[drag.from] + dy;
    let to = drag.to;
    let best = Infinity;
    for (let i = 0; i < centers.length; i += 1) {
      const d = Math.abs(centers[i] - held);
      if (d < best) {
        best = d;
        to = i;
      }
    }
    if (dy !== drag.dy || to !== drag.to) setDrag({ ...drag, dy, to });
  };

  const endDrag = () => {
    if (!drag) return;
    const { from, to } = drag;
    setDrag(null);
    dragMeta.current = null;
    if (from !== to) requestMove(from, to);
  };

  // During a drag the list is rendered already reordered, so the position
  // numbers are truthful the whole way down; only the dragged row keeps a
  // free-floating offset under the finger.
  const shown = drag ? arrayMove(queue, drag.from, drag.to) : queue;
  const centers = dragMeta.current?.centers;
  const dragOffset =
    drag && centers ? drag.dy - (centers[drag.to] - centers[drag.from]) : 0;

  if (!eventId || pitch == null) return null;

  return (
    <section dir="rtl" className={`space-y-3 ${className}`}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-black tracking-tight">סדר עלייה</h2>
        <span className="text-xs font-semibold text-muted">
          {saving
            ? "שומר…"
            : `${queue.length} ממתינים · ${doneCount} הסתיימו`}
        </span>
      </div>

      {error && (
        <p className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm font-semibold text-danger">
          {error}
        </p>
      )}

      {queue.length > 1 && (
        <p className="flex items-start gap-2 text-xs text-muted">
          <Hash className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          הקש על המספר והקלד את המקום שאליו להעביר — השאר נדחפים אחורה בסדר שלהם.
        </p>
      )}

      {/* The heat being judged right now is not part of the queue — it can't be
          reordered out from under the judge. */}
      {live.map((h) => (
        <div
          key={h._id}
          className="flex items-center gap-3 rounded-2xl border border-accent/40 bg-accent/5 px-3 py-3"
        >
          <span className="ds-pill ds-pill-live shrink-0 text-xs">
            <span className="ds-dot animate-live-pulse" />
            רץ עכשיו
          </span>
          <HeatLine heat={h} />
        </div>
      ))}

      {loading && queue.length === 0 ? (
        <p className="py-6 text-center text-muted">טוען…</p>
      ) : queue.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line py-6 text-center text-muted">
          אין מקצים ממתינים במגרש {pitch}.
        </p>
      ) : (
        <ol ref={listRef} className="space-y-2">
          {shown.map((heat, i) => {
            const dragging = drag?.id === heat._id;
            const expanded = expandedId === heat._id || i === 0;
            return (
              <li
                key={heat._id}
                style={
                  dragging
                    ? {
                        transform: `translateY(${dragOffset}px)`,
                        touchAction: "none",
                      }
                    : undefined
                }
                className={`rounded-2xl border bg-surface transition-colors ${
                  dragging
                    ? "relative z-10 border-lime shadow-glow"
                    : i === 0
                      ? "border-lime/40"
                      : "border-line"
                }`}
              >
                <div className="flex items-center gap-2 p-2">
                  {/* Drag grip — pointer events so it works with a finger. */}
                  <button
                    type="button"
                    aria-label="גרור לשינוי מיקום"
                    onPointerDown={(e) => startDrag(e, i, heat._id)}
                    onPointerMove={onDragMove}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    className="flex h-14 w-9 shrink-0 cursor-grab touch-none items-center justify-center rounded-xl text-muted active:cursor-grabbing active:bg-elevated"
                  >
                    <GripVertical className="h-6 w-6" />
                  </button>

                  {/* Live position in the queue — the number the team is told,
                      and the control that moves them. Tap it, type a place. */}
                  {editingPos?.id === heat._id ? (
                    <input
                      autoFocus
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      aria-label={`מיקום בתור, כרגע ${i + 1}`}
                      value={editingPos.value}
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) =>
                        setEditingPos({
                          id: heat._id,
                          value: e.target.value.replace(/\D/g, "").slice(0, 2),
                        })
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                        if (e.key === "Escape") {
                          cancelPos.current = true;
                          e.currentTarget.blur();
                        }
                      }}
                      onBlur={(e) => {
                        if (cancelPos.current) {
                          cancelPos.current = false;
                          setEditingPos(null);
                          return;
                        }
                        commitPos(i, e.target.value);
                      }}
                      className="h-14 w-14 shrink-0 rounded-xl border-2 border-lime bg-surface-2 text-center font-score text-2xl font-black text-ink outline-none"
                    />
                  ) : (
                    <button
                      type="button"
                      aria-label={`מיקום ${i + 1} — הקש כדי להעביר למקום אחר`}
                      disabled={saving}
                      onClick={() =>
                        setEditingPos({ id: heat._id, value: String(i + 1) })
                      }
                      className={`grid h-14 w-14 shrink-0 place-items-center rounded-xl font-score text-2xl font-black transition active:scale-95 disabled:opacity-40 ${
                        i === 0
                          ? "bg-lime text-lime-ink shadow-glow"
                          : "bg-surface-2 text-ink hover:bg-elevated"
                      }`}
                    >
                      {i + 1}
                    </button>
                  )}

                  <HeatLine heat={heat} />

                  <button
                    type="button"
                    aria-label="פעולות"
                    aria-expanded={expanded}
                    onClick={() =>
                      setExpandedId(expandedId === heat._id ? null : heat._id)
                    }
                    className={`grid h-14 w-10 shrink-0 place-items-center rounded-xl text-muted transition ${
                      i === 0 ? "invisible" : "hover:bg-elevated"
                    }`}
                  >
                    <ChevronDown
                      className={`h-5 w-5 transition-transform ${
                        expanded ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                </div>

                {expanded && !drag && (
                  <div className="grid grid-cols-4 gap-1.5 border-t border-line p-2">
                    <QueueAction
                      label="לראש"
                      icon={ChevronsUp}
                      disabled={i === 0 || saving}
                      onClick={() => requestMove(i, 0)}
                    />
                    <QueueAction
                      label="למעלה"
                      icon={MoveUp}
                      disabled={i === 0 || saving}
                      onClick={() => requestMove(i, i - 1)}
                    />
                    <QueueAction
                      label="למטה"
                      icon={MoveDown}
                      disabled={i === queue.length - 1 || saving}
                      onClick={() => requestMove(i, i + 1)}
                    />
                    {/* "Not here" — the common case; pushes to the end of the
                        queue instead of stalling everyone behind them. */}
                    <QueueAction
                      label="דלג"
                      icon={SkipForward}
                      tone="warn"
                      disabled={i === queue.length - 1 || saving}
                      onClick={() => requestMove(i, queue.length - 1)}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {/* Confirm before the team at the line gets moved. Cancel is focused and
          sits on the side the thumb reaches first, so the reflex answer to a
          dialog nobody meant to open is the harmless one. */}
      {pendingMove && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="move-first-title"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
          onClick={() => setPendingMove(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm space-y-4 rounded-2xl border border-line bg-surface p-4 shadow-soft"
          >
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-danger/10 text-danger">
                <AlertTriangle className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <h3 id="move-first-title" className="text-lg font-black leading-tight">
                  להזיז את מי שעולה עכשיו?
                </h3>
                <p className="mt-1 text-sm text-muted">
                  <span className="font-bold text-ink">{pendingMove.name}</span>{" "}
                  נמצא במקום 1 ועומד לעלות. להעביר למקום{" "}
                  <span className="font-bold text-ink">{pendingMove.to + 1}</span>?
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                autoFocus
                onClick={() => setPendingMove(null)}
                className="h-12 rounded-xl border border-line bg-surface-2 text-sm font-black text-ink transition active:scale-[0.98]"
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={confirmPendingMove}
                className="h-12 rounded-xl bg-lime text-sm font-black text-lime-ink shadow-glow transition active:scale-[0.98]"
              >
                כן, הזז
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function HeatLine({ heat }: { heat: HeatDto }) {
  const discipline = disciplineOf(heat.categoryId);
  return (
    <div className="min-w-0 flex-1">
      <p className="truncate font-bold leading-tight">
        {refName(heat.team?.playerId) ?? "—"}
      </p>
      <p className="truncate text-xs text-muted">
        {refName(heat.team?.dogId) ?? "—"} · {discipline?.nameHe ?? heat.categoryId}{" "}
        · {LEVEL_HE[heat.experienceLevel]}
      </p>
    </div>
  );
}

function QueueAction({
  label,
  icon: Icon,
  onClick,
  disabled,
  tone = "default",
}: {
  label: string;
  icon: typeof ChevronsUp;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "warn";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex h-14 flex-col items-center justify-center gap-0.5 rounded-xl border text-xs font-black transition active:scale-[0.98] disabled:opacity-30 ${
        tone === "warn"
          ? "border-danger/30 bg-danger/10 text-danger"
          : "border-line bg-surface-2 text-ink"
      }`}
    >
      <Icon className="h-5 w-5" />
      {label}
    </button>
  );
}
