"use client";

import { useMemo, useState } from "react";
import { ListOrdered, Pencil, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useLiveSession } from "../../context/LiveSessionContext";
import { useLiveHeats } from "../../lib/useLiveHeats";
import { disciplineOf, LEVEL_HE } from "../../lib/disciplines";
import { refName, type HeatDto, type MatchStatus } from "../../lib/types";
import { RunOrderQueue } from "../schedule/RunOrderQueue";

// §3.4 Public schedule — the run order on each pitch, live-highlighted. Lets
// spectators see who's been, who's up, and roughly when.
//
// For a manager this is also where the order gets *changed*: the run order is
// only settled at the tent, so the same tab flips into the editable queue
// (§3.2) instead of hiding that behind another nav item.
export default function LiveSchedulePage() {
  const { eventId, event, loading: eventLoading } = useLiveSession();
  const { heats, loading } = useLiveHeats(eventId);
  const { isManager } = useAuth();
  const [pitch, setPitch] = useState(1);
  // `null` = follow the role. A manager opening the schedule is almost always
  // here to fix the order, so they land straight in the editable queue instead
  // of first hunting for a toggle — an order you can see but not correct is the
  // one that goes stale. An explicit toggle (either way) wins from then on, and
  // resolving lazily means it still flips correctly when auth loads late.
  const [editing, setEditing] = useState<boolean | null>(null);
  const isEditing = (editing ?? isManager) && isManager;

  const pitchCount =
    event?.activePitches ??
    heats.reduce((max, h) => Math.max(max, h.pitchNumber), 0);
  const pitches = Array.from({ length: pitchCount }, (_, i) => i + 1);

  const rows = useMemo(
    () => heats.filter((h) => h.pitchNumber === pitch),
    [heats, pitch]
  );

  // The first heat that has not run yet — position 1 in the queue.
  const nextUpId = rows.find(
    (h) => !h.isFinalsPlaceholder && h.status !== "Completed"
  )?._id;

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
            onClick={() => setEditing(!isEditing)}
            className={`flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-black transition active:scale-[0.98] ${
              isEditing
                ? "border border-line bg-surface-2 text-ink"
                : "bg-lime text-lime-ink shadow-glow"
            }`}
          >
            {isEditing ? (
              <>
                <X className="h-4 w-4" />
                לוח מלא
              </>
            ) : (
              <>
                <Pencil className="h-4 w-4" />
                ערוך סדר עלייה
              </>
            )}
          </button>
        )}
      </div>

      {/* Pitch tabs */}
      {pitches.length > 1 && (
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
      )}

      {isEditing ? (
        <>
          <p className="flex items-start gap-2 rounded-xl border border-line bg-surface-2 p-3 text-sm text-muted">
            <ListOrdered className="mt-0.5 h-4 w-4 shrink-0" />
            הקש על מספר המקום והקלד לאן להעביר, או גרור את הידית. השינוי נשמר מיד
            ומתעדכן אצל כל השופטים והצופים.
          </p>
          <RunOrderQueue eventId={eventId} pitch={pitch} />
        </>
      ) : (
        <ol className="space-y-2">
          {rows.length === 0 && (
            <li className="text-muted">אין מקצים במגרש זה.</li>
          )}
          {rows.map((heat, i) => (
            <ScheduleRow
              key={heat._id}
              heat={heat}
              index={i + 1}
              nextUp={heat._id === nextUpId}
            />
          ))}
        </ol>
      )}
    </div>
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

function ScheduleRow({
  heat,
  index,
  nextUp,
}: {
  heat: HeatDto;
  index: number;
  nextUp: boolean;
}) {
  const discipline = disciplineOf(heat.categoryId);
  const time = new Date(heat.scheduledTime).toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (heat.isFinalsPlaceholder) {
    return (
      <li className="flex items-center gap-3 rounded-xl border border-dashed border-line px-4 py-3 text-sm text-muted">
        <span className="font-score">{time}</span>
        <span>גמר {discipline?.nameHe ?? heat.categoryId} — ממתין למעפילים</span>
      </li>
    );
  }

  const live = heat.status === "Live";
  const done = heat.status === "Completed";
  return (
    <li
      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
        live
          ? "border-accent/40 bg-accent/5"
          : nextUp
            ? "border-lime/40 bg-surface"
            : "border-line bg-surface"
      }`}
    >
      {/* Position in the run order — the number a team is told over the mic, so
          it stays legible from arm's length and renumbers on every reorder. */}
      <span
        className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl font-score text-lg font-black ${
          nextUp
            ? "bg-lime text-lime-ink shadow-glow"
            : done
              ? "bg-surface-2 text-muted"
              : "bg-surface-2 text-ink"
        }`}
      >
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
      <StatusBadge status={heat.status} />
    </li>
  );
}
