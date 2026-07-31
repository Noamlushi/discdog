"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarRange, Plus, Trash2, Trophy } from "lucide-react";
import { deleteEvent } from "../../../lib/api";

// §3.2 Event list — shows all events, links to per-event detail and creation.

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface Event {
  _id: string;
  name: string;
  estimatedStartTime: string;
  estimatedEndTime: string;
  activePitches: number;
  status: string;
}

const STATUS_COLOR: Record<string, string> = {
  Planning: "ds-pill-done",
  Live: "ds-pill-live",
  Completed: "ds-pill-ondeck",
};

const STATUS_LABEL: Record<string, string> = {
  Planning: "תכנון",
  Live: "פעיל",
  Completed: "הסתיים",
};

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/api/events`)
      .then((r) => r.json())
      .then(setEvents)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(ev: Event) {
    const ok = window.confirm(
      `למחוק את התחרות "${ev.name}"?\n\nפעולה זו תמחק לצמיתות את כל המקצים, הניקוד והרישומים של התחרות. לא ניתן לשחזר.`
    );
    if (!ok) return;
    setDeletingId(ev._id);
    try {
      await deleteEvent(ev._id);
      setEvents((prev) => prev.filter((e) => e._id !== ev._id));
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : "מחיקת התחרות נכשלה"
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight">תחרויות</h1>
          <p className="mt-1 text-muted">
            ניהול כל התחרויות במערכת
          </p>
        </div>
        <Link
          href="/admin/events/new"
          className="ds-btn ds-btn-primary px-5 py-2.5"
        >
          <Plus className="h-4 w-4" />
          תחרות חדשה
        </Link>
      </header>

      {loading ? (
        <div className="py-16 text-center text-muted">טוען...</div>
      ) : events.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="space-y-3">
          {events.map((ev) => (
            <li key={ev._id} className="ds-card flex items-center gap-3 p-5 transition hover:border-accent/40">
              <Link
                href={`/admin/events/${ev._id}`}
                className="flex flex-1 items-center justify-between gap-3"
              >
                <div className="flex items-center gap-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
                    <Trophy className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-extrabold">{ev.name}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-sm text-muted">
                      <CalendarRange className="h-3.5 w-3.5" />
                      {new Date(ev.estimatedStartTime).toLocaleDateString("he-IL", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                      {" · "}
                      {ev.activePitches} מגרשים
                    </p>
                  </div>
                </div>
                <span
                  className={`ds-pill ${STATUS_COLOR[ev.status] ?? STATUS_COLOR.Planning}`}
                >
                  {STATUS_LABEL[ev.status] ?? ev.status}
                </span>
              </Link>
              <button
                type="button"
                onClick={() => handleDelete(ev)}
                disabled={deletingId === ev._id}
                aria-label={`מחק את ${ev.name}`}
                title="מחק תחרות"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted transition hover:bg-red-500/10 hover:text-red-500 disabled:opacity-40"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line py-20 text-center">
      <Trophy className="mb-3 h-10 w-10 text-muted" />
      <p className="font-extrabold text-ink">אין תחרויות עדיין</p>
      <p className="mt-1 text-sm text-muted">לחץ על ״תחרות חדשה״ כדי להתחיל</p>
    </div>
  );
}
