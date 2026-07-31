"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarRange, Clock, Flag, Timer } from "lucide-react";
import { createEvent } from "../../../../lib/api";

// §3.2 Event creation wizard — step 1: basic event details.
// Submits to POST /api/events; on success redirects to /admin/events/:id/import

export default function NewEventPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    date: "",
    startTime: "09:00",
    endTime: "17:00",
    activePitches: 2,
    minRestTimeMinutes: 30,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(field: string, value: string | number) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const estimatedStartTime = new Date(`${form.date}T${form.startTime}`).toISOString();
    const estimatedEndTime = new Date(`${form.date}T${form.endTime}`).toISOString();

    try {
      const event = await createEvent({
        name: form.name,
        estimatedStartTime,
        estimatedEndTime,
        activePitches: form.activePitches,
        minRestTimeMinutes: form.minRestTimeMinutes,
      });
      router.push(`/admin/events/${event._id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <header className="mb-8">
        <h1 className="text-2xl font-black tracking-tight">תחרות חדשה</h1>
        <p className="mt-1 text-muted">
          הגדר את פרטי התחרות. אחר כך תוכל לייבא רשימת מתחרים ולהפיק סדר עלייה.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Event name */}
        <Field label="שם התחרות" icon={<Flag className="h-4 w-4" />}>
          <input
            required
            type="text"
            placeholder="למשל: J'Games תל אביב 2026"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            className={inputCls}
          />
        </Field>

        {/* Date */}
        <Field label="תאריך" icon={<CalendarRange className="h-4 w-4" />}>
          <input
            required
            type="date"
            value={form.date}
            onChange={(e) => set("date", e.target.value)}
            className={inputCls}
          />
        </Field>

        {/* Times */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="שעת פתיחה" icon={<Clock className="h-4 w-4" />}>
            <input
              required
              type="time"
              value={form.startTime}
              onChange={(e) => set("startTime", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="שעת סגירה" icon={<Clock className="h-4 w-4" />}>
            <input
              required
              type="time"
              value={form.endTime}
              onChange={(e) => set("endTime", e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>

        {/* Pitches + rest */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="מספר מגרשים" icon={<Flag className="h-4 w-4" />}>
            <input
              required
              type="number"
              min={1}
              max={8}
              value={form.activePitches}
              onChange={(e) => set("activePitches", Number(e.target.value))}
              className={inputCls}
            />
          </Field>
          <Field label="מנוחה מינימלית בין ריצות (דק׳)" icon={<Timer className="h-4 w-4" />}>
            <input
              required
              type="number"
              min={0}
              max={120}
              value={form.minRestTimeMinutes}
              onChange={(e) => set("minRestTimeMinutes", Number(e.target.value))}
              className={inputCls}
            />
          </Field>
        </div>

        {error && (
          <p className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="ds-btn ds-btn-primary w-full py-4 text-base disabled:opacity-50"
        >
          {loading ? "יוצר תחרות..." : "צור תחרות →"}
        </button>
      </form>
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
