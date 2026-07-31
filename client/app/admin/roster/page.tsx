"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ChevronRight,
  CheckCircle2,
  PawPrint,
  Phone,
  Trophy,
  User,
  UserPlus,
} from "lucide-react";

import { addEventRegistration } from "../../../lib/api";
import type { ExperienceLevel } from "../../../lib/types";

// §5.1 Manual roster entry — a hand-typed alternative to the spreadsheet import.
// Add one competitor (player + dog) at a time, pick the disciplines (מקצים) they
// compete in, and (for Freestyle/Distance) the level. Each submission creates the
// registrations on the event; a running list shows what was added this session.

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// Discipline keys mirror the server Discipline enum; labels are the Hebrew names.
const DISCIPLINES: { key: string; label: string }[] = [
  { key: "Distance", label: "דיסטנס" },
  { key: "IceDrop", label: "אייס דרופ" },
  { key: "MultipleChallenge", label: "מולטיפול צ'אלנג'" },
  { key: "Agility", label: "פריזג'יליטי" },
  { key: "WheelOfFortune", label: "גלגל המזל" },
  { key: "JTrail", label: "ג'יטרייל" },
  { key: "Shuffle", label: "שאפל ב-30" },
  { key: "CrissCross", label: "קריס קרוס" },
  { key: "TimeTrail", label: "טיים טרייל" },
  { key: "Freestyle", label: "פריסטייל" },
];

// Only these disciplines split by experience level (§rulebook).
const LEVELLED = new Set(["Freestyle", "Distance"]);

interface EventInfo {
  _id: string;
  name: string;
}

interface AddedRow {
  player: string;
  dog: string;
  disciplines: string[];
  created: number;
  skipped: number;
}

export default function RosterPage() {
  return (
    <Suspense>
      <RosterForm />
    </Suspense>
  );
}

function RosterForm() {
  const params = useSearchParams();
  const eventId = params.get("eventId") ?? "";
  const [event, setEvent] = useState<EventInfo | null>(null);

  const [playerName, setPlayerName] = useState("");
  const [phone, setPhone] = useState("");
  const [dogName, setDogName] = useState("");
  const [dogAge, setDogAge] = useState("");
  // discipline key → selected level (Beginner default; only used for LEVELLED)
  const [selected, setSelected] = useState<Record<string, ExperienceLevel>>({});

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<AddedRow[]>([]);

  useEffect(() => {
    if (!eventId) return;
    fetch(`${API}/api/events/${eventId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((e) => setEvent({ _id: e._id, name: e.name }))
      .catch(() => setEvent(null));
  }, [eventId]);

  function toggle(key: string) {
    setSelected((prev) => {
      const next = { ...prev };
      if (key in next) delete next[key];
      else next[key] = "Beginner";
      return next;
    });
  }

  function setLevel(key: string, level: ExperienceLevel) {
    setSelected((prev) => ({ ...prev, [key]: level }));
  }

  function reset() {
    setPlayerName("");
    setPhone("");
    setDogName("");
    setDogAge("");
    setSelected({});
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const entries = Object.entries(selected).map(([discipline, level]) => ({
      discipline,
      level,
    }));
    if (entries.length === 0) {
      setError("בחר לפחות מקצה אחד");
      return;
    }
    setSaving(true);
    try {
      const res = await addEventRegistration(eventId, {
        playerName,
        phone,
        dogName,
        dogAgeYears: dogAge ? Number(dogAge) : undefined,
        entries,
      });
      setAdded((prev) => [
        {
          player: playerName,
          dog: dogName,
          disciplines: Object.keys(selected).map(
            (k) => DISCIPLINES.find((d) => d.key === k)?.label ?? k
          ),
          created: res.registrationsCreated,
          skipped: res.registrationsSkippedDuplicate,
        },
        ...prev,
      ]);
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "הוספת המתחרה נכשלה");
    } finally {
      setSaving(false);
    }
  }

  if (!eventId) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center text-muted">
        חסר מזהה תחרות.{" "}
        <Link href="/admin/events" className="text-accent">
          חזרה לתחרויות
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-1 text-sm text-muted">
        <Link href="/admin/events" className="hover:text-accent">
          תחרויות
        </Link>
        <ChevronRight className="h-4 w-4" />
        <Link href={`/admin/events/${eventId}`} className="hover:text-accent">
          {event?.name ?? "תחרות"}
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-ink">הוספת מתחרים</span>
      </nav>

      <header className="mb-8 flex items-center gap-4">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
          <UserPlus className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-black tracking-tight">הוספת מתחרים ידנית</h1>
          {event && (
            <p className="mt-0.5 flex items-center gap-1 text-sm text-muted">
              <Trophy className="h-3.5 w-3.5" />
              {event.name}
            </p>
          )}
        </div>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="שם המתחרה" icon={<User className="h-4 w-4" />}>
            <input
              required
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="שם מלא"
              className={inputCls}
            />
          </Field>
          <Field label="טלפון" icon={<Phone className="h-4 w-4" />}>
            <input
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="050-0000000"
              className={inputCls}
            />
          </Field>
          <Field label="שם הכלב" icon={<PawPrint className="h-4 w-4" />}>
            <input
              required
              value={dogName}
              onChange={(e) => setDogName(e.target.value)}
              placeholder="שם הכלב"
              className={inputCls}
            />
          </Field>
          <Field label="גיל הכלב (שנים, אופציונלי)" icon={<PawPrint className="h-4 w-4" />}>
            <input
              type="number"
              min={0}
              max={25}
              step="0.5"
              value={dogAge}
              onChange={(e) => setDogAge(e.target.value)}
              placeholder="למשל 3"
              className={inputCls}
            />
          </Field>
        </div>

        {/* Disciplines */}
        <div>
          <span className="mb-2 block text-sm font-bold text-muted">
            מקצים {Object.keys(selected).length > 0 && `(${Object.keys(selected).length})`}
          </span>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {DISCIPLINES.map((d) => {
              const on = d.key in selected;
              return (
                <div
                  key={d.key}
                  className={`rounded-xl border p-3 transition ${
                    on ? "border-accent bg-accent/10" : "border-line bg-surface"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggle(d.key)}
                    className="flex w-full items-center justify-between gap-2 text-right"
                  >
                    <span className="font-bold">{d.label}</span>
                    <span
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border ${
                        on
                          ? "border-accent bg-accent text-lime-ink"
                          : "border-line"
                      }`}
                    >
                      {on && <CheckCircle2 className="h-4 w-4" />}
                    </span>
                  </button>
                  {on && LEVELLED.has(d.key) && (
                    <div className="mt-2 flex gap-2">
                      {(["Beginner", "Advanced"] as ExperienceLevel[]).map((lv) => (
                        <button
                          key={lv}
                          type="button"
                          onClick={() => setLevel(d.key, lv)}
                          className={`flex-1 rounded-lg px-2 py-1 text-xs font-bold transition ${
                            selected[d.key] === lv
                              ? "bg-accent text-lime-ink"
                              : "bg-surface-2 text-muted hover:text-ink"
                          }`}
                        >
                          {lv === "Beginner" ? "מתחילים" : "מתקדמים"}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {error && (
          <p className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="ds-btn ds-btn-primary flex-1 py-3.5 disabled:opacity-50"
          >
            {saving ? "מוסיף…" : "הוסף מתחרה"}
          </button>
          <Link
            href={`/admin/events/${eventId}`}
            className="ds-btn ds-btn-ghost px-5 py-3.5"
          >
            סיום
          </Link>
        </div>
      </form>

      {/* Added this session */}
      {added.length > 0 && (
        <div className="mt-10">
          <h2 className="ds-label mb-3">נוספו במהלך המושב ({added.length})</h2>
          <ul className="space-y-2">
            {added.map((row, i) => (
              <li
                key={i}
                className="ds-card flex items-center justify-between gap-3 p-4"
              >
                <div className="min-w-0">
                  <p className="truncate font-bold">
                    {row.player} · {row.dog}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-muted">
                    {row.disciplines.join(", ")}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-bold text-accent">
                  +{row.created}
                  {row.skipped > 0 && (
                    <span className="text-muted"> ({row.skipped} כפולים)</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
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
      <span className="mb-1.5 flex items-center gap-1.5 text-sm font-bold text-muted">
        {icon}
        {label}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink outline-none focus:border-accent";
