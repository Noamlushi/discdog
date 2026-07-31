"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  CalendarRange,
  ChevronRight,
  Clock,
  Flag,
  Timer,
  Trophy,
  Trash2,
  Upload,
  UserPlus,
  CalendarDays,
} from "lucide-react";
import { deleteEvent } from "../../../../lib/api";

// §3.2 Event detail — shows event info + next-step actions (import roster, generate schedule).

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface Event {
  _id: string;
  name: string;
  estimatedStartTime: string;
  estimatedEndTime: string;
  activePitches: number;
  minRestTimeMinutes: number;
  status: string;
}

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/events/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setEvent)
      .catch(() => router.replace("/admin/events"))
      .finally(() => setLoading(false));
  }, [id, router]);

  async function handleDelete() {
    if (!event) return;
    const ok = window.confirm(
      `למחוק את התחרות "${event.name}"?\n\nפעולה זו תמחק לצמיתות את כל המקצים, הניקוד והרישומים של התחרות. לא ניתן לשחזר.`
    );
    if (!ok) return;
    setDeleting(true);
    try {
      await deleteEvent(event._id);
      router.replace("/admin/events");
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "מחיקת התחרות נכשלה");
      setDeleting(false);
    }
  }

  if (loading) return <div className="py-16 text-center text-muted">טוען...</div>;
  if (!event) return null;

  const start = new Date(event.estimatedStartTime);
  const end = new Date(event.estimatedEndTime);
  const duration = Math.round((end.getTime() - start.getTime()) / 60000);

  return (
    <div className="mx-auto max-w-2xl">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-1 text-sm text-muted">
        <Link href="/admin/events" className="hover:text-accent">
          תחרויות
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-ink">{event.name}</span>
      </nav>

      {/* Title */}
      <div className="mb-8 flex items-center gap-4">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
          <Trophy className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-black tracking-tight">{event.name}</h1>
          <span className="text-sm text-muted">
            {event.status === "Planning" ? "בתכנון" : event.status === "Live" ? "פעיל" : "הסתיים"}
          </span>
        </div>
      </div>

      {/* Details grid */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat icon={<CalendarDays className="h-4 w-4" />} label="תאריך">
          {start.toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" })}
        </Stat>
        <Stat icon={<Clock className="h-4 w-4" />} label="שעות">
          {start.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
          {" – "}
          {end.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
        </Stat>
        <Stat icon={<Flag className="h-4 w-4" />} label="מגרשים">
          {event.activePitches}
        </Stat>
        <Stat icon={<Timer className="h-4 w-4" />} label="מנוחה מינ׳">
          {event.minRestTimeMinutes} דק׳
        </Stat>
      </div>

      {/* Duration banner */}
      <div className="mb-8 rounded-2xl border border-accent/25 bg-accent/10 px-5 py-4">
        <p className="text-sm font-bold text-accent">
          <CalendarRange className="mr-1 inline h-4 w-4" />
          חלון זמן: {Math.floor(duration / 60)} שע׳ {duration % 60} דק׳
        </p>
      </div>

      {/* Next steps */}
      <h2 className="ds-label mb-3">הצעדים הבאים</h2>
      <div className="space-y-3">
        <ActionCard
          href={`/admin/import?eventId=${id}`}
          icon={<Upload className="h-5 w-5" />}
          title="ייבוא רשימת מתחרים"
          description="העלה קובץ Excel / CSV עם שמות, כלבים ומקצים"
        />
        <ActionCard
          href={`/admin/roster?eventId=${id}`}
          icon={<UserPlus className="h-5 w-5" />}
          title="הוספת מתחרים ידנית"
          description="הזן מתחרה, כלב והמקצים שבהם הוא מתחרה"
        />
        <ActionCard
          href={`/admin/schedule?eventId=${id}`}
          icon={<CalendarRange className="h-5 w-5" />}
          title="הפקת סדר עלייה"
          description="הרץ את מנוע הלוח זמנים וערוך ידנית"
        />
      </div>

      {/* Danger zone */}
      <div className="mt-10 border-t border-line pt-6">
        <h2 className="ds-label mb-3 text-danger">אזור מסוכן</h2>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="ds-card flex w-full items-center gap-4 p-5 text-right transition hover:border-danger/50 disabled:opacity-50"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-danger/10 text-danger">
            <Trash2 className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <p className="font-extrabold text-danger">
              {deleting ? "מוחק…" : "מחיקת התחרות"}
            </p>
            <p className="mt-0.5 text-sm text-muted">
              מוחק לצמיתות את התחרות וכל המקצים, הניקוד והרישומים שלה
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="ds-card p-4">
      <p className="mb-1 flex items-center gap-1 text-xs font-bold text-muted">
        {icon}
        {label}
      </p>
      <p className="text-sm font-bold text-ink">{children}</p>
    </div>
  );
}

function ActionCard({
  href,
  icon,
  title,
  description,
  disabled,
  disabledReason,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const cls = "ds-card flex items-center gap-4 p-5";
  const inner = (
    <>
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${disabled ? "bg-surface-2 text-muted" : "bg-accent/10 text-accent"}`}
      >
        {icon}
      </span>
      <div className="flex-1">
        <p className={`font-extrabold ${disabled ? "text-muted" : ""}`}>{title}</p>
        <p className="mt-0.5 text-sm text-muted">
          {disabled ? disabledReason : description}
        </p>
      </div>
      {!disabled && <ChevronRight className="h-5 w-5 text-muted" />}
    </>
  );

  return disabled ? (
    <div className={`${cls} opacity-60`}>{inner}</div>
  ) : (
    <Link href={href} className={`${cls} transition hover:border-accent/40`}>
      {inner}
    </Link>
  );
}
