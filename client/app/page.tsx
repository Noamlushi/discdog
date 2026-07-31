"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarRange,
  ChevronLeft,
  ListOrdered,
  PawPrint,
  Plus,
  Settings,
  Trophy,
} from "lucide-react";
import { getEvents, getLeagues } from "../lib/api";
import type { EventDto, LeagueDto } from "../lib/types";
import { ThemeToggle } from "../components/ThemeToggle";

// Landing / splash — the platform's front door. Lists every competition and
// offers creation; picking one opens its shareable portal (/c/:slug) where you
// choose the live dashboard or the judge surface. Warm "sunset" theme, RTL/Hebrew.
const STATUS_COLOR: Record<string, string> = {
  Planning: "ds-pill-done",
  Live: "ds-pill-live",
  Completed: "ds-pill-ondeck",
};

const STATUS_LABEL: Record<string, string> = {
  Planning: "בתכנון",
  Live: "פעיל",
  Completed: "הסתיים",
};

export default function LandingPage() {
  const [events, setEvents] = useState<EventDto[]>([]);
  const [leagues, setLeagues] = useState<LeagueDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getEvents(), getLeagues().catch(() => [])])
      .then(([evs, lgs]) => {
        setEvents(evs);
        setLeagues(lgs);
        setError(null);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-arena text-ink">
      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:py-16">
        {/* Hero */}
        <header
          className="relative overflow-hidden rounded-3xl p-8 text-white shadow-glow ring-1 ring-white/10 sm:p-12"
          style={{
            background:
              "radial-gradient(120% 80% at 78% 10%, rgba(163,230,53,0.16), transparent 55%), radial-gradient(90% 70% at 20% 100%, rgba(20,70,35,0.5), transparent 60%), linear-gradient(160deg, #121c14 0%, #0b120d 60%, #0a0e0c 100%)",
          }}
        >
          <PawPrint className="pointer-events-none absolute -left-8 -top-8 h-44 w-44 rotate-12 text-white/10 animate-paw-drift" />
          <PawPrint className="pointer-events-none absolute -bottom-12 right-8 h-32 w-32 -rotate-12 text-white/5" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 rounded-full bg-lime/15 px-3 py-1.5 text-sm font-extrabold text-lime ring-1 ring-lime/30 backdrop-blur">
                🐾 J&apos;GAMES
              </span>
              <ThemeToggle className="bg-white/10 text-white ring-white/15 hover:bg-white/20" />
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">
              תחרויות פריזבי לכלבים
            </h1>
            <p className="mt-2 max-w-xl text-base font-medium text-white/85 sm:text-lg">
              נהל, שפוט וצפה בתחרויות בזמן אמת. בחר תחרות כדי להתחיל.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/admin/events/new"
                className="inline-flex items-center gap-2 rounded-2xl bg-lime px-5 py-3 text-sm font-extrabold text-lime-ink shadow-glow transition hover:brightness-105"
              >
                <Plus className="h-5 w-5" />
                צור תחרות
              </Link>
              <Link
                href="/admin/leagues/new"
                className="inline-flex items-center gap-2 rounded-2xl bg-white/20 px-5 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/30"
              >
                <ListOrdered className="h-5 w-5" />
                צור ליגה
              </Link>
              <Link
                href="/admin"
                className="inline-flex items-center gap-2 rounded-2xl bg-white/20 px-5 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/30"
              >
                <Settings className="h-5 w-5" />
                ניהול
              </Link>
            </div>
          </div>
        </header>

        {/* Competitions */}
        <section className="mt-10">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-extrabold">
            <Trophy className="h-5 w-5 text-accent" />
            התחרויות
          </h2>

          {error && (
            <p className="rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-600 dark:bg-red-950/40">
              {error}
            </p>
          )}

          {loading ? (
            <p className="py-16 text-center text-cocoa/50">טוען…</p>
          ) : events.length === 0 ? (
            <EmptyState />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {events.map((ev) => (
                <li key={ev._id}>
                  <Link
                    href={`/c/${ev.slug}`}
                    className="group ds-card flex items-center justify-between gap-3 p-5 transition hover:border-accent/40 hover:shadow-glow"
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-lime to-lime-bright text-lime-ink shadow-glow">
                        <Trophy className="h-6 w-6" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-extrabold">{ev.name}</p>
                        <p className="mt-0.5 flex items-center gap-1 text-sm text-muted">
                          <CalendarRange className="h-3.5 w-3.5 shrink-0" />
                          {new Date(ev.estimatedStartTime).toLocaleDateString(
                            "he-IL",
                            { day: "numeric", month: "long", year: "numeric" }
                          )}
                          {" · "}
                          {ev.activePitches} מגרשים
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className={`ds-pill ${
                          STATUS_COLOR[ev.status] ?? STATUS_COLOR.Planning
                        }`}
                      >
                        {STATUS_LABEL[ev.status] ?? ev.status}
                      </span>
                      <ChevronLeft className="h-5 w-5 text-muted transition group-hover:text-accent" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Leagues */}
        {leagues.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-extrabold">
              <ListOrdered className="h-5 w-5 text-accent" />
              ליגות דיסטנס
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2">
              {leagues.map((lg) => (
                <li key={lg._id}>
                  <Link
                    href={`/l/${lg.slug}`}
                    className="group ds-card flex items-center justify-between gap-3 p-5 transition hover:border-accent/40 hover:shadow-glow"
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-lime to-lime-bright text-lime-ink shadow-glow">
                        <ListOrdered className="h-6 w-6" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-extrabold">{lg.name}</p>
                        <p className="mt-0.5 flex items-center gap-1 text-sm text-muted">
                          <CalendarRange className="h-3.5 w-3.5 shrink-0" />
                          {lg.dates.length} מועדים ·{" "}
                          {lg.scoring.mode === "bestOf"
                            ? `הטוב מ-${lg.scoring.bestN}`
                            : "סכום הכל"}
                        </p>
                      </div>
                    </div>
                    <ChevronLeft className="h-5 w-5 text-muted transition group-hover:text-accent" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-line py-20 text-center">
      <Trophy className="mb-3 h-10 w-10 text-muted" />
      <p className="font-bold text-ink">
        אין תחרויות עדיין
      </p>
      <p className="mt-1 text-sm text-muted">
        לחץ על ״צור תחרות״ כדי להתחיל
      </p>
    </div>
  );
}
