"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarRange, ListOrdered, Plus, Trash2 } from "lucide-react";
import { getLeagues, deleteLeague } from "../../../lib/api";
import type { LeagueDto } from "../../../lib/types";

// §3.2 League list — mirrors the events list (/admin/events): shows every Distance
// league, links to its portal (/l/:slug), and offers creation + deletion.

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

export default function LeaguesPage() {
  const [leagues, setLeagues] = useState<LeagueDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    getLeagues()
      .then(setLeagues)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(lg: LeagueDto) {
    const ok = window.confirm(
      `למחוק את הליגה "${lg.name}"?\n\nפעולה זו תמחק לצמיתות את כל הסבבים, המקצים, הניקוד והרישומים של הליגה. לא ניתן לשחזר.`
    );
    if (!ok) return;
    setDeletingId(lg._id);
    try {
      await deleteLeague(lg._id);
      setLeagues((prev) => prev.filter((l) => l._id !== lg._id));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "מחיקת הליגה נכשלה");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight">ליגות</h1>
          <p className="mt-1 text-muted">ניהול כל ליגות הדיסטנס במערכת</p>
        </div>
        <Link href="/admin/leagues/new" className="ds-btn ds-btn-primary px-5 py-2.5">
          <Plus className="h-4 w-4" />
          ליגה חדשה
        </Link>
      </header>

      {loading ? (
        <div className="py-16 text-center text-muted">טוען...</div>
      ) : leagues.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="space-y-3">
          {leagues.map((lg) => {
            const rounds = lg.dates.reduce(
              (n, d) => n + (d.roundsCount ?? 0),
              0
            );
            return (
              <li
                key={lg._id}
                className="ds-card flex items-center gap-3 p-5 transition hover:border-accent/40"
              >
                <Link
                  href={`/l/${lg.slug}`}
                  className="flex flex-1 items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-4">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
                      <ListOrdered className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="font-extrabold">{lg.name}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-sm text-muted">
                        <CalendarRange className="h-3.5 w-3.5" />
                        {lg.dates.length} מועדים · {rounds} סבבים
                      </p>
                    </div>
                  </div>
                  <span
                    className={`ds-pill ${STATUS_COLOR[lg.status] ?? STATUS_COLOR.Planning}`}
                  >
                    {STATUS_LABEL[lg.status] ?? lg.status}
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => handleDelete(lg)}
                  disabled={deletingId === lg._id}
                  aria-label={`מחק את ${lg.name}`}
                  title="מחק ליגה"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted transition hover:bg-red-500/10 hover:text-red-500 disabled:opacity-40"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line py-20 text-center">
      <ListOrdered className="mb-3 h-10 w-10 text-muted" />
      <p className="font-extrabold text-ink">אין ליגות עדיין</p>
      <p className="mt-1 text-sm text-muted">לחץ על ״ליגה חדשה״ כדי להתחיל</p>
    </div>
  );
}
