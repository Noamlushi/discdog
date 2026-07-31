"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  FileSpreadsheet,
  Trophy,
  Upload,
  X,
} from "lucide-react";

import { importEventRoster } from "../../../lib/api";

// §5.1 Roster import UI — upload Excel/CSV, attach to an event, show summary.

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface Event {
  _id: string;
  name: string;
  estimatedStartTime: string;
}

interface ImportSummary {
  playersCreated: number;
  dogsCreated: number;
  registrationsCreated: number;
  registrationsSkippedDuplicate: number;
  rowsProcessed: number;
  unknownDisciplines: { row: number; token: string }[];
  warnings: string[];
}

export default function ImportPage() {
  return (
    <Suspense>
      <ImportForm />
    </Suspense>
  );
}

function ImportForm() {
  const params = useSearchParams();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [eventId, setEventId] = useState(params.get("eventId") ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  useEffect(() => {
    fetch(`${API}/api/events`)
      .then((r) => r.json())
      .then(setEvents)
      .catch(console.error);
  }, []);

  function pickFile(f: File) {
    setFile(f);
    setError(null);
    setSummary(null);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) pickFile(f);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !eventId) return;
    setLoading(true);
    setError(null);
    setSummary(null);

    try {
      const body = await importEventRoster(eventId, file);
      setSummary(body as ImportSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה לא ידועה");
    } finally {
      setLoading(false);
    }
  }

  const selectedEvent = events.find((e) => e._id === eventId);

  return (
    <div className="mx-auto max-w-2xl">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-1 text-sm text-muted">
        <Link href="/admin" className="hover:text-accent">Admin</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-ink">ייבוא מתחרים</span>
      </nav>

      <header className="mb-8">
        <h1 className="text-2xl font-black tracking-tight">ייבוא רשימת מתחרים</h1>
        <p className="mt-1 text-muted">
          העלה קובץ Excel או CSV שיוצא מ-Google Forms. עמודות נדרשות: שם מלא, שם הכלב, טלפון, מקצים.
        </p>
      </header>

      {summary ? (
        <ImportResult
          summary={summary}
          eventId={eventId}
          onReset={() => { setSummary(null); setFile(null); }}
          onSchedule={() => router.push(`/admin/schedule?eventId=${eventId}`)}
        />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Event selector */}
          <label className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-sm font-bold text-muted">
              <Trophy className="h-4 w-4" />
              תחרות
            </span>
            <select
              required
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink outline-none focus:border-accent"
            >
              <option value="">בחר תחרות...</option>
              {events.map((ev) => (
                <option key={ev._id} value={ev._id}>
                  {ev.name} —{" "}
                  {new Date(ev.estimatedStartTime).toLocaleDateString("he-IL")}
                </option>
              ))}
            </select>
          </label>

          {/* File drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 transition ${
              dragging
                ? "border-accent bg-accent/5"
                : file
                ? "border-lime bg-lime/10"
                : "border-line hover:border-accent/50"
            }`}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f); }}
            />
            {file ? (
              <>
                <FileSpreadsheet className="mb-3 h-10 w-10 text-accent" />
                <p className="font-bold text-accent">{file.name}</p>
                <p className="mt-1 text-sm text-muted">
                  {(file.size / 1024).toFixed(1)} KB — לחץ להחלפה
                </p>
              </>
            ) : (
              <>
                <Upload className="mb-3 h-10 w-10 text-muted" />
                <p className="font-bold text-ink">
                  גרור קובץ לכאן
                </p>
                <p className="mt-1 text-sm text-muted">
                  או לחץ לבחירה — XLSX, XLS, CSV
                </p>
              </>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !file || !eventId}
            className="ds-btn ds-btn-primary w-full py-4 text-base disabled:opacity-40"
          >
            {loading ? "מייבא..." : "ייבא רשימה →"}
          </button>
        </form>
      )}
    </div>
  );
}

function ImportResult({
  summary,
  eventId,
  onReset,
  onSchedule,
}: {
  summary: ImportSummary;
  eventId: string;
  onReset: () => void;
  onSchedule: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* Success banner */}
      <div className="flex items-center gap-3 rounded-2xl border border-lime/30 bg-lime/10 px-5 py-4">
        <CheckCircle2 className="h-6 w-6 shrink-0 text-accent" />
        <p className="font-bold text-accent">הייבוא הסתיים בהצלחה</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="שורות עובדו" value={summary.rowsProcessed} />
        <StatCard label="שחקנים נוספו" value={summary.playersCreated} />
        <StatCard label="כלבים נוספו" value={summary.dogsCreated} />
        <StatCard label="רישומים נוספו" value={summary.registrationsCreated} />
      </div>

      {summary.registrationsSkippedDuplicate > 0 && (
        <p className="text-sm text-muted">
          {summary.registrationsSkippedDuplicate} רישומים כפולים דולגו
        </p>
      )}

      {/* Warnings */}
      {summary.warnings.length > 0 && (
        <div className="space-y-2">
          {summary.warnings.map((w, i) => (
            <div
              key={i}
              className="flex items-start gap-2 rounded-xl border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-gold"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {w}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onReset}
          className="ds-btn ds-btn-ghost"
        >
          <X className="h-4 w-4" />
          ייבוא נוסף
        </button>
        <button
          onClick={onSchedule}
          className="ds-btn ds-btn-primary flex-1 py-3"
        >
          המשך לסדר עלייה →
        </button>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="ds-card p-4 text-center">
      <p className="font-score text-2xl font-black text-accent">{value}</p>
      <p className="mt-1 text-xs text-muted">{label}</p>
    </div>
  );
}
