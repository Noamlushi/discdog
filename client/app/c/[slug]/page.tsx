"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  CalendarDays,
  ChevronRight,
  Clock,
  Flag,
  Gavel,
  LayoutDashboard,
  ListOrdered,
  Settings,
  Timer,
  Trophy,
} from "lucide-react";
import { getEventBySlug } from "../../../lib/api";
import type { EventDto } from "../../../lib/types";
import { useAuth } from "../../../context/AuthContext";

// Competition portal — the shareable unique-URL entry point (/c/:slug). Public
// visitors get the live dashboard + leaderboard; managers (Admin/Organizer) also
// see the management + judge surfaces. This is the "one URL per competition" the
// owner asked for.
const STATUS_LABEL: Record<string, string> = {
  Planning: "בתכנון",
  Live: "פעיל",
  Completed: "הסתיים",
};

export default function CompetitionPortalPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [event, setEvent] = useState<EventDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEventBySlug(slug)
      .then(setEvent)
      .catch(() => router.replace("/"))
      .finally(() => setLoading(false));
  }, [slug, router]);

  return (
    <main className="min-h-screen bg-arena text-ink">
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-14">
        {loading ? (
          <p className="py-16 text-center text-muted">טוען…</p>
        ) : !event ? null : (
          <Portal event={event} />
        )}
      </div>
    </main>
  );
}

function Portal({ event }: { event: EventDto }) {
  const { isManager } = useAuth();
  const start = new Date(event.estimatedStartTime);
  const end = new Date(event.estimatedEndTime);
  const duration = Math.round((end.getTime() - start.getTime()) / 60000);

  return (
    <>
      <nav className="mb-6 flex items-center gap-1 text-sm text-muted">
        <Link href="/" className="hover:text-accent">
          תחרויות
        </Link>
        <ChevronRight className="h-4 w-4 rotate-180" />
        <span className="text-ink">{event.name}</span>
      </nav>

      <div className="mb-8 flex items-center gap-4">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-lime to-lime-bright text-lime-ink shadow-glow">
          <Trophy className="h-7 w-7" />
        </span>
        <div>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
            {event.name}
          </h1>
          <span className="text-sm font-semibold text-muted">
            {STATUS_LABEL[event.status] ?? event.status}
          </span>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={<CalendarDays className="h-4 w-4" />} label="תאריך">
          {start.toLocaleDateString("he-IL", { day: "numeric", month: "long" })}
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

      <div className="mb-8 rounded-2xl border border-accent/25 bg-accent/10 px-5 py-3 text-sm font-bold text-accent">
        <CalendarDays className="ml-1 inline h-4 w-4" />
        חלון זמן: {Math.floor(duration / 60)} שע׳ {duration % 60} דק׳
      </div>

      <h2 className="ds-label mb-3">כניסה לתחרות</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <ChoiceCard
          href={`/c/${event.slug}/live`}
          icon={<LayoutDashboard className="h-7 w-7" />}
          title="דשבורד התחרות"
          description="צפייה חיה: מי על המגרש, ניקוד, טיימרים"
        />
        <ChoiceCard
          href={`/c/${event.slug}/leaderboard`}
          icon={<ListOrdered className="h-7 w-7" />}
          title="טבלת תוצאות"
          description="דירוג לפי מקצה ורמה, מתעדכן בזמן אמת"
        />
      </div>

      {isManager && (
        <>
          <h2 className="ds-label mb-3 mt-8">ניהול (מארגנים)</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <ChoiceCard
              href={`/c/${event.slug}/judge`}
              icon={<Gavel className="h-7 w-7" />}
              title="שיפוט"
              description="ממשק ניקוד מבוסס מגע לפי מקצוע"
            />
            <ChoiceCard
              href={`/admin/events/${event._id}`}
              icon={<Settings className="h-7 w-7" />}
              title="ניהול התחרות"
              description="ייבוא מתחרים, יצירת לוז, סדר עלייה"
            />
          </div>
        </>
      )}
    </>
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

function ChoiceCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group ds-card flex flex-col p-6 transition hover:border-accent/50 hover:shadow-glow"
    >
      <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-lime to-lime-bright text-lime-ink shadow-glow transition group-hover:scale-105">
        {icon}
      </span>
      <h3 className="text-lg font-extrabold">{title}</h3>
      <p className="mt-1 flex-1 text-sm text-muted">{description}</p>
      <span className="mt-4 inline-flex items-center gap-1 text-sm font-extrabold text-accent">
        כניסה
        <ChevronRight className="h-4 w-4 rotate-180 transition group-hover:-translate-x-1" />
      </span>
    </Link>
  );
}
