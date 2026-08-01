"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { reorderHeats } from "../../lib/api";
import { refName, type HeatDto } from "../../lib/types";

// §3.2 Manual run order — the one editor used by both the schedule dashboard
// and the judge's On-Deck screen, so "who runs next" means the same thing on
// every screen. Moving a row reassigns the pitch's existing times in the new
// order (server side), which is what the judge queue and the public schedule
// both read.
//
// Drag works on desktop; the up/down buttons are what actually get used, since
// a round is run from a phone or tablet where HTML5 drag never fires.
export function RunOrderEditor({
  eventId,
  heats,
  onChanged,
  onError,
}: {
  eventId: string;
  /** One pitch's heats, in run order. */
  heats: HeatDto[];
  /** Called after the server accepted (or rejected) a move, to re-pull. */
  onChanged?: () => void;
  onError?: (message: string | null) => void;
}) {
  // Optimistic order while the request is in flight; dropped as soon as the
  // parent hands us a fresh list.
  const [pending, setPending] = useState<HeatDto[] | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  useEffect(() => setPending(null), [heats]);
  const rows = pending ?? heats;

  async function move(from: number, to: number) {
    if (to < 0 || to >= rows.length || from === to) return;
    const next = [...rows];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setPending(next);
    onError?.(null);
    try {
      await reorderHeats(
        eventId,
        next.map((h) => h._id)
      );
    } catch (e) {
      onError?.((e as Error).message);
      setPending(null);
    } finally {
      onChanged?.();
    }
  }

  if (rows.length === 0) {
    return <p className="text-sm text-muted">אין מקצים במגרש זה.</p>;
  }

  return (
    <ol className="space-y-2">
      {rows.map((heat, i) => {
        const time = new Date(heat.scheduledTime).toLocaleTimeString("he-IL", {
          hour: "2-digit",
          minute: "2-digit",
        });
        const done = heat.status === "Completed";
        return (
          <li
            key={heat._id}
            draggable
            onDragStart={() => setDragIdx(i)}
            onDragOver={(e) => {
              e.preventDefault();
              if (overIdx !== i) setOverIdx(i);
            }}
            onDrop={() => {
              if (dragIdx !== null) move(dragIdx, i);
              setDragIdx(null);
              setOverIdx(null);
            }}
            onDragEnd={() => {
              setDragIdx(null);
              setOverIdx(null);
            }}
            className={[
              "flex cursor-grab items-center gap-3 rounded-xl border px-3 py-2.5 active:cursor-grabbing",
              heat.status === "Live"
                ? "border-accent/40 bg-accent/5"
                : "border-line bg-surface",
              done ? "opacity-50" : "",
              dragIdx === i ? "opacity-40" : "",
              overIdx === i && dragIdx !== null && dragIdx !== i
                ? "ring-2 ring-accent"
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <GripVertical className="h-4 w-4 shrink-0 text-muted" />
            <span className="w-5 shrink-0 text-center font-score text-sm text-muted">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">
                {refName(heat.team?.playerId) ??
                  (heat.isFinalsPlaceholder ? "— גמר —" : "—")}
                <span className="font-normal text-muted">
                  {" · "}
                  {refName(heat.team?.dogId) ?? "—"}
                </span>
              </p>
              <p className="truncate font-score text-xs text-muted">
                {time}
                {done ? " · הסתיים" : heat.status === "Live" ? " · רץ עכשיו" : ""}
              </p>
            </div>
            <span className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => move(i, i - 1)}
                disabled={i === 0}
                aria-label="הזז למעלה"
                className="grid h-9 w-9 place-items-center rounded-lg border border-line text-muted transition active:scale-95 disabled:opacity-30"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => move(i, i + 1)}
                disabled={i === rows.length - 1}
                aria-label="הזז למטה"
                className="grid h-9 w-9 place-items-center rounded-lg border border-line text-muted transition active:scale-95 disabled:opacity-30"
              >
                <ArrowDown className="h-4 w-4" />
              </button>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
