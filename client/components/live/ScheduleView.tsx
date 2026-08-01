"use client";

import { useMemo, useState } from "react";
import { Check, ListOrdered } from "lucide-react";
import { useLiveSession } from "../../context/LiveSessionContext";
import { useAuth } from "../../context/AuthContext";
import { useLiveHeats } from "../../lib/useLiveHeats";
import { RunOrderEditor } from "../schedule/RunOrderEditor";
import { disciplineOf, LEVEL_HE } from "../../lib/disciplines";
import { refName, type HeatDto, type MatchStatus } from "../../lib/types";

// §3.4 Public schedule — the run order on each pitch, live-highlighted. Lets
// spectators see who's been, who's up, and roughly when.
//
// §3.2 Managers get a "סידור ידני" mode over the same list (shared editor with
// the judge screen): moving a row reassigns the pitch's times, which is what
// both this schedule and the judge's queue read.
export default function LiveSchedulePage() {
  const { eventId, event, loading: eventLoading } = useLiveSession();
  const { isManager } = useAuth();
  const { heats, loading, refresh } = useLiveHeats(eventId);
  const [pitch, setPitch] = useState(1);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pitchCount =
    event?.activePitches ??
    heats.reduce((max, h) => Math.max(max, h.pitchNumber), 0);
  const pitches = Array.from({ length: pitchCount }, (_, i) => i + 1);

  const rows = useMemo(
    () => heats.filter((h) => h.pitchNumber === pitch),
    [heats, pitch]
  );

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
          נשארות כפי שהן — רק המתמודדים מתחלפים ביניהן, וגם השיפוט מתעדכן.
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
      {editing ? (
        <RunOrderEditor
          eventId={eventId}
          heats={rows}
          onChanged={refresh}
          onError={setError}
        />
      ) : (
        <ol className="space-y-2">
          {rows.length === 0 && (
            <li className="text-muted">אין מקצים במגרש זה.</li>
          )}
          {rows.map((heat, i) => (
            <ScheduleRow key={heat._id} heat={heat} index={i + 1} />
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

function ScheduleRow({ heat, index }: { heat: HeatDto; index: number }) {
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
  return (
    <li
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
        live ? "border-accent/40 bg-accent/5" : "border-line bg-surface"
      }`}
    >
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
      <StatusBadge status={heat.status} />
    </li>
  );
}
