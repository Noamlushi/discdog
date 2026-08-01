"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Check, GripVertical, ListOrdered } from "lucide-react";
import { useLiveSession } from "../../context/LiveSessionContext";
import { useAuth } from "../../context/AuthContext";
import { useLiveHeats } from "../../lib/useLiveHeats";
import { reorderHeats } from "../../lib/api";
import { disciplineOf, LEVEL_HE } from "../../lib/disciplines";
import { refName, type HeatDto, type MatchStatus } from "../../lib/types";

// §3.4 Public schedule — the run order on each pitch, live-highlighted. Lets
// spectators see who's been, who's up, and roughly when.
//
// §3.2 Managers (Admin / assigned Organizer) get a "סידור ידני" mode on top of
// the same list: drag a row or use the arrows to move a competitor, and the
// pitch's existing times are reassigned in the new order. Used mainly to fix a
// league round's run order on the spot (someone late, dogs swapped), which is
// why it lives in the shared view rather than the admin screen.
export default function LiveSchedulePage() {
  const { eventId, event, loading: eventLoading } = useLiveSession();
  const { isManager } = useAuth();
  const { heats, loading, refresh } = useLiveHeats(eventId);
  const [pitch, setPitch] = useState(1);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Optimistic run order while a reorder is in flight; cleared as soon as the
  // server's heat list comes back (our own `schedule_updated` triggers it).
  const [pending, setPending] = useState<HeatDto[] | null>(null);

  const pitchCount =
    event?.activePitches ??
    heats.reduce((max, h) => Math.max(max, h.pitchNumber), 0);
  const pitches = Array.from({ length: pitchCount }, (_, i) => i + 1);

  const serverRows = useMemo(
    () => heats.filter((h) => h.pitchNumber === pitch),
    [heats, pitch]
  );
  useEffect(() => setPending(null), [heats, pitch]);
  const rows = pending ?? serverRows;

  async function move(from: number, to: number) {
    if (to < 0 || to >= rows.length || from === to || !eventId) return;
    const next = [...rows];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setPending(next);
    setError(null);
    try {
      await reorderHeats(
        eventId,
        next.map((h) => h._id)
      );
    } catch (e) {
      setError((e as Error).message);
      setPending(null);
    } finally {
      refresh();
    }
  }

  if (eventLoading || (loading && heats.length === 0)) {
    return <p className="py-16 text-center text-muted">טוען…</p>;
  }
  if (!eventId) {
    return (
      <p className="py-16 text-center text-muted">
        בחר תחרות כדי לראות את לוח הזמנים.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black tracking-tight">לוח זמנים</h1>
        {isManager && (
          <button
            type="button"
            onClick={() => {
              setEditing((v) => !v);
              setError(null);
            }}
            className={`ds-btn px-4 py-2 text-sm ${
              editing ? "ds-btn-primary" : "ds-btn-ghost"
            }`}
          >
            {editing ? (
              <>
                <Check className="h-4 w-4" />
                סיום סידור
              </>
            ) : (
              <>
                <ListOrdered className="h-4 w-4" />
                סידור ידני
              </>
            )}
          </button>
        )}
      </div>

      {editing && (
        <p className="rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm text-muted">
          גרור שורה או השתמש בחיצים כדי לשנות את סדר העלייה. השעות של המגרש
          נשארות כפי שהן — רק המתמודדים מתחלפים ביניהן.
        </p>
      )}

      {error && (
        <p className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
          {error}
        </p>
      )}

      {/* Pitch tabs */}
      <div className="flex flex-wrap gap-2">
        {pitches.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setPitch(n)}
            className={`h-11 min-w-11 rounded-xl px-4 text-sm font-extrabold transition ${
              pitch === n
                ? "bg-lime text-lime-ink shadow-glow"
                : "border border-line bg-surface-2 text-ink hover:bg-elevated"
            }`}
          >
            מגרש {n}
          </button>
        ))}
      </div>

      {/* Run order */}
      <RunOrder rows={rows} editing={editing} onMove={move} />
    </div>
  );
}

function RunOrder({
  rows,
  editing,
  onMove,
}: {
  rows: HeatDto[];
  editing: boolean;
  onMove: (from: number, to: number) => void;
}) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  return (
    <ol className="space-y-2">
      {rows.length === 0 && <li className="text-muted">אין מקצים במגרש זה.</li>}
      {rows.map((heat, i) => (
        <li
          key={heat._id}
          draggable={editing}
          onDragStart={() => setDragIdx(i)}
          onDragOver={(e) => {
            if (!editing) return;
            e.preventDefault();
            if (overIdx !== i) setOverIdx(i);
          }}
          onDrop={() => {
            if (dragIdx !== null) onMove(dragIdx, i);
            setDragIdx(null);
            setOverIdx(null);
          }}
          onDragEnd={() => {
            setDragIdx(null);
            setOverIdx(null);
          }}
          className={[
            editing ? "cursor-grab active:cursor-grabbing" : "",
            dragIdx === i ? "opacity-40" : "",
            overIdx === i && dragIdx !== i && dragIdx !== null
              ? "rounded-xl ring-2 ring-accent"
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <ScheduleRow
            heat={heat}
            index={i + 1}
            editing={editing}
            isFirst={i === 0}
            isLast={i === rows.length - 1}
            onUp={() => onMove(i, i - 1)}
            onDown={() => onMove(i, i + 1)}
          />
        </li>
      ))}
    </ol>
  );
}

const STATUS_HE: Record<MatchStatus, string> = {
  Pending: "ממתין",
  "On-Deck": "הבא בתור",
  Live: "משחק עכשיו",
  Completed: "הסתיים",
};

function StatusBadge({ status }: { status: MatchStatus }) {
  const tone: Record<MatchStatus, string> = {
    Pending: "ds-pill-done",
    "On-Deck": "ds-pill-ondeck",
    Live: "ds-pill-live",
    Completed: "ds-pill-ondeck",
  };
  return (
    <span className={`ds-pill shrink-0 text-xs ${tone[status]}`}>
      {status === "Live" && <span className="ds-dot animate-live-pulse" />}
      {STATUS_HE[status]}
    </span>
  );
}

// Up/down buttons — the touch-friendly half of reordering (HTML5 drag doesn't
// fire on phones/tablets, which is where organizers actually run a round).
function MoveButtons({
  isFirst,
  isLast,
  onUp,
  onDown,
}: {
  isFirst: boolean;
  isLast: boolean;
  onUp: () => void;
  onDown: () => void;
}) {
  return (
    <span className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        onClick={onUp}
        disabled={isFirst}
        aria-label="הזז למעלה"
        className="grid h-9 w-9 place-items-center rounded-lg border border-line text-muted transition active:scale-95 disabled:opacity-30"
      >
        <ArrowUp className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onDown}
        disabled={isLast}
        aria-label="הזז למטה"
        className="grid h-9 w-9 place-items-center rounded-lg border border-line text-muted transition active:scale-95 disabled:opacity-30"
      >
        <ArrowDown className="h-4 w-4" />
      </button>
    </span>
  );
}

function ScheduleRow({
  heat,
  index,
  editing = false,
  isFirst = false,
  isLast = false,
  onUp,
  onDown,
}: {
  heat: HeatDto;
  index: number;
  editing?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  onUp?: () => void;
  onDown?: () => void;
}) {
  const discipline = disciplineOf(heat.categoryId);
  const time = new Date(heat.scheduledTime).toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (heat.isFinalsPlaceholder) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-line px-4 py-3 text-sm text-muted">
        {editing && <GripVertical className="h-4 w-4 shrink-0" />}
        <span className="font-score">{time}</span>
        <span className="min-w-0 flex-1 truncate">
          גמר {discipline?.nameHe ?? heat.categoryId} — ממתין למעפילים
        </span>
        {editing && onUp && onDown && (
          <MoveButtons
            isFirst={isFirst}
            isLast={isLast}
            onUp={onUp}
            onDown={onDown}
          />
        )}
      </div>
    );
  }

  const live = heat.status === "Live";
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
        live ? "border-accent/40 bg-accent/5" : "border-line bg-surface"
      }`}
    >
      {editing && <GripVertical className="h-4 w-4 shrink-0 text-muted" />}
      <span className="w-6 shrink-0 text-center font-score text-sm text-muted">
        {index}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">
          {refName(heat.team?.playerId) ?? "—"}
          <span className="font-normal text-muted">
            {" · "}
            {refName(heat.team?.dogId) ?? "—"}
          </span>
        </p>
        <p className="truncate text-xs text-muted">
          {discipline?.nameHe ?? heat.categoryId} · {LEVEL_HE[heat.experienceLevel]}{" "}
          · {time}
        </p>
      </div>
      {editing && onUp && onDown ? (
        <MoveButtons
          isFirst={isFirst}
          isLast={isLast}
          onUp={onUp}
          onDown={onDown}
        />
      ) : (
        <StatusBadge status={heat.status} />
      )}
    </div>
  );
}
