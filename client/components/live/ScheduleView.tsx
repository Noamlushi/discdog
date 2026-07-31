"use client";

import { useMemo, useState } from "react";
import { useLiveSession } from "../../context/LiveSessionContext";
import { useLiveHeats } from "../../lib/useLiveHeats";
import { disciplineOf, LEVEL_HE } from "../../lib/disciplines";
import { refName, type HeatDto, type MatchStatus } from "../../lib/types";

// §3.4 Public schedule — the run order on each pitch, live-highlighted. Lets
// spectators see who's been, who's up, and roughly when.
export default function LiveSchedulePage() {
  const { eventId, event, loading: eventLoading } = useLiveSession();
  const { heats, loading } = useLiveHeats(eventId);
  const [pitch, setPitch] = useState(1);

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
      <h1 className="text-2xl font-black tracking-tight">לוח זמנים</h1>

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
      <ol className="space-y-2">
        {rows.length === 0 && (
          <li className="text-muted">אין מקצים במגרש זה.</li>
        )}
        {rows.map((heat, i) => (
          <ScheduleRow key={heat._id} heat={heat} index={i + 1} />
        ))}
      </ol>
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
        live
          ? "border-accent/40 bg-accent/5"
          : "border-line bg-surface"
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
