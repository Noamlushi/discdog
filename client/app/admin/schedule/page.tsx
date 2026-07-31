"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  CalendarRange,
  CheckCircle2,
  ChevronRight,
  Download,
  GripVertical,
  RefreshCw,
  X,
} from "lucide-react";

import { getToken } from "../../../lib/api";

// §3.2 Schedule page — generate + drag-and-drop manual edit + player validation panel.

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// Auth header for the management write/export endpoints (§9.3).
function authJson(): Record<string, string> {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// Export is a management action → fetch as a blob with the bearer token and
// trigger a download (a plain <a href> can't carry the Authorization header).
async function downloadExport(eventId: string): Promise<void> {
  const token = getToken();
  const res = await fetch(`${API}/api/schedule/export?eventId=${eventId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) return;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `schedule_${eventId}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface EventSummary {
  _id: string;
  name: string;
  estimatedStartTime: string;
  minRestTimeMinutes: number;
}

interface Heat {
  _id: string;
  categoryId: string;
  experienceLevel: string;
  pitchNumber: number;
  scheduledTime: string;
  isFinalsPlaceholder: boolean;
  status: string;
  team?: {
    playerId?: { _id: string; name: string } | null;
    dogId?: { _id: string; name: string } | null;
  };
}

interface ScheduleReport {
  heatsCreated: number;
  placeholdersCreated: number;
  makespanMinutes: number;
  windowMinutes: number;
  utilisationPct: number;
  fitsWindow: boolean;
  warnings: string[];
}

// ── Discipline / level / status display names ─────────────────────────────────

const DISCIPLINE_HE: Record<string, string> = {
  Distance: "דיסטנס",
  IceDrop: "Ice Drop",
  MultipleChallenge: "מולטיפול צ׳אלנג׳",
  Agility: "פריזג׳יליטי",
  WheelOfFortune: "גלגל המזל",
  JTrail: "J׳Trail",
  Shuffle: "שאפל ב-30",
  CrissCross: "קריס קרוס",
  TimeTrail: "Time Trail",
  Freestyle: "פריסטייל",
};

const LEVEL_HE: Record<string, string> = {
  Beginner: "מתחילים",
  Advanced: "מתקדמים",
};

const STATUS_COLOR: Record<string, string> = {
  Pending: "ds-pill-done",
  "On-Deck": "ds-pill-ondeck",
  Live: "ds-pill-live",
  Completed: "ds-pill-done",
};

const STATUS_HE: Record<string, string> = {
  Pending: "ממתין",
  "On-Deck": "On Deck",
  Live: "פעיל",
  Completed: "הסתיים",
};

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Conflict detection ────────────────────────────────────────────────────────

// Minutes a handler needs between runs with DIFFERENT dogs — mirrors the
// scheduler's PLAYER_SWITCH_REST_MINUTES (owner decision 2026-06-29). The same
// dog is still governed by the full minRestMinutes via the dog check below.
const PLAYER_SWITCH_REST_MINUTES = 10;

// Returns set of heat._id values that violate a rest window: the same dog within
// minRestMinutes, or the same player within the (shorter) dog-swap window.
function computeConflicts(heats: Heat[], minRestMinutes: number): Set<string> {
  if (minRestMinutes <= 0) return new Set();
  const conflicts = new Set<string>();

  const checkGroup = (group: Heat[], windowMs: number) => {
    const sorted = [...group].sort(
      (a, b) =>
        new Date(a.scheduledTime).getTime() -
        new Date(b.scheduledTime).getTime()
    );
    for (let i = 0; i < sorted.length - 1; i++) {
      const gap =
        new Date(sorted[i + 1].scheduledTime).getTime() -
        new Date(sorted[i].scheduledTime).getTime();
      if (gap < windowMs) {
        conflicts.add(sorted[i]._id);
        conflicts.add(sorted[i + 1]._id);
      }
    }
  };

  const byPlayer = new Map<string, Heat[]>();
  const byDog = new Map<string, Heat[]>();
  for (const h of heats) {
    const pid = h.team?.playerId?._id;
    const did = h.team?.dogId?._id;
    if (pid) {
      if (!byPlayer.has(pid)) byPlayer.set(pid, []);
      byPlayer.get(pid)!.push(h);
    }
    if (did) {
      if (!byDog.has(did)) byDog.set(did, []);
      byDog.get(did)!.push(h);
    }
  }

  const playerWindowMs = Math.min(PLAYER_SWITCH_REST_MINUTES, minRestMinutes) * 60000;
  const dogWindowMs = minRestMinutes * 60000;
  for (const g of byPlayer.values()) checkGroup(g, playerWindowMs);
  for (const g of byDog.values()) checkGroup(g, dogWindowMs);
  return conflicts;
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SchedulePage() {
  return (
    <Suspense>
      <ScheduleContent />
    </Suspense>
  );
}

function ScheduleContent() {
  const params = useSearchParams();
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [eventId, setEventId] = useState(params.get("eventId") ?? "");
  const [heats, setHeats] = useState<Heat[]>([]);
  const [report, setReport] = useState<ScheduleReport | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(1);
  const [selectedPlayer, setSelectedPlayer] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const selectedEvent = events.find((e) => e._id === eventId);
  const minRestMinutes = selectedEvent?.minRestTimeMinutes ?? 0;

  const conflicts = useMemo(
    () => computeConflicts(heats, minRestMinutes),
    [heats, minRestMinutes]
  );

  useEffect(() => {
    fetch(`${API}/api/events`)
      .then((r) => r.json())
      .then(setEvents)
      .catch(console.error);
  }, []);

  const loadHeats = useCallback(async (eid: string) => {
    if (!eid) return;
    const r = await fetch(`${API}/api/heats?eventId=${eid}`);
    if (r.ok) setHeats(await r.json());
  }, []);

  useEffect(() => {
    if (eventId) loadHeats(eventId);
  }, [eventId, loadHeats]);

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const r = await fetch(`${API}/api/schedule/generate`, {
        method: "POST",
        headers: authJson(),
        body: JSON.stringify({ eventId }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? `שגיאת שרת ${r.status}`);
      setReport(body as ScheduleReport);
      await loadHeats(eventId);
      setActiveTab(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה לא ידועה");
    } finally {
      setGenerating(false);
    }
  }

  // Called by PitchTable after a drag-and-drop reorder.
  async function reorder(newOrder: Heat[]) {
    const pitchNum = newOrder[0]?.pitchNumber;
    // Optimistic update
    setHeats((prev) => [
      ...prev.filter((h) => h.pitchNumber !== pitchNum),
      ...newOrder,
    ]);
    try {
      const r = await fetch(`${API}/api/schedule/reorder`, {
        method: "PATCH",
        headers: authJson(),
        body: JSON.stringify({ heatIds: newOrder.map((h) => h._id) }),
      });
      if (!r.ok) throw new Error();
      await loadHeats(eventId);
    } catch {
      // Revert to server state on failure
      await loadHeats(eventId);
    }
  }

  const pitches = [...new Set(heats.map((h) => h.pitchNumber))].sort();
  const byPitch = (p: number) =>
    heats
      .filter((h) => h.pitchNumber === p)
      .sort(
        (a, b) =>
          new Date(a.scheduledTime).getTime() -
          new Date(b.scheduledTime).getTime()
      );

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-1 text-sm text-muted">
        <Link href="/admin" className="hover:text-accent">
          Admin
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-ink">סדר עלייה</span>
      </nav>

      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight">סדר עלייה</h1>
          <p className="mt-1 text-muted">
            הפק לוח זמנים, גרור שורות לסידור ידני, לחץ על שחקן לוולידציה
          </p>
        </div>

        {/* Event selector + generate */}
        <div className="flex items-center gap-3">
          <select
            value={eventId}
            onChange={(e) => {
              setEventId(e.target.value);
              setReport(null);
              setHeats([]);
            }}
            className="rounded-xl border border-line bg-surface px-4 py-2.5 text-sm text-ink outline-none focus:border-accent"
          >
            <option value="">בחר תחרות...</option>
            {events.map((ev) => (
              <option key={ev._id} value={ev._id}>
                {ev.name}
              </option>
            ))}
          </select>

          <button
            onClick={generate}
            disabled={!eventId || generating}
            className="ds-btn ds-btn-primary px-5 py-2.5 disabled:opacity-40"
          >
            <RefreshCw className={`h-4 w-4 ${generating ? "animate-spin" : ""}`} />
            {heats.length > 0 ? "הפק מחדש" : "הפק סדר עלייה"}
          </button>

          {heats.length > 0 && (
            <button
              onClick={() => downloadExport(eventId)}
              className="ds-btn ds-btn-ghost px-5 py-2.5"
            >
              <Download className="h-4 w-4" />
              ייצוא לאקסל
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {report && <ReportBanner report={report} />}

      {heats.length > 0 && (
        <div className="mt-6">
          {/* Pitch tabs */}
          {pitches.length > 1 && (
            <div className="mb-4 flex gap-2">
              {pitches.map((p) => (
                <button
                  key={p}
                  onClick={() => setActiveTab(p)}
                  className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                    activeTab === p
                      ? "bg-lime text-lime-ink shadow-glow"
                      : "border border-line bg-surface-2 text-muted hover:text-ink"
                  }`}
                >
                  מגרש {p}
                  <span className="ml-2 rounded-full bg-black/10 px-1.5 py-0.5 text-xs">
                    {byPitch(p).length}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Conflict summary */}
          {conflicts.size > 0 && (
            <div className="mb-3 flex items-center gap-2 rounded-xl border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-gold">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {conflicts.size} ריצות עם בעיית מנוחה (פחות מ-{minRestMinutes} דק׳ בין ריצות
              של אותו שחקן/כלב) — מסומנות בצהוב
            </div>
          )}

          <PitchTable
            heats={byPitch(pitches.length > 1 ? activeTab : pitches[0])}
            conflicts={conflicts}
            onReorder={reorder}
            onPlayerClick={(id, name) => setSelectedPlayer({ id, name })}
          />
        </div>
      )}

      {heats.length === 0 && !generating && eventId && (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line py-20 text-center">
          <CalendarRange className="mb-3 h-10 w-10 text-muted" />
          <p className="font-extrabold text-ink">
            אין סדר עלייה עדיין
          </p>
          <p className="mt-1 text-sm text-muted">
            לחץ על ״הפק סדר עלייה״ כדי להריץ את המנוע
          </p>
        </div>
      )}

      {selectedPlayer && (
        <PlayerModal
          playerId={selectedPlayer.id}
          playerName={selectedPlayer.name}
          heats={heats}
          conflicts={conflicts}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </div>
  );
}

// ── Report banner ─────────────────────────────────────────────────────────────

function ReportBanner({ report }: { report: ScheduleReport }) {
  return (
    <div className="space-y-3">
      <div
        className={`flex items-center gap-3 rounded-2xl border px-5 py-4 ${
          report.fitsWindow
            ? "border-lime/30 bg-lime/10"
            : "border-gold/30 bg-gold/10"
        }`}
      >
        {report.fitsWindow ? (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-accent" />
        ) : (
          <AlertCircle className="h-5 w-5 shrink-0 text-gold" />
        )}
        <div className="flex flex-1 flex-wrap gap-x-6 gap-y-1 text-sm">
          <span>
            <strong>{report.heatsCreated}</strong> ריצות
            {report.placeholdersCreated > 0 && (
              <>
                {" "}
                + <strong>{report.placeholdersCreated}</strong> גמרים
              </>
            )}
          </span>
          <span>
            <strong>{report.makespanMinutes}</strong> דק׳ מתוך{" "}
            <strong>{report.windowMinutes}</strong> ({report.utilisationPct}%)
          </span>
        </div>
      </div>
      {report.warnings.map((w, i) => (
        <div
          key={i}
          className="flex items-start gap-2 rounded-xl border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-gold"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {w}
        </div>
      ))}
    </div>
  );
}

// ── Pitch table with drag-and-drop ────────────────────────────────────────────

function PitchTable({
  heats: propHeats,
  conflicts,
  onReorder,
  onPlayerClick,
}: {
  heats: Heat[];
  conflicts: Set<string>;
  onReorder: (newOrder: Heat[]) => Promise<void>;
  onPlayerClick: (id: string, name: string) => void;
}) {
  const [heats, setHeats] = useState<Heat[]>(propHeats);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // Sync when parent refreshes heats (after generate or reorder confirm)
  useEffect(() => {
    setHeats(propHeats);
  }, [propHeats]);

  if (heats.length === 0)
    return (
      <p className="py-8 text-center text-sm text-muted">
        אין ריצות במגרש זה
      </p>
    );

  function handleDragStart(idx: number) {
    setDragIdx(idx);
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    if (idx !== dragOverIdx) setDragOverIdx(idx);
  }

  function handleDrop(targetIdx: number) {
    if (dragIdx === null || dragIdx === targetIdx) {
      setDragIdx(null);
      setDragOverIdx(null);
      return;
    }
    const newOrder = [...heats];
    const [moved] = newOrder.splice(dragIdx, 1);
    newOrder.splice(targetIdx, 0, moved);
    setHeats(newOrder);
    setDragIdx(null);
    setDragOverIdx(null);
    onReorder(newOrder);
  }

  function handleDragEnd() {
    setDragIdx(null);
    setDragOverIdx(null);
  }

  return (
    <div className="ds-card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-xs font-extrabold uppercase tracking-wide text-muted">
            <th className="w-8 px-2 py-3" />
            <th className="px-4 py-3 text-right">#</th>
            <th className="px-4 py-3 text-right">שעה</th>
            <th className="px-4 py-3 text-right">מקצה</th>
            <th className="px-4 py-3 text-right">רמה</th>
            <th className="px-4 py-3 text-right">שחקן</th>
            <th className="px-4 py-3 text-right">כלב</th>
            <th className="px-4 py-3 text-right">סטטוס</th>
          </tr>
        </thead>
        <tbody>
          {heats.map((heat, idx) => {
            const isConflict = conflicts.has(heat._id);
            const isDragging = dragIdx === idx;
            const isDragOver = dragOverIdx === idx && dragIdx !== idx;
            const player = heat.team?.playerId;
            const dog = heat.team?.dogId;

            return (
              <tr
                key={heat._id}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={() => handleDrop(idx)}
                onDragEnd={handleDragEnd}
                className={[
                  "border-b border-line transition last:border-0",
                  heat.isFinalsPlaceholder ? "opacity-60" : "",
                  isDragging ? "opacity-40" : "",
                  isDragOver
                    ? "border-t-2 border-t-accent bg-accent/5"
                    : "hover:bg-surface-2",
                  isConflict ? "bg-gold/10" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {/* Drag handle */}
                <td className="cursor-grab px-2 py-3 text-muted active:cursor-grabbing">
                  <GripVertical className="h-4 w-4" />
                </td>

                <td className="px-4 py-3 font-score text-muted">{idx + 1}</td>

                <td className="px-4 py-3 font-score font-semibold text-ink">
                  {fmt(heat.scheduledTime)}
                </td>

                <td className="px-4 py-3 font-medium">
                  {DISCIPLINE_HE[heat.categoryId] ?? heat.categoryId}
                  {heat.isFinalsPlaceholder && (
                    <span className="mr-1 rounded bg-surface-2 px-1 py-0.5 text-xs text-muted">
                      גמר
                    </span>
                  )}
                </td>

                <td className="px-4 py-3 text-muted">
                  {LEVEL_HE[heat.experienceLevel] ?? heat.experienceLevel}
                </td>

                <td className="px-4 py-3">
                  {player ? (
                    <button
                      onClick={() => onPlayerClick(player._id, player.name)}
                      className={`font-bold underline-offset-2 hover:underline ${
                        isConflict ? "text-gold" : "text-ink"
                      }`}
                    >
                      {player.name}
                    </button>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>

                <td className="px-4 py-3 text-muted">
                  {dog ? (
                    dog.name
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>

                <td className="px-4 py-3">
                  <span
                    className={`ds-pill text-xs ${STATUS_COLOR[heat.status] ?? ""}`}
                  >
                    {STATUS_HE[heat.status] ?? heat.status}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Player modal ──────────────────────────────────────────────────────────────

function PlayerModal({
  playerId,
  playerName,
  heats,
  conflicts,
  onClose,
}: {
  playerId: string;
  playerName: string;
  heats: Heat[];
  conflicts: Set<string>;
  onClose: () => void;
}) {
  const playerHeats = heats
    .filter((h) => h.team?.playerId?._id === playerId)
    .sort(
      (a, b) =>
        new Date(a.scheduledTime).getTime() -
        new Date(b.scheduledTime).getTime()
    );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="ds-card w-full max-w-lg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div>
            <h2 className="text-lg font-black">{playerName}</h2>
            <p className="text-xs text-muted">{playerHeats.length} ריצות</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-muted hover:bg-surface-2"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Heats list */}
        <div className="divide-y divide-line">
          {playerHeats.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted">
              אין ריצות לשחקן זה
            </p>
          ) : (
            playerHeats.map((h, idx) => {
              const isConflict = conflicts.has(h._id);
              const prevHeat = playerHeats[idx - 1];
              const gapMin = prevHeat
                ? Math.round(
                    (new Date(h.scheduledTime).getTime() -
                      new Date(prevHeat.scheduledTime).getTime()) /
                      60000
                  )
                : null;

              return (
                <div
                  key={h._id}
                  className={`flex items-center gap-4 px-6 py-3 ${
                    isConflict ? "bg-gold/10" : ""
                  }`}
                >
                  <span className="w-12 font-score text-sm font-semibold text-ink">
                    {fmt(h.scheduledTime)}
                  </span>

                  <span className="w-16 rounded-lg bg-surface-2 px-2 py-0.5 text-center text-xs text-muted">
                    מגרש {h.pitchNumber}
                  </span>

                  <div className="flex-1">
                    <span className="font-medium">
                      {DISCIPLINE_HE[h.categoryId] ?? h.categoryId}
                    </span>
                    <span className="mr-2 text-xs text-muted">
                      {LEVEL_HE[h.experienceLevel]}
                    </span>
                  </div>

                  <span className="text-sm text-muted">
                    {h.team?.dogId?.name ?? "—"}
                  </span>

                  {isConflict && (
                    <AlertCircle className="h-4 w-4 shrink-0 text-gold" />
                  )}

                  {gapMin !== null && (
                    <span
                      className={`font-score text-xs tabular-nums ${
                        isConflict ? "font-semibold text-gold" : "text-muted"
                      }`}
                    >
                      +{gapMin} דק׳
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
