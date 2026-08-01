"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarRange,
  Flag,
  ListOrdered,
  Plus,
  Timer,
  Trophy,
  X,
} from "lucide-react";
import { createLeague } from "../../../../lib/api";

// Distance League creation wizard. The organizer marks explicit dates (מועדים),
// each with a number of rounds (סבבים, default 2), and picks the winner rule —
// best-of-N (default) or sum of all rounds. Each round becomes a Distance Event.

interface DateRow {
  date: string;
  roundsCount: number;
  label: string;
}

export default function NewLeaguePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  // The league slug is the root of its round tree (/l/:slug/:date/:round), so
  // the organizer picks it rather than living with the random fallback.
  const [slug, setSlug] = useState("");
  const [dates, setDates] = useState<DateRow[]>([
    { date: "", roundsCount: 2, label: "" },
  ]);
  const [mode, setMode] = useState<"bestOf" | "sum">("bestOf");
  const [bestN, setBestN] = useState(3);
  const [activePitches, setActivePitches] = useState(1);
  const [minRestTimeMinutes, setMinRest] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalRounds = dates.reduce((s, d) => s + (Number(d.roundsCount) || 0), 0);

  function updateDate(i: number, patch: Partial<DateRow>) {
    setDates((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addDate() {
    setDates((rows) => [...rows, { date: "", roundsCount: 2, label: "" }]);
  }
  function removeDate(i: number) {
    setDates((rows) => rows.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const league = await createLeague({
        name,
        ...(slug.trim() ? { slug: slug.trim() } : {}),
        dates: dates
          .filter((d) => d.date)
          .map((d) => ({
            date: new Date(`${d.date}T09:00`).toISOString(),
            roundsCount: Number(d.roundsCount) || 2,
            ...(d.label.trim() ? { label: d.label.trim() } : {}),
          })),
        scoring: { mode, bestN: Number(bestN) || 3 },
        activePitches,
        minRestTimeMinutes,
      });
      router.push(`/l/${league.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה לא ידועה");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-8">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <ListOrdered className="h-6 w-6 text-nav" />
          ליגת דיסטנס חדשה
        </h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">
          שיפוט זהה לדיסטנס רגיל, פרוס על כמה מועדים. המנצח נקבע לפי הסבבים הטובים ביותר.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Field label="שם הליגה" icon={<Flag className="h-4 w-4" />}>
          <input
            required
            type="text"
            placeholder="למשל: ליגת דיסטנס חורף 2026"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputCls}
          />
        </Field>

        <Field label="כתובת הליגה" icon={<Flag className="h-4 w-4" />}>
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-sm font-semibold text-slate-500 dark:text-slate-400">
              /l/
            </span>
            <input
              type="text"
              dir="ltr"
              placeholder="distance-2026"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className={inputCls}
            />
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            אותיות באנגלית, ספרות ומקפים. כל הסבבים יישבו תחתיה — למשל
            <span dir="ltr" className="mx-1 font-mono">
              /l/{slug.trim() || "distance-2026"}/2026-07-25/1
            </span>
            . אפשר להשאיר ריק ותיווצר כתובת אוטומטית.
          </p>
        </Field>

        {/* Dates */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-400">
              <CalendarRange className="h-4 w-4" />
              מועדים ({totalRounds} סבבים סה״כ)
            </span>
            <button
              type="button"
              onClick={addDate}
              className="flex items-center gap-1 rounded-xl bg-nav/10 px-3 py-1.5 text-xs font-semibold text-nav hover:bg-nav/20"
            >
              <Plus className="h-3.5 w-3.5" />
              הוסף מועד
            </button>
          </div>
          <div className="space-y-3">
            {dates.map((d, i) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_auto_auto] items-end gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
              >
                <label className="block">
                  <span className="mb-1 block text-xs text-slate-500">תאריך</span>
                  <input
                    required
                    type="date"
                    value={d.date}
                    onChange={(e) => updateDate(i, { date: e.target.value })}
                    className={inputCls}
                  />
                </label>
                <label className="block w-24">
                  <span className="mb-1 block text-xs text-slate-500">סבבים</span>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={d.roundsCount}
                    onChange={(e) =>
                      updateDate(i, { roundsCount: Number(e.target.value) })
                    }
                    className={inputCls}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => removeDate(i)}
                  disabled={dates.length === 1}
                  className="mb-1 grid h-10 w-10 place-items-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-30 dark:hover:bg-red-950/30"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Scoring */}
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
          <span className="mb-3 flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-400">
            <Trophy className="h-4 w-4" />
            חישוב מנצח
          </span>
          <div className="flex flex-wrap gap-2">
            <ModeChip active={mode === "bestOf"} onClick={() => setMode("bestOf")}>
              הטוב מ-N סבבים
            </ModeChip>
            <ModeChip active={mode === "sum"} onClick={() => setMode("sum")}>
              סכום כל הסבבים
            </ModeChip>
          </div>
          {mode === "bestOf" && (
            <label className="mt-3 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              כמה סבבים סופרים (N):
              <input
                type="number"
                min={1}
                max={totalRounds || 99}
                value={bestN}
                onChange={(e) => setBestN(Number(e.target.value))}
                className="w-20 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
          )}
        </div>

        {/* Pitches + rest */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="מספר מגרשים" icon={<Flag className="h-4 w-4" />}>
            <input
              type="number"
              min={1}
              max={8}
              value={activePitches}
              onChange={(e) => setActivePitches(Number(e.target.value))}
              className={inputCls}
            />
          </Field>
          <Field label="מנוחה מינימלית (דק׳)" icon={<Timer className="h-4 w-4" />}>
            <input
              type="number"
              min={0}
              max={120}
              value={minRestTimeMinutes}
              onChange={(e) => setMinRest(Number(e.target.value))}
              className={inputCls}
            />
          </Field>
        </div>

        {error && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-2xl bg-nav py-4 text-base font-semibold text-nav-fg shadow-soft transition hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "יוצר ליגה..." : "צור ליגה →"}
        </button>
      </form>
    </div>
  );
}

function ModeChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
        active
          ? "bg-nav text-nav-fg shadow-soft"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
      }`}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-400">
        {icon}
        {label}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm outline-none focus:border-nav focus:ring-2 focus:ring-nav/20 dark:border-slate-700 dark:bg-slate-900";
